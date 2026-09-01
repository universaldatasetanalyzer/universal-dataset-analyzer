import React, { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, Zap } from 'lucide-react';
import { billingApi } from '../services/api';
import { openCheckout, PADDLE_PRICES, previewPrices } from '../services/paddle';
import { useStore } from '../store';

export interface Tier {
  name: 'Pro';
  description: string;
  features: string[];
  priceId: { month: string; year: string };
}

const TIERS: Tier[] = [
  { name: 'Pro', description: 'Full access to every Universal Dataset Analyzer feature.', features: ['Unlimited dataset uploads', 'Quality checks and cleaning', 'Visualizations and charts', 'AI insights and chat', 'Full report generation'], priceId: PADDLE_PRICES },
];

type BillingInterval = 'month' | 'year';
type DisplayPrice = { priceId: string; total: string };

export const BillingPage: React.FC = () => {
  const { authUser } = useStore();
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [prices, setPrices] = useState<Record<string, DisplayPrice>>({});
  const [countryCode, setCountryCode] = useState<string>();
  const [loadedInterval, setLoadedInterval] = useState<BillingInterval | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    billingApi.getCheckoutConfig()
      .then(config => previewPrices(TIERS.map(tier => tier.priceId[interval]), config.countryCode)
        .then(response => {
          if (!active) return;
          setCountryCode(config.countryCode);
          const nextPrices: Record<string, DisplayPrice> = {};
          response.data.details.lineItems.forEach(lineItem => {
            nextPrices[lineItem.price.id] = {
              priceId: lineItem.price.id,
              total: lineItem.formattedTotals.total,
            };
          });
          setPrices(nextPrices);
          setLoadedInterval(interval);
          setError('');
        }))
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load Paddle prices.');
      })
    return () => { active = false; };
  }, [interval]);

  const subscribe = async (tier: Tier) => {
    if (!authUser?.email) {
      setError('Please sign in before subscribing.');
      return;
    }
    const priceId = tier.priceId[interval];
    setBusyTier(tier.name);
    setError('');
    try {
      await openCheckout(priceId, authUser.email, authUser.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open Paddle Checkout.');
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <div className="max-w-6xl space-y-8">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2 text-brand-500 text-sm font-semibold uppercase tracking-[0.18em]"><Zap className="w-4 h-4" /> Plans</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold mt-3">Choose the pace of your analysis.</h1>
        <p className="text-surface-500 mt-3">Prices update for your location automatically.</p>
      </header>

      <div className="inline-flex rounded-xl bg-surface-100 dark:bg-surface-800 p-1" role="group" aria-label="Billing interval">
        {(['month', 'year'] as BillingInterval[]).map(option => (
          <button key={option} type="button" onClick={() => setInterval(option)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${interval === option ? 'bg-white dark:bg-surface-700 shadow-sm text-surface-900 dark:text-white' : 'text-surface-500'}`}>
            {option === 'month' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
      </div>

      {countryCode && <p className="text-xs text-surface-400">Showing localized pricing for {countryCode}.</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loadedInterval !== interval ? <div className="flex items-center gap-2 text-surface-500"><RefreshCw className="w-5 h-5 animate-spin" /> Loading live prices...</div> : (
        <div className="max-w-xl">
          {TIERS.map(tier => {
            const price = prices[tier.priceId[interval]];
            const busy = busyTier === tier.name;
            return <article key={tier.name} className="rounded-2xl border border-brand-400 shadow-lg shadow-brand-500/10 p-6 flex flex-col">
              <span className="self-start text-xs font-bold uppercase tracking-wider text-brand-500 mb-4">Complete plan</span>
              <h2 className="text-xl font-display font-bold">{tier.name}</h2>
              <p className="text-sm text-surface-500 mt-2 min-h-10">{tier.description}</p>
              <p className="text-4xl font-display font-bold mt-6">{price?.total || '—'}<span className="text-sm text-surface-400 font-normal">/{interval === 'month' ? 'mo' : 'yr'}</span></p>
              <ul className="space-y-3 mt-6 mb-8 flex-1">{tier.features.map(feature => <li key={feature} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{feature}</li>)}</ul>
              <button type="button" onClick={() => void subscribe(tier)} disabled={!price || busyTier !== null} className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-white py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Subscribe
              </button>
            </article>;
          })}
        </div>
      )}
    </div>
  );
};
