import React, { useState } from 'react';
import { ArrowLeft, Lock, CreditCard, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '../components/ui';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interval = searchParams.get('interval') === 'yearly' ? 'yearly' : 'monthly';
  const [completed, setCompleted] = useState(false);

  const price = interval === 'yearly' ? '$96' : '$10';
  const period = interval === 'yearly' ? 'year' : 'month';

  if (completed) {
    return (
      <div className="max-w-lg mx-auto py-10">
        <Card className="p-8 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500 mb-4" />
          <h1 className="text-2xl font-display font-bold">Payment completed</h1>
          <p className="text-sm text-surface-500 mt-2">
            This is a development checkout. Connect valid Paddle credentials to process real payments.
          </p>
          <Button className="mt-6" onClick={() => navigate('/billing')}>
            Return to Billing
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <button
        type="button"
        onClick={() => navigate('/billing')}
        className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Billing
      </button>

      <div className="grid md:grid-cols-[1fr_280px] gap-5">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">Complete your purchase</h1>
              <p className="text-xs text-surface-500">Secure development checkout</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input label="Cardholder name" placeholder="Your name" />
            <Input label="Card number" placeholder="4242 4242 4242 4242" inputMode="numeric" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Expiry date" placeholder="MM / YY" />
              <Input label="CVC" placeholder="123" inputMode="numeric" />
            </div>
          </div>

          <Button className="w-full mt-6" icon={<Lock className="w-4 h-4" />} onClick={() => setCompleted(true)}>
            Pay {price}
          </Button>
          <p className="text-xs text-center text-surface-400 mt-3">No real charge is made in development mode.</p>
        </Card>

        <Card className="p-6 h-fit">
          <p className="text-xs uppercase tracking-wide text-surface-500">Order summary</p>
          <div className="flex items-center justify-between mt-4">
            <span className="font-semibold">Pro Plan</span>
            <span className="font-display font-bold">{price}</span>
          </div>
          <p className="text-xs text-surface-500 mt-1">Billed every {period}</p>
          <div className="border-t border-surface-200 dark:border-surface-800 mt-5 pt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{price}</span>
          </div>
        </Card>
      </div>
    </div>
  );
};
