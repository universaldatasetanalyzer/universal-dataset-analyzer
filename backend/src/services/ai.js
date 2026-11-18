const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL   = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'];

function getClient() {
  if (!API_KEY || API_KEY === 'your-gemini-api-key') return null;
  return new GoogleGenerativeAI(API_KEY);
}

async function callWithFallback(createOperation) {
  const modelsToTry = [MODEL, ...FALLBACK_MODELS.filter(m => m !== MODEL)];
  let lastErr;
  for (const modelName of modelsToTry) {
    try {
      return await createOperation(modelName);
    } catch (err) {
      lastErr = err;
      console.warn(`Gemini model ${modelName} failed (${err.message}). Trying fallback if available...`);
    }
  }
  throw lastErr;
}

// ── Chat with Dataset ─────────────────────────────────────────────────────────
async function chatWithDataset(messages, datasetContext) {
  const client = getClient();
  if (!client) return getMockResponse(messages[messages.length - 1]?.content || '');

  // تجهيز ملخص تفصيلي للأعمدة والإحصائيات
  const columnDetails = (datasetContext.columnSummary || []).map(c => {
    let line = `- عمود "${c.name}" (نوعه: ${c.type}): يحتوي على ${c.uniqueCount || 'غير محدد'} قيمة فريدة، ونسبة النواقص ${c.nullPercent ? c.nullPercent.toFixed(1) : 0}%`;
    if (c.min !== undefined && c.max !== undefined) {
      line += ` | الحد الأدنى (Min): ${c.min} | الحد الأقصى (Max): ${c.max} | المتوسط (Mean): ${c.mean ? Number(c.mean).toFixed(2) : 'N/A'}`;
    }
    if (c.sample && c.sample.length > 0) {
      line += ` | عينة من القيم: [${c.sample.slice(0, 5).join(', ')}]`;
    }
    return line;
  }).join('\n');

  const systemPrompt = `أنت مساعد ذكاء اصطناعي متخصص في تحليل البيانات ومربوط حصرياً بقاعدة البيانات التالية:

=== معلومات ملف البيانات ===
اسم الملف: ${datasetContext.name || 'Dataset'}
عدد الصفوف: ${datasetContext.rows?.toLocaleString() || 'غير معروف'}
عدد الأعمدة: ${datasetContext.columns || 'غير معروف'}
نوع الملف: ${datasetContext.format?.toUpperCase() || 'N/A'}
درجة جودة البيانات (Health Score): ${datasetContext.healthScore ?? 'N/A'}%

=== تفاصيل الأعمدة والإحصائيات ===
${columnDetails}

${datasetContext.sampleRows ? `=== عينة من بيانات الصفوف الأولى ===\n${datasetContext.sampleRows}\n` : ''}

=== التعليمات والقواعد الصارمة (إلزامية) ===
1. ممنوع كتابة أكواد نهائياً: أجب على سؤال المستخدم بشكل مباشر ومفهوم بالأرقام والنتائج المستخرجة من البيانات. لا تقم بكتابة أي كود برمجي (Python / Pandas / SQL) على الإطلاق إلا إذا طلب المستخدم منك الكود صراحة (مثل: "اكتب كود لبايثون").
2. النطاق الحصري للداتا: يجب عليك الإجابة فقط وحصرياً عن الأسئلة المتعلقة بملف البيانات "${datasetContext.name || ''}". إذا سألك المستخدم عن أي موضوع عام أو خارج نطاق هذا الملف (مثل أسئلة عامة، برمجة، طقس، معلومات خارجية)، ارفض الإجابة بأدب واذكر أنك مخصص فقط للإجابة عن البيانات داخل هذا الملف.
3. التحدث بنفس لغة المستخدم: إذا كتب المستخدم بالعربية، أجب بلغة عربية فصحى وبسيطة. وإذا كتب بالإنجليزية، أجب بالإنجليزية.
4. ممنوع وضع نصوص فارغة أو قوالب (Placeholders): لا تكتب أبداً نصوص مثل "[اسم المنتج]" أو "[القيمة]". استخرج القيمة الحقيقية من الإحصائيات أو العينات المتاحة، وإذا لم تكن القيمة الفردية التفصيلية متوفرة في الملخص الإحصائي، اذكر القيمة القصوى/المتوسطة مباشرة بالأرقام بوضوح دون تخمين.
5. التنسيق: استخدم تنسيق Markdown واضح (نقاط وعناوين عريضة) لتسهيل القراءة.`;

  try {
    const genAI = client;
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMsg = messages[messages.length - 1].content;

    return await callWithFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMsg);
      return result.response.text();
    });
  } catch (err) {
    console.error('Gemini chat error:', err.message);
    throw new Error(`Gemini API error: ${err.message}`);
  }
}

