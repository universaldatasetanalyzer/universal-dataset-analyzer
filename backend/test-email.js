#!/usr/bin/env node
/**
 * Email Configuration Test Script
 * Checks the Resend configuration without sending an email.
 */

require('dotenv').config();

console.log('\n════════════════════════════════════════════════════════════════');
console.log('           UNIVERSAL DATASET ANALYZER - EMAIL TEST');
console.log('════════════════════════════════════════════════════════════════\n');

// 1. تحقق من البيئة
console.log('🔍 CHECKING ENVIRONMENT VARIABLES...\n');
const required = ['RESEND_API_KEY', 'EMAIL_FROM'];
let allSet = true;

for (const env of required) {
  const value = process.env[env];
  if (!value) {
    console.log(`❌ ${env}: NOT SET`);
    allSet = false;
  } else {
    console.log(`✓ ${env}: ${env === 'RESEND_API_KEY' ? '[configured]' : value}`);
  }
}

if (!allSet) {
  console.log('\n❌ Resend configuration is incomplete.');
  console.log('   Please check your .env file in backend directory\n');
  process.exit(1);
}

console.log('\n────────────────────────────────────────────────────────────────\n');

// 2. Configuration check only. Sending is exercised by the application flows.
console.log('✓ Resend configuration is present.\n');
process.exit(0);
