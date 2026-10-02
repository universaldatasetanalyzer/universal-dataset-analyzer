import React from 'react';
import { Link } from 'react-router-dom';

const LegalPage: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <main className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 px-6 py-16">
    <article className="max-w-3xl mx-auto bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-8 md:p-12">
      <Link to="/" className="text-brand-500 text-sm font-medium">Universal Analyzer</Link>
      <h1 className="text-3xl font-display font-bold mt-6 mb-8">{title}</h1>
      <div className="space-y-6 text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{children}</div>
    </article>
  </main>
);

export const PrivacyPage: React.FC = () => (
  <LegalPage title="Privacy Policy">
    <p>Universal Analyzer stores account information and datasets so the service can provide analysis, cleaning, visualizations, and downloads.</p>
    <h2 className="font-semibold text-lg text-surface-900 dark:text-surface-100">Uploaded data</h2>
    <p>Uploaded files are private to your account or authorized workspace members. Files are retained while the dataset exists and may be removed when you delete the dataset. Early-stage storage and retention limits may change as the service develops.</p>
    <h2 className="font-semibold text-lg text-surface-900 dark:text-surface-100">AI processing</h2>
    <p>When AI insights or dataset chat are used, limited dataset metadata and samples may be sent to the configured AI provider. Do not upload sensitive information unless you have permission and accept this processing.</p>
    <h2 className="font-semibold text-lg text-surface-900 dark:text-surface-100">Your choices</h2>
    <p>You can delete datasets from the application. For deletion or privacy questions, contact support through the address configured by the service operator. This early-stage policy should be reviewed by qualified legal counsel before commercial launch.</p>
  </LegalPage>
);

export const TermsPage: React.FC = () => (
  <LegalPage title="Terms of Service">
    <p>Universal Analyzer is provided as an early-stage data analysis service. You are responsible for the files you upload and must have the rights and permissions required to process them.</p>
    <p>Do not use the service for unlawful activity, harmful content, or decisions requiring regulated professional advice. AI-generated text is informational and should be reviewed before use.</p>
    <p>Features, limits, storage, and availability may change during the beta period. Paid subscriptions are governed by the billing terms shown at checkout. These terms should be reviewed by qualified legal counsel before commercial launch.</p>
  </LegalPage>
);

export const SupportPage: React.FC = () => (
  <LegalPage title="Support">
    <p>Need help with an upload, analysis, report, or account? Contact the service operator using the support email configured for this deployment.</p>
    <p>When reporting a problem, include the affected feature, approximate time, and dataset ID if available. Do not send private dataset contents in a support message unless requested through an approved channel.</p>
  </LegalPage>
);