// ── Generate AI Insights ──────────────────────────────────────────────────────
async function generateAIInsights(datasetContext) {
  const client = getClient();
  if (!client) return getMockInsights(datasetContext);

  const prompt = `You are an expert decision intelligence analyst. Analyze the dataset summary below and produce useful, evidence-based decisions for the dataset owner. First infer the dataset domain (sales, marketing, finance, operations, HR, healthcare, education, etc.) from the column names and values. Do not assume it is sales. Discover the strongest opportunities, risks, segments, time windows, thresholds, and next actions yourself.

${datasetContext.language === 'ar' ? 'Write every human-readable field in Modern Standard Arabic. Keep dataset names, column names, numbers, and technical identifiers unchanged.' : 'Write every human-readable field in English.'}

Rules for decisions:
- Every decision must be specific and actionable, not generic advice.
- Ground claims in the supplied statistics. Never invent exact facts that are not present.
- If a date/time, amount, price, budget, target, or threshold can be estimated, include a practical range and clearly label it as an estimate.
- For sales data, identify the best period/segment/product and suggest an offer, timing, and estimated discount or budget with reasoning. For other domains, make the equivalent decision (for example staffing, retention, inventory, campaign allocation, risk response, or process improvement).
- Return 3 to 6 decisions, ordered by expected impact. Include a quick validation step for each decision.

Dataset summary:

Dataset: ${datasetContext.name}
Rows: ${datasetContext.rows?.toLocaleString()}
Columns: ${datasetContext.columns}
Health Score: ${datasetContext.healthScore}%

Column details:
${JSON.stringify(datasetContext.columnSummary || [], null, 2)}

Quality issues:
${JSON.stringify(datasetContext.qualityIssues || [], null, 2)}

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "executiveSummary": "2-3 paragraph executive summary",
  "keyFindings": [
    {"title": "...", "description": "...", "impact": "high|medium|low", "metric": "..."}
  ],
  "trends": [
    {"title": "...", "description": "...", "direction": "up|down|neutral"}
  ],
  "correlations": [
    {"col1": "...", "col2": "...", "strength": 0.0, "description": "..."}
  ],
  "anomalies": [
    {"title": "...", "description": "...", "severity": "info|warning|error"}
  ],
  "recommendations": ["..."],
  "decisionBrief": [
    {
      "title": "Short decision title",
      "decision": "The decision the owner should make",
      "action": "The concrete next action to take",
      "when": "Best time, period, segment, or trigger; use 'Not available in data' when unknown",
      "value": "Estimated amount, range, target, or priority; use 'Not estimable' when unsupported",
      "evidence": "Specific columns, statistic, comparison, or pattern supporting this",
      "impact": "high|medium|low",
      "confidence": 0.0,
      "validation": "A quick test or metric to validate the decision"
    }
  ]
}`;

  try {
    const genAI = client;
    const text = await callWithFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });
    return { ...JSON.parse(text), _language: datasetContext.language || 'en' };
  } catch (err) {
    console.error('Gemini insights error:', err.message);
    return getMockInsights(datasetContext);
  }
}

