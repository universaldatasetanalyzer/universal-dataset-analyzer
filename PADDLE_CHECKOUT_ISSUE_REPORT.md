# تقرير مشكلة Paddle Checkout

## 1. ملخص المشكلة

عند الضغط على زر `Subscribe` تظهر نافذة Paddle برسالة:

> Something went wrong

المشكلة تحدث أثناء فتح نافذة الدفع، قبل إتمام عملية الدفع وقبل وصول أي Webhook إلى الـ backend.

## 2. النتيجة الفنية

السبب الأرجح هو عدم ضبط **Default payment link** في حساب Paddle Sandbox، أو ضبطه على نطاق مختلف عن نطاق التطبيق المحلي.

السبب ليس غالبًا:

- تسجيل الدخول.
- قاعدة البيانات.
- خدمة الـ backend الخاصة بالاشتراك.
- خطأ في TypeScript أو Vite.

## 3. الأدلة من الكود

### الواجهة الأمامية

في `frontend/src/services/paddle.ts` يتم فتح Checkout مباشرة باستخدام Paddle.js:

```ts
paddle.Checkout.open({
  items: [{ priceId, quantity: 1 }],
  customer: { email },
  customData: { userId },
  settings: {
    displayMode: 'overlay',
    variant: 'one-page',
    successUrl: `${window.location.origin}/welcome`,
  },
});
```

هذا يعني أن نافذة الخطأ صادرة من Paddle.js، وليس من endpoint داخل الـ backend.

### الأسعار والبيئة

الملف `frontend/.env` يستخدم:

- البيئة: `sandbox`
- Client token يبدأ بـ `test_`
- Price IDs خاصة بالـ Sandbox

كما أن صفحة Billing نجحت في تحميل الأسعار وعرضها. هذا يؤكد أن التهيئة الأساسية والـ price IDs تعمل.

### فحص البناء

تم تشغيل:

```powershell
Set-Location frontend
npm run build
```

والنتيجة كانت ناجحة بدون أخطاء TypeScript أو Vite.

## 4. مكان الإصلاح

من لوحة Paddle Sandbox:

1. افتح حساب Paddle Sandbox.
2. اذهب إلى:
   `Paddle > Checkout > Checkout settings`
3. اضبط حقل **Default payment link** على:
   `http://localhost:5173`
4. احفظ الإعدادات.
5. أعد تشغيل Vite والـ backend.
6. افتح صفحة Billing واضغط `Subscribe` مرة أخرى.

Paddle يشترط وجود Default payment link لكي يعمل Checkout، حتى عند استخدام Overlay Checkout.

## 5. اختبار الدفع في Sandbox

بعد فتح Checkout استخدم بيانات الاختبار الخاصة بـ Paddle Sandbox، مثل:

- Card number: `4242 4242 4242 4242`
- Security code: `100`
- تاريخ انتهاء صالح في المستقبل
- بريد إلكتروني صالح

## 6. مشكلة ثانية محتملة بعد نجاح الدفع

يوجد Webhook في:

```text
backend/.env
```

وقيمته الحالية تعتمد على رابط `loca.lt`. إذا كان الرابط متوقفًا أو غير قابل للوصول من Paddle، فقد يحدث الآتي:

- الدفع ينجح في Paddle.
- لكن خطة المستخدم لا تتحول إلى Pro داخل التطبيق.
- لا يتم تحديث جدول `subscriptions`.

يجب استخدام رابط public متاح دائمًا، ثم تسجيله كـ Notification destination في Paddle، مثل:

```text
https://your-public-domain.example/api/billing/webhook
```

ويجب التأكد من أن endpoint يعيد HTTP status `200` بعد التحقق من توقيع Paddle.

## 7. ترتيب معالجة المشكلة

1. ضبط Default payment link في Paddle Sandbox.
2. إعادة تشغيل التطبيق وتجربة فتح Checkout.
3. إذا فتح Checkout، تنفيذ عملية دفع اختبارية.
4. فحص وصول Webhook إلى:
   `/api/billing/webhook`
5. التأكد من تحديث الاشتراك إلى `pro` في قاعدة البيانات.
6. التأكد من ظهور صلاحيات Pro داخل التطبيق.

## 8. إجراءات الأمان

ملفات البيئة تحتوي على بيانات حساسة مثل مفاتيح Paddle وGoogle وSMTP وقاعدة البيانات. يجب تغيير أو إلغاء هذه البيانات وإصدار بيانات جديدة، خصوصًا:

- `PADDLE_API_KEY`
- `PADDLE_NOTIFICATION_SIGNING_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_PASS`
- كلمة مرور قاعدة البيانات

يجب كذلك عدم رفع ملفات `.env` إلى Git أو مشاركتها علنًا.

## الخلاصة

الكود الحالي الخاص بفتح Paddle Checkout يتم تجميعه بنجاح والأسعار يتم تحميلها بشكل صحيح. الإصلاح الأول المطلوب هو ضبط **Default payment link** داخل Paddle Sandbox على `http://localhost:5173`. بعد ذلك يجب معالجة رابط الـ Webhook حتى يتم تفعيل Pro داخل التطبيق بعد نجاح الدفع.
