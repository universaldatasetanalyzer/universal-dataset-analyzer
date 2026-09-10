from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
import os
import uuid
import json
import tempfile
import shutil
from pathlib import Path

app = FastAPI(title="UDA Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Models ────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    filePath: str
    format: str
    datasetId: str

class CleanRequest(BaseModel):
    filePath: str
    operations: Dict[str, Any]
    datasetId: str
    preview: bool = False

class InsightsRequest(BaseModel):
    filePath: str
    summaryData: Dict[str, Any]
    datasetId: str


async def save_upload(upload: UploadFile) -> str:
    suffix = Path(upload.filename or '').suffix
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        with temp:
            while chunk := await upload.read(1024 * 1024):
                temp.write(chunk)
    finally:
        await upload.close()
    return temp.name

# ─── Helpers ───────────────────────────────────────────────────────────────────

def normalize_file_path(file_path: str) -> str:
    """
    BUG FIX: الكود القديم كان ممكن يرجع path مش موجود من غير ما يعمل raise.
    دلوقتي بيعمل check صريح في الآخر.
    """
    # 1. جرب relative path من جنب backend
    p = Path(file_path)
    if not p.is_absolute():
        backend_root = Path(__file__).resolve().parent.parent
        candidate = backend_root / file_path
        if candidate.exists():
            return str(candidate.resolve())

    # 2. جرب تصليح الـ backslashes (Windows paths)
    normalized = Path(str(file_path).replace('\\', os.sep))
    if normalized.exists():
        return str(normalized.resolve())

    # 3. جرب الـ path كما هو
    if p.exists():
        return str(p.resolve())

    raise FileNotFoundError(f"File not found: {file_path}")


def load_dataframe(file_path: str, fmt: str) -> pd.DataFrame:
    fmt = fmt.lower().strip('.')  # BUG FIX: strip dots عشان ممكن يجي ".csv" بدل "csv"
    if fmt == 'csv':
        return pd.read_csv(file_path, low_memory=False)
    elif fmt in ('xlsx', 'xls'):
        return pd.read_excel(file_path)
    elif fmt == 'tsv':
        return pd.read_csv(file_path, sep='\t', low_memory=False)
    elif fmt == 'json':
        return pd.read_json(file_path)
    else:
        raise ValueError(f"Unsupported format: {fmt}")


def detect_column_type(series: pd.Series) -> str:
    """
    BUG FIX: الكود القديم كان بيعمل pd.to_datetime على sample
    بدون errors='coerce' فكان بيعمل crash على columns مش dates.
    كمان كان ممكن يصنف columns رقمية كـ datetime.
    """
    if pd.api.types.is_bool_dtype(series):
        return 'boolean'
    if pd.api.types.is_numeric_dtype(series):
        return 'numeric'
    if pd.api.types.is_datetime64_any_dtype(series):
        return 'datetime'

    # جرب detect datetime من strings
    sample = series.dropna().head(100)
    if len(sample) > 0:
        try:
            converted = pd.to_datetime(sample, infer_datetime_format=True, errors='coerce')
            # BUG FIX: لازم اغلبية القيم تتحول فعلاً مش بس واحدة
            success_rate = converted.notna().sum() / max(len(converted), 1)
            if success_rate > 0.8:
                unique_ratio = series.nunique() / max(len(series), 1)
                if unique_ratio < 0.95:
                    return 'datetime'
        except Exception:
            pass

    unique_ratio = series.nunique() / max(len(series), 1)
    if unique_ratio < 0.05 or series.nunique() <= 20:
        return 'categorical'
    return 'text'


def detect_outliers_iqr(series: pd.Series) -> int:
    if not pd.api.types.is_numeric_dtype(series):
        return 0
    clean = series.dropna()
    if len(clean) < 4:
        return 0
    Q1 = clean.quantile(0.25)
    Q3 = clean.quantile(0.75)
    IQR = Q3 - Q1
    if IQR == 0:
        return 0
    outliers = ((clean < Q1 - 1.5 * IQR) | (clean > Q3 + 1.5 * IQR)).sum()
    return int(outliers)


def compute_health_score(df: pd.DataFrame, issues: list) -> int:
    score = 100
    total_cells = df.shape[0] * df.shape[1]
    if total_cells == 0:
        return 0

    missing_rate = df.isnull().sum().sum() / total_cells
    score -= min(30, int(missing_rate * 100))

    dup_rate = df.duplicated().sum() / max(len(df), 1)
    score -= min(20, int(dup_rate * 100))

    outlier_count = sum(i.get('count', 0) for i in issues if i.get('type') == 'outlier')
    outlier_rate = outlier_count / max(len(df), 1)
    score -= min(15, int(outlier_rate * 50))

    # BUG FIX إضافة: خصم على high-cardinality text columns (مؤشر بيانات dirty)
    text_cols = [c for c in df.columns if df[c].dtype == object]
    if len(text_cols) > len(df.columns) * 0.7:
        score -= 5

    return max(0, min(100, score))


# ─── Visualization Builder ─────────────────────────────────────────────────────

def is_id_column(name: str, series: pd.Series) -> bool:
    """يكشف لو الـ column ده ID أو index مش مفيد للـ visualization"""
    name_lower = name.lower()
    id_keywords = ['id', 'index', 'idx', 'key', 'uuid', 'guid', 'code', 'no', 'num', 'number', 'ref']
    if any(name_lower == k or name_lower.endswith(f'_{k}') or name_lower.startswith(f'{k}_') for k in id_keywords):
        return True
    # لو unique values == عدد الصفوف تقريباً، غالباً ID
    unique_ratio = series.nunique() / max(len(series), 1)
    if unique_ratio > 0.95 and series.nunique() > 20:
        return True
    return False


def smart_scatter_pairs(df: pd.DataFrame, meaningful_numeric: list) -> list:
    """يختار أفضل أزواج للـ scatter plot بناءً على الـ correlation"""
    if len(meaningful_numeric) < 2:
        return []
    try:
        sub = df[[c["name"] for c in meaningful_numeric]].select_dtypes(include=[np.number])
        corr = sub.corr().abs()
        pairs = []
        cols  = list(corr.columns)
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                v = corr.iloc[i, j]
                if not np.isnan(v):
                    pairs.append((cols[i], cols[j], float(v)))
        # رتب: الأعلى correlation أولاً (علاقة واضحة)، بس مش 1.0 (نفس الـ column)
        pairs.sort(key=lambda x: x[2] if x[2] < 0.99 else -1, reverse=True)
        return pairs
    except Exception:
        return []


def build_visualizations(df: pd.DataFrame, columns: list, quality: dict, rows: int, cols: int) -> dict:
    """
    Visualization ذكية:
    - بتشيل ID columns تلقائياً
    - بتختار أفضل أزواج scatter بناءً على correlation
    - histogram labels مفهومة (أرقام مختصرة)
    - بتركز على الـ columns المفيدة فعلاً
    """
    BAR_COLORS = ['#0ea5e9', '#d946ef', '#10b981', '#f59e0b', '#6366f1',
                  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4']

    all_numeric = [c for c in columns if c["type"] == "numeric"]
    cat_cols    = [c for c in columns if c["type"] == "categorical"]
    dt_cols     = [c for c in columns if c["type"] == "datetime"]

    # ── شيل الـ ID columns من الـ numeric ──────────────────────────────────
    meaningful_numeric = [
        c for c in all_numeric
        if not is_id_column(c["name"], df[c["name"]])
    ]
    # لو كل الـ numeric اتشالت (مثلاً dataset فيها ID بس)، خد اللي عندك
    if not meaningful_numeric:
        meaningful_numeric = all_numeric

    viz = {"charts": []}

    # ── 1. Histograms — بس للـ columns المفيدة ─────────────────────────────
    for nc in meaningful_numeric[:4]:
        col_data = df[nc["name"]].dropna()
        if len(col_data) < 2:
            continue
        try:
            n_bins   = min(12, max(5, len(col_data.unique())))
            hist, edges = np.histogram(col_data, bins=n_bins)

            # Format labels بشكل مفهوم
            def fmt(v):
                if abs(v) >= 1_000_000: return f"{v/1_000_000:.1f}M"
                if abs(v) >= 1_000:     return f"{v/1_000:.1f}K"
                return f"{v:.1f}"

            viz["charts"].append({
                "id":     f"hist_{nc['name']}",
                "type":   "histogram",
                "column": nc["name"],
                "title":  f"Distribution of {nc['name']}",
                "data":   [
                    {"bin": fmt(edges[i]), "count": int(hist[i])}
                    for i in range(len(hist))
                    if int(hist[i]) > 0  # شيل الـ bins الفاضية
                ],
            })
        except Exception:
            pass

    # ── 2. Bar Charts — Categorical ────────────────────────────────────────
    for cc in cat_cols[:4]:
        vc = df[cc["name"]].value_counts().head(10)
        if len(vc) == 0:
            continue
        viz["charts"].append({
            "id":     f"bar_{cc['name']}",
            "type":   "bar",
            "column": cc["name"],
            "title":  f"Top Categories in {cc['name']}",
            "data":   [
                {"name": str(k), "value": int(v), "color": BAR_COLORS[i % len(BAR_COLORS)]}
                for i, (k, v) in enumerate(vc.items())
            ],
        })

    # ── 3. Scatter Plots — أذكى اختيار للأزواج ────────────────────────────
    best_pairs = smart_scatter_pairs(df, meaningful_numeric)
    for c1, c2, corr_val in best_pairs[:2]:
        try:
            sample_df = df[[c1, c2]].dropna().head(300)
            if len(sample_df) < 5:
                continue
            corr_label = "Strong" if corr_val > 0.7 else "Moderate" if corr_val > 0.4 else "Weak"
            viz["charts"].append({
                "id":        f"scatter_{c1}_{c2}",
                "type":      "scatter",
                "columns":   [c1, c2],
                "title":     f"{c1} vs {c2}",
                "subtitle":  f"{corr_label} correlation ({corr_val:.2f})",
                "data":      [
                    {"x": round(float(r[c1]), 4), "y": round(float(r[c2]), 4)}
                    for _, r in sample_df.iterrows()
                ],
            })
        except Exception:
            pass

    # ── 4. Box Plots — للـ meaningful columns فقط ─────────────────────────
    for nc in meaningful_numeric[:4]:
        col_data = df[nc["name"]].dropna()
        if len(col_data) < 4:
            continue
        try:
            Q1  = float(col_data.quantile(0.25))
            Q3  = float(col_data.quantile(0.75))
            IQR = Q3 - Q1
            viz["charts"].append({
                "id":     f"box_{nc['name']}",
                "type":   "boxplot",
                "column": nc["name"],
                "title":  f"Box Plot — {nc['name']}",
                "data": {
                    "min":          round(float(col_data.min()), 4),
                    "q1":           round(Q1, 4),
                    "median":       round(float(col_data.median()), 4),
                    "q3":           round(Q3, 4),
                    "max":          round(float(col_data.max()), 4),
                    "mean":         round(float(col_data.mean()), 4),
                    "lowerFence":   round(max(float(col_data.min()), Q1 - 1.5 * IQR), 4),
                    "upperFence":   round(min(float(col_data.max()), Q3 + 1.5 * IQR), 4),
                    "outlierCount": detect_outliers_iqr(col_data),
                },
            })
        except Exception:
            pass

    # ── 5. Line Chart — Time Series ────────────────────────────────────────
    for dt_col in dt_cols[:2]:
        try:
            dt_series = pd.to_datetime(df[dt_col["name"]], errors='coerce').dropna()
            if len(dt_series) < 2:
                continue
            trend = dt_series.dt.to_period('M').value_counts().sort_index().tail(36)
            viz["charts"].append({
                "id":     f"line_{dt_col['name']}",
                "type":   "line",
                "column": dt_col["name"],
                "title":  f"Monthly Trend — {dt_col['name']}",
                "data":   [{"date": str(k), "records": int(v)} for k, v in trend.items()],
            })
        except Exception:
            pass

    # ── 6. Pie Chart — Completeness ────────────────────────────────────────
    total_cells   = int(rows * cols)
    total_missing = int(quality["totalMissing"])
    total_valid   = max(0, total_cells - total_missing)
    viz["charts"].append({
        "id":    "pie_completeness",
        "type":  "pie",
        "title": "Data Completeness",
        "data":  [
            {"name": "Valid Cells",   "value": total_valid,   "fill": "#10b981"},
            {"name": "Missing Cells", "value": total_missing, "fill": "#ef4444"},
        ],
    })

    # ── 7. Correlation Heatmap — بس meaningful columns ────────────────────
    meaningful_names = [c["name"] for c in meaningful_numeric]
    num_df = df[meaningful_names].select_dtypes(include=[np.number]) if meaningful_names else pd.DataFrame()
    if num_df.shape[1] >= 2:
        try:
            corr      = num_df.corr(min_periods=5).round(3)
            cols_list = list(corr.columns)[:8]
            corr_data = [
                {"x": c, "y": r, "value": float(corr.loc[r, c])}
                for r in cols_list
                for c in cols_list
                if not np.isnan(corr.loc[r, c])
            ]
            if corr_data:
                viz["correlation"] = {"columns": cols_list, "data": corr_data}
        except Exception:
            pass

    # ── 8. Cumulative Distribution — Categorical ───────────────────────────
    for cc in cat_cols[:2]:
        try:
            vc      = df[cc["name"]].value_counts()
            top     = vc.head(8)
            other   = vc.iloc[8:].sum()
            total   = int(vc.sum())
            running = 0
            cum_data = []
            for k, v in top.items():
                running += int(v)
                cum_data.append({
                    "name":       str(k),
                    "count":      int(v),
                    "cumulative": round(running / total * 100, 1),
                })
            if other > 0:
                running += int(other)
                cum_data.append({
                    "name":       "Other",
                    "count":      int(other),
                    "cumulative": round(running / total * 100, 1),
                })
            viz["charts"].append({
                "id":     f"cumulative_{cc['name']}",
                "type":   "cumulative",
                "column": cc["name"],
                "title":  f"Cumulative Distribution — {cc['name']}",
                "data":   cum_data,
            })
        except Exception:
            pass

    # ── 9. Missing Values Overview ─────────────────────────────────────────
    missing_cols = [c for c in columns if c["nullCount"] > 0]
    if missing_cols:
        viz["charts"].append({
            "id":     "missing_overview",
            "type":   "bar",
            "column": "Missing Values Overview",
            "title":  "Missing Values by Column (%)",
            "data":   [
                {"name": c["name"], "value": round(c["nullPercent"], 2), "color": "#f59e0b"}
                for c in sorted(missing_cols, key=lambda x: x["nullPercent"], reverse=True)[:12]
            ],
        })

    return viz


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "uda-python"}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    format: str = Form(...),
    datasetId: str = Form(...),
):
    temp_path = await save_upload(file)
    try:
        df = load_dataframe(temp_path, format)
        rows, cols = df.shape

        # ── Column analysis ───────────────────────────────────────────────────
        columns = []
        for col in df.columns:
            series   = df[col]
            col_type = detect_column_type(series)
            null_count = int(series.isnull().sum())
            null_pct   = round(null_count / max(rows, 1) * 100, 3)
            unique     = int(series.nunique())
            sample     = [str(v) for v in series.dropna().head(3).tolist()]

            col_info = {
                "name":         str(col),
                "type":         col_type,
                "nullCount":    null_count,
                "nullPercent":  null_pct,
                "uniqueCount":  unique,
                "sample":       sample,
            }

            if col_type == 'numeric':
                clean = series.dropna()
                if len(clean) > 0:
                    col_info["min"]    = round(float(clean.min()), 4)
                    col_info["max"]    = round(float(clean.max()), 4)
                    col_info["mean"]   = round(float(clean.mean()), 4)
                    col_info["median"] = round(float(clean.median()), 4)
                    col_info["std"]    = round(float(clean.std()), 4)
                    # BUG FIX إضافة: skewness مفيد للـ data quality
                    try:
                        col_info["skewness"] = round(float(clean.skew()), 4)
                    except Exception:
                        pass

            columns.append(col_info)

        # ── Quality issues ────────────────────────────────────────────────────
        issues = []

        for col_info in columns:
            if col_info["nullCount"] > 0:
                severity = "high" if col_info["nullPercent"] > 5 else \
                           "medium" if col_info["nullPercent"] > 1 else "low"
                issues.append({
                    "type":        "missing",
                    "column":      col_info["name"],
                    "count":       col_info["nullCount"],
                    "severity":    severity,
                    "description": f"{col_info['nullPercent']}% of '{col_info['name']}' values are missing",
                })

        dup_count = int(df.duplicated().sum())
        if dup_count > 0:
            severity = "high"   if dup_count / rows > 0.05 else \
                       "medium" if dup_count / rows > 0.01 else "low"
            issues.append({
                "type":        "duplicate",
                "count":       dup_count,
                "severity":    severity,
                "description": f"{dup_count} exact duplicate rows found",
            })

        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                oc = detect_outliers_iqr(df[col])
                if oc > 0:
                    issues.append({
                        "type":        "outlier",
                        "column":      str(col),
                        "count":       oc,
                        "severity":    "low" if oc / rows < 0.01 else "medium",
                        "description": f"{oc} outlier values in '{col}' (IQR method)",
                    })

        health_score = compute_health_score(df, issues)

        type_counts = {}
        for c in columns:
            type_counts[c["type"]] = type_counts.get(c["type"], 0) + 1

        summary = {
            "rowCount":        rows,
            "columnCount":     cols,
            "columns":         columns,
            "typeDistribution": type_counts,
            "format":          format,
            "fileSize":        os.path.getsize(temp_path),
            "memoryUsage":     int(df.memory_usage(deep=True).sum()),
        }

        quality = {
            "healthScore":     health_score,
            "issues":          issues,
            "totalMissing":    sum(i["count"] for i in issues if i["type"] == "missing"),
            "totalDuplicates": dup_count,
            "totalOutliers":   sum(i["count"] for i in issues if i["type"] == "outlier"),
            "missingByColumn": [
                {"name": c["name"], "pct": c["nullPercent"], "count": c["nullCount"]}
                for c in columns if c["nullCount"] > 0
            ],
            "issueDistribution": [
                {"name": "Missing",    "value": sum(i["count"] for i in issues if i["type"] == "missing"),    "fill": "#f59e0b"},
                {"name": "Duplicates", "value": dup_count,                                                     "fill": "#ef4444"},
                {"name": "Outliers",   "value": sum(i["count"] for i in issues if i["type"] == "outlier"),    "fill": "#f97316"},
            ],
        }

        viz = build_visualizations(df, columns, quality, rows, cols)

        return {"summary": summary, "quality": quality, "visualization": viz}

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(temp_path)


