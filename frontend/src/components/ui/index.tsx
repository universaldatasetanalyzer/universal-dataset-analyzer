import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', loading, icon, iconRight, children, className = '', disabled, ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
    secondary: 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300',
    ghost: 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    outline: 'border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
      {iconRight && !loading && iconRight}
    </button>
  );
};

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}
export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</label>}
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">{icon}</div>}
      <input className={`input w-full ${icon ? 'pl-10' : ''} ${error ? 'border-red-400 focus:ring-red-400' : ''} ${className}`} {...props} />
    </div>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

// Card
interface CardProps { children: React.ReactNode; className?: string; hover?: boolean; onClick?: () => void; }
export const Card: React.FC<CardProps> = ({ children, className = '', hover, onClick }) => (
  <div
    onClick={onClick}
    className={`card ${hover ? 'hover:shadow-lg hover:border-brand-200 dark:hover:border-brand-800 cursor-pointer transition-all duration-200' : ''} ${className}`}
  >
    {children}
  </div>
);

// Badge
interface BadgeProps { children: React.ReactNode; variant?: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray'; }
export const Badge: React.FC<BadgeProps> = ({ children, variant = 'gray' }) => {
  const variants = {
    green: 'badge-green', red: 'badge-red', blue: 'badge-blue',
    yellow: 'badge-yellow', purple: 'badge-purple',
    gray: 'badge bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
  };
  return <span className={variants[variant]}>{children}</span>;
};

// Progress Bar
interface ProgressProps { value: number; max?: number; color?: string; className?: string; }
export const Progress: React.FC<ProgressProps> = ({ value, max = 100, color = 'bg-brand-500', className = '' }) => (
  <div className={`h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden ${className}`}>
    <motion.div
      className={`h-full rounded-full ${color}`}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  </div>
);

// Skeleton
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-surface-200 dark:bg-surface-700 rounded-lg ${className}`} />
);

// Modal
interface ModalProps { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg'; }
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`relative card p-6 w-full ${sizes[size]} z-10 shadow-2xl`}
      >
        {title && <h3 className="text-lg font-semibold font-display mb-4">{title}</h3>}
        {children}
      </motion.div>
    </div>
  );
};

// Tabs
interface Tab { id: string; label: string; icon?: React.ReactNode; }
interface TabsProps { tabs: Tab[]; active: string; onChange: (id: string) => void; }
export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => (
  <div className="flex items-center gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl w-fit">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          active === tab.id
            ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 shadow-sm'
            : 'text-surface-500 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
        }`}
      >
        {tab.icon}{tab.label}
      </button>
    ))}
  </div>
);

// Empty State
interface EmptyStateProps { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode; }
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400 mb-4">{icon}</div>
    <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300 mb-1">{title}</h3>
    <p className="text-sm text-surface-500 dark:text-surface-500 max-w-xs mb-4">{description}</p>
    {action}
  </div>
);

// Table
interface TableColumn<T> { key: string; header: string; render?: (row: T) => React.ReactNode; }
interface TableProps<T> { columns: TableColumn<T>[]; data: T[]; className?: string; }
export function Table<T extends Record<string, unknown>>({ columns, data, className = '' }: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 dark:border-surface-800">
            {columns.map(col => (
              <th key={col.key} className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-500 whitespace-nowrap">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="py-3 px-4 text-surface-700 dark:text-surface-300">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stat Card
interface StatCardProps { title: string; value: string | number; change?: string; positive?: boolean; icon: React.ReactNode; color?: string; }
export const StatCard: React.FC<StatCardProps> = ({ title, value, change, positive, icon, color = 'brand' }) => {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400',
    green: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="stat-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500 dark:text-surface-500 font-medium">{title}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color] || colors.brand}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold font-display tracking-tight">{value}</p>
      {change && (
        <p className={`text-xs font-medium ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {positive ? '↑' : '↓'} {change}
        </p>
      )}
    </motion.div>
  );
};

// Tooltip
export const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="relative group inline-flex">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-900 dark:border-t-white" />
    </div>
  </div>
);

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}
export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</label>}
    <select className={`input appearance-none cursor-pointer ${className}`} {...props}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// Toggle
interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; label?: string; }
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer select-none">
    <div
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${checked ? 'bg-brand-600' : 'bg-surface-300 dark:bg-surface-700'}`}
      style={{ height: '22px' }}
    >
      <motion.div
        layout transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm"
        style={{ width: '18px', height: '18px', left: checked ? '20px' : '2px' }}
      />
    </div>
    {label && <span className="text-sm text-surface-700 dark:text-surface-300">{label}</span>}
  </label>
);