// ── Mock responses ────────────────────────────────────────────────────────────
function getMockResponse(question) {
  const q = question.toLowerCase();
  if (q.includes('missing') || q.includes('null')) {
    return `Based on the dataset analysis, here are the missing value patterns:\n\n**Recommendations:**\n- Use median imputation for numeric columns\n- Use mode imputation for categorical columns\n- Consider dropping rows with >50% missing values\n\nNavigate to the **Data Quality** page for precise numbers.`;
  }
  if (q.includes('summary') || q.includes('overview')) {
    return `Here's an overview of your dataset:\n\n- Visit the **Summary** page for detailed column breakdown\n- The **Quality** page shows health score and issues\n- The **Visualize** page shows charts for all numeric columns`;
  }
  return `I'm ready to analyze your dataset! I can help with:\n\n1. **Statistical questions** — distributions, averages, ranges\n2. **Quality questions** — missing values, outliers, duplicates\n3. **Trend analysis** — patterns over time or categories\n4. **Correlation analysis** — relationships between columns\n\n*Note: Configure GEMINI_API_KEY in the backend .env file for full AI capabilities.*`;
}

function getMockInsights(ctx) {
  if (ctx.language === 'ar') return {
    _language: 'ar',
    executiveSummary: `تحتوي مجموعة البيانات "${ctx.name}" على ${ctx.rows?.toLocaleString() || 0} سجلًا و${ctx.columns || 0} عمود، مع درجة صحة ${ctx.healthScore || 0}%. ${ctx.healthScore > 80 ? 'البيانات نظيفة ومنظمة بشكل عام.' : 'ينبغي معالجة بعض مشكلات الجودة قبل التحليل.'}`,
    keyFindings: [
      { title: 'نظرة عامة على البيانات', description: `${ctx.rows?.toLocaleString() || 0} سجل عبر ${ctx.columns || 0} متغير. درجة الصحة: ${ctx.healthScore || 0}%.`, impact: 'high', metric: `صحة ${ctx.healthScore || 0}%` },
      { title: 'جودة البيانات', description: 'راجع صفحة جودة البيانات لتحليل القيم المفقودة والقيم الشاذة بالتفصيل.', impact: 'medium', metric: 'راجع الجودة' },
    ],
    trends: [{ title: 'إعداد الذكاء الاصطناعي', description: 'أضف GEMINI_API_KEY إلى ملف البيئة في backend لتفعيل التحليل الذكي الكامل.', direction: 'up' }],
    correlations: [],
    anomalies: [{ title: 'الذكاء الاصطناعي غير مفعّل', description: 'أضف مفتاح Gemini إلى ملف البيئة في backend للحصول على رؤى حقيقية.', severity: 'info' }],
    recommendations: ['أضف مفتاح Gemini لتفعيل الرؤى الكاملة', 'راجع تقرير جودة البيانات', 'نظّف البيانات قبل التحليل'],
  };
  return {
    _language: 'en',
    executiveSummary: `The dataset "${ctx.name}" contains ${ctx.rows?.toLocaleString() || 0} rows and ${ctx.columns || 0} columns with a health score of ${ctx.healthScore || 0}%. ${ctx.healthScore > 80 ? 'The data is generally clean and well-structured.' : 'Some quality issues should be addressed before analysis.'}`,
    keyFindings: [
      { title: 'Dataset Overview', description: `${ctx.rows?.toLocaleString() || 0} records across ${ctx.columns || 0} variables. Health score: ${ctx.healthScore || 0}%.`, impact: 'high', metric: `${ctx.healthScore || 0}% health` },
      { title: 'Data Quality', description: 'Review the Quality page for detailed missing value analysis and outlier detection.', impact: 'medium', metric: 'Check quality' },
    ],
    trends: [
      { title: 'Configure AI', description: 'Set GEMINI_API_KEY in backend .env to enable real AI-powered analysis.', direction: 'up' },
    ],
    correlations: [],
    anomalies: [
      { title: 'AI Not Configured', description: 'Add your Gemini API key to the backend .env file for real AI insights.', severity: 'info' },
    ],
    recommendations: ['Configure Gemini API key for full AI insights', 'Review data quality report', 'Clean data before analysis'],
  };
}

module.exports = { chatWithDataset, generateAIInsights };