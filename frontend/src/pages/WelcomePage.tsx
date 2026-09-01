import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const WelcomePage: React.FC = () => (
  <div className="max-w-xl py-12 text-center mx-auto">
    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
    <h1 className="text-3xl font-display font-bold mt-5">Welcome aboard</h1>
    <p className="text-surface-500 mt-2">Your Paddle checkout is complete. Your workspace will update as soon as the subscription webhook arrives.</p>
    <Link to="/dashboard" className="btn-primary inline-flex mt-6 px-5 py-2 text-sm">
      Go to dashboard
    </Link>
  </div>
);
