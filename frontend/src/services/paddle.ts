import { initializePaddle, type Paddle, type PricePreviewResponse } from '@paddle/paddle-js';

const environment = import.meta.env.VITE_PADDLE_ENV;
const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

if (!environment) throw new Error('VITE_PADDLE_ENV is required.');
if (!clientToken) throw new Error('VITE_PADDLE_CLIENT_TOKEN is required.');
if (!['sandbox', 'production'].includes(environment)) {
  throw new Error('VITE_PADDLE_ENV must be sandbox or production.');
}
if (environment === 'sandbox' && !clientToken.startsWith('test_')) {
  throw new Error('Sandbox Paddle client tokens must start with test_.');
}

let paddlePromise: Promise<Paddle | undefined> | undefined;

export const PADDLE_PRICES = {
  month: import.meta.env.VITE_PADDLE_PRICE_MONTHLY,
  year: import.meta.env.VITE_PADDLE_PRICE_YEARLY,
} as const;

if (!PADDLE_PRICES.month || !PADDLE_PRICES.year) throw new Error('Monthly and yearly Paddle price IDs are required.');

export async function getPaddle(): Promise<Paddle> {
  paddlePromise ??= initializePaddle({
    environment,
    token: clientToken,
    debug: import.meta.env.DEV,
    eventCallback: event => {
      if (event.name === 'checkout.error' || event.name === 'checkout.failed') {
        console.error('[Paddle]', event);
      }
    },
  });
  const paddle = await paddlePromise;
  if (!paddle) throw new Error('Paddle.js could not be initialized.');
  return paddle;
}

export async function previewPrices(priceIds: string[], countryCode?: string): Promise<PricePreviewResponse> {
  const paddle = await getPaddle();
  return paddle.PricePreview({
    items: priceIds.map(priceId => ({ priceId, quantity: 1 })),
    ...(countryCode ? { address: { countryCode } } : {}),
  });
}

export async function openCheckout(transactionId: string): Promise<void> {
  const paddle = await getPaddle();
  paddle.Checkout.open({
    transactionId,
    settings: {
      displayMode: 'overlay',
      variant: 'one-page',
      successUrl: `${window.location.origin}/dashboard`,
    },
  });
}