@app.post("/clean")
async def clean(
    file: UploadFile = File(...),
    operations: str = Form(...),
    datasetId: str = Form(...),
    format: str = Form(...),
):
    temp_path = await save_upload(file)
    try:
        ops = json.loads(operations)
        df  = load_dataframe(temp_path, format)

        original_rows = len(df)
        original_cols = len(df.columns)
        applied = []

        # ── Fill missing values ───────────────────────────────────────────────
        fill_ops = ops.get("fillMissing", {})
        for col, method in fill_ops.items():
            if col not in df.columns:
                continue
            before = int(df[col].isnull().sum())
            if before == 0:
                continue   # BUG FIX: skip لو مفيش missing أصلاً

            if method == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].mean())
            elif method == "median" and pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
            elif method == "mode":
                mode_val = df[col].mode()
                if len(mode_val) > 0:
                    df[col] = df[col].fillna(mode_val[0])
            elif method == "drop":
                df = df.dropna(subset=[col])
            elif method == "forward_fill":   # BUG FIX إضافة: طريقة مفيدة جديدة
                df[col] = df[col].ffill()
            elif method == "backward_fill":  # BUG FIX إضافة
                df[col] = df[col].bfill()
            elif isinstance(method, (str, int, float)):
                df[col] = df[col].fillna(method)

            after = int(df[col].isnull().sum())
            applied.append({
                "op":      f"fill_missing.{col}",
                "before":  before,
                "after":   after,
                "changed": before - after,
            })

        # ── Remove duplicates ─────────────────────────────────────────────────
        if ops.get("removeDuplicates"):
            before = len(df)
            df = df.drop_duplicates()
            applied.append({
                "op":      "remove_duplicates",
                "before":  before,
                "after":   len(df),
                "changed": before - len(df),
            })

        # ── Outlier handling ──────────────────────────────────────────────────
        outlier_ops = ops.get("outliers", {})
        for col, method in outlier_ops.items():
            if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
                continue
            Q1    = df[col].quantile(0.25)
            Q3    = df[col].quantile(0.75)
            IQR   = Q3 - Q1
            if IQR == 0:   # BUG FIX: لو IQR == 0 مفيش outliers بالـ IQR method
                continue
            lower  = Q1 - 1.5 * IQR
            upper  = Q3 + 1.5 * IQR
            before = len(df)

            if method == "remove":
                df = df[(df[col] >= lower) & (df[col] <= upper)]
                applied.append({
                    "op":      f"remove_outliers.{col}",
                    "before":  before,
                    "after":   len(df),
                    "changed": before - len(df),
                })
            elif method == "cap":
                df[col] = df[col].clip(lower, upper)
                changed = int(((df[col] == lower) | (df[col] == upper)).sum())
                applied.append({
                    "op":      f"cap_outliers.{col}",
                    "before":  before,
                    "after":   len(df),
                    "changed": changed,  # BUG FIX: كان دايماً 0
                })

        # ── Text operations ───────────────────────────────────────────────────
        text_ops = ops.get("text", {})
        for col, op_list in text_ops.items():
            if col not in df.columns:
                continue
            if isinstance(op_list, str):
                op_list = [op_list]
            changed = 0
            for op in op_list:
                original = df[col].copy()
                if op == "trim":
                    df[col] = df[col].astype(str).str.strip()
                elif op == "lowercase":
                    df[col] = df[col].astype(str).str.lower()
                elif op == "uppercase":
                    df[col] = df[col].astype(str).str.upper()
                elif op == "titlecase":
                    df[col] = df[col].astype(str).str.title()
                elif op == "remove_special":   # BUG FIX إضافة: تنظيف special chars
                    df[col] = df[col].astype(str).str.replace(r'[^\w\s]', '', regex=True)
                elif op == "remove_digits":    # BUG FIX إضافة
                    df[col] = df[col].astype(str).str.replace(r'\d+', '', regex=True)
                # BUG FIX: نحسب changed فعلاً بدل ما نبعت len(df) غلط
                changed += int((df[col] != original.astype(str)).sum())
            applied.append({"op": f"text.{col}", "changed": changed})

        # ── Drop empty columns ────────────────────────────────────────────────
        if ops.get("dropEmptyColumns"):
            empty_cols = [c for c in df.columns if df[c].isnull().all()]
            if empty_cols:
                df = df.drop(columns=empty_cols)
                applied.append({
                    "op":      "drop_empty_columns",
                    "dropped": empty_cols,
                    "count":   len(empty_cols),
                    "changed": len(empty_cols),
                })

        # ── Drop columns by name ──────────────────────────────────────────────
        # BUG FIX إضافة: feature مفيد مش موجود في الكود القديم
        drop_cols = ops.get("dropColumns", [])
        if drop_cols:
            valid_drops = [c for c in drop_cols if c in df.columns]
            if valid_drops:
                df = df.drop(columns=valid_drops)
                applied.append({
                    "op":      "drop_columns",
                    "dropped": valid_drops,
                    "count":   len(valid_drops),
                    "changed": len(valid_drops),
                })

        final_rows, final_cols = df.shape
        result = {
            "applied":      applied,
            "rowsBefore":   original_rows,
            "rowsAfter":    final_rows,
            "colsBefore":   original_cols,
            "colsAfter":    final_cols,
            "rowsRemoved":  original_rows - final_rows,
            "colsRemoved":  original_cols - final_cols,   # BUG FIX إضافة
        }

        if not ops.get("preview", False):
            clean_dir  = os.path.dirname(temp_path)
            clean_name = f"cleaned_{uuid.uuid4().hex[:8]}_{Path(file.filename or 'dataset').name}"
            clean_path = os.path.join(clean_dir, clean_name)

            suffix = Path(file.filename or '').suffix.lower()
            if suffix in ('.xlsx', '.xls'):
                df.to_excel(clean_path, index=False)
            else:
                df.to_csv(clean_path, index=False)

            result["cleanedFilePath"] = clean_path
            result["preview"]         = df.head(10).replace({np.nan: None}).to_dict('records')
            # BUG FIX: to_dict كان بيبعت NaN وده مش valid JSON
        else:
            result["preview"]     = df.head(10).replace({np.nan: None}).to_dict('records')
            result["previewMode"] = True

        return result

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid operations JSON: {e.msg}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(temp_path)


@app.post("/insights")
async def insights(
    file: UploadFile = File(...),
    summaryData: str = Form(...),
    datasetId: str = Form(...),
):
    temp_path = await save_upload(file)
    try:
        summary = json.loads(summaryData)
        df = load_dataframe(temp_path, Path(file.filename or '').suffix.lstrip('.'))
        return {
            "summaryData": summary,
            "rowCount": len(df),
            "columnCount": len(df.columns),
            "datasetId": datasetId,
        }
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid summaryData JSON: {e.msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(temp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)