#!/usr/bin/env node
/**
 * Email Configuration Test Script
 * يساعدك تختبر إن SMTP config بتاعك صحيح
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('           UNIVERSAL DATASET ANALYZER - EMAIL TEST');
console.log('════════════════════════════════════════════════════════════════\n');

// 1. تحقق من البيئة
console.log('🔍 CHECKING ENVIRONMENT VARIABLES...\n');
const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
let allSet = true;

for (const env of required) {
  const value = process.env[env];
  if (!value) {
    console.log(`❌ ${env}: NOT SET`);
    allSet = false;
  } else {
    if (env === 'SMTP_PASS') {
      console.log(`✓ ${env}: SET (${value.length} chars)`);
    } else if (env === 'SMTP_USER') {
      console.log(`✓ ${env}: ${value}`);
    } else {
      console.log(`✓ ${env}: ${value}`);
    }
  }
}

if (!allSet) {
  console.log('\n❌ Some SMTP variables are missing!');
  console.log('   Please check your .env file in backend directory\n');
  process.exit(1);
}

console.log('\n────────────────────────────────────────────────────────────────\n');

// 2. حاول الاتصال
console.log('🔌 TESTING SMTP CONNECTION...\n');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify()
  .then(() => {
    console.log('✓ SMTP Connection VERIFIED!\n');
    console.log('Configuration Details:');
    console.log(`  Host: ${process.env.SMTP_HOST}`);
    console.log(`  Port: ${process.env.SMTP_PORT}`);
    console.log(`  Secure: ${process.env.SMTP_SECURE === 'true' ? 'YES (TLS)' : 'NO'}`);
    console.log(`  User: ${process.env.SMTP_USER}\n`);
    
    console.log('════════════════════════════════════════════════════════════════');
    console.log('✓ All checks passed! Your email configuration should work.');
    console.log('════════════════════════════════════════════════════════════════\n');
    
    console.log('NEXT STEPS:');
    console.log('1. Start your backend server');
    console.log('2. Use the test email endpoint: POST /api/team/test-email');
    console.log('3. Send JSON: { "email": "your-email@example.com" }\n');
    
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ SMTP Connection FAILED!\n');
    console.log('Error Details:');
    console.log(`  Code: ${error.code}`);
    console.log(`  Message: ${error.message}\n`);
    
    // أعطِ نصائح
    console.log('TROUBLESHOOTING:\n');
    
    if (error.code === 'ENOTFOUND') {
      console.log('  Problem: Cannot find SMTP host');
      console.log('  Solution: Check SMTP_HOST value in .env (usually smtp.gmail.com)\n');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('  Problem: Connection refused');
      console.log('  Solution: Check port number (587 for Gmail without SSL)\n');
    } else if (error.message.includes('Invalid login')) {
      console.log('  Problem: Invalid email or password');
      console.log('  Solution:');
      console.log('    - For Gmail: Use an App Password, not your regular password');
      console.log('    - Generate one at: https://myaccount.google.com/apppasswords\n');
    } else if (error.message.includes('535')) {
      console.log('  Problem: Authentication failed');
      console.log('  Solution:');
      console.log('    - Check SMTP_USER and SMTP_PASS are correct');
      console.log('    - For Gmail: Enable 2-Step Verification first');
      console.log('    - Then generate App Password\n');
    }
    
    console.log('════════════════════════════════════════════════════════════════');
    console.log('CURRENT CONFIGURATION:');
    console.log(`  Host: ${process.env.SMTP_HOST}`);
    console.log(`  Port: ${process.env.SMTP_PORT}`);
    console.log(`  Secure: ${process.env.SMTP_SECURE}`);
    console.log(`  User: ${process.env.SMTP_USER}`);
    console.log('════════════════════════════════════════════════════════════════\n');
    
    process.exit(1);
  });
