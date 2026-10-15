# موقع هدية عيد ميلاد ملك

موقع عربي متجاوب للموبايل والكمبيوتر، بتصميم برجندي هادئ ومشاعر بسيطة، ومعرض صور تُدار إضافته من لوحة تحكم خاصة. النسخة تستخدم استضافة ثابتة مجانية للموقع وSupabase لتسجيل الدخول وحفظ الصور والبيانات أونلاين.

## الملفات
- `index.html` الصفحة الرئيسية.
- `style.css` التصميم المتجاوب.
- `app.js` معرض الصور ولوحة التحكم.
- `config.js` بيانات الاتصال التي ستضيفها بعد إنشاء مشروع Supabase.

## 1) إعداد التخزين المجاني على Supabase
1. أنشئ مشروعًا على https://supabase.com/ (الخطة المجانية تكفي عادةً لمشروع شخصي صغير؛ راجع حدود الخطة الحالية).
2. من **Project Settings → API** انسخ Project URL ومفتاح **publishable** أو `anon` العام. ضع القيم في `config.js`. لا تستخدم `service_role` أو أي مفتاح سري داخل ملفات الموقع.
3. من **SQL Editor** شغّل SQL التالي:

```sql
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'ذكرى جميلة',
  caption text not null default '',
  photo_path text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.memories enable row level security;

-- أي زائر يقدر يشوف الصور والذكريات فقط
create policy "Public can view memories"
on public.memories for select
to anon, authenticated
using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('malak-photos', 'malak-photos', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608;

create policy "Public can view birthday photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'malak-photos');
```

**مهم:** في البداية، لا توجد صلاحيات رفع أو حذف لأي مستخدم. بعد إنشاء حسابك في الخطوة التالية، انسخ UUID الخاص بحسابك من Supabase → Authentication → Users، ثم شغّل SQL التالي بعد استبدال `YOUR_USER_UUID` بمعرّف حسابك الحقيقي. هذا يجعل إدارة الصور مقتصرة على حسابك:

```sql
create policy "Only my account can insert memories"
on public.memories for insert to authenticated
with check (auth.uid() = 'YOUR_USER_UUID'::uuid and auth.uid() = owner_id);

create policy "Only my account can delete memories"
on public.memories for delete to authenticated
using (auth.uid() = 'YOUR_USER_UUID'::uuid);

create policy "Only my account can upload photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'malak-photos'
  and auth.uid() = 'YOUR_USER_UUID'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Only my account can delete photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'malak-photos'
  and auth.uid() = 'YOUR_USER_UUID'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## 2) إنشاء حساب لوحة التحكم
من Supabase → **Authentication → Users → Add user** أنشئ مستخدمًا ببريدك وكلمة مرور قوية. لو طبّقت سياسات «Only my account»، استخدم UUID لهذا الحساب بالضبط. لا تضع كلمة المرور في ملفات الموقع.

## 3) نشر الموقع مجانًا باستخدام GitHub Pages
1. أنشئ حسابًا على https://github.com/ ثم مستودعًا جديدًا (Repository).
2. ارفع الملفات الأربعة `index.html`, `style.css`, `app.js`, `config.js` إلى المستودع.
3. افتح **Settings → Pages** واختر النشر من الفرع `main` والمجلد `/ (root)` ثم احفظ.
4. سيظهر رابط عام للموقع. افتحه على الموبايل والكمبيوتر واختبره.
5. جرّب لوحة التحكم وسجّل الدخول بحسابك، ثم ارفع صورة اختبارية.

## ملاحظات
- رابط الموقع عام، والصور التي ترفعها ستظهر لأي شخص يفتح الصفحة؛ لا ترفع صورًا خاصة لا تريد مشاركتها. لوحة التحكم نفسها تتطلب تسجيل الدخول.
- المفتاح العام في `config.js` طبيعي لتطبيقات المتصفح؛ الحماية الفعلية من خلال سياسات RLS أعلاه.
- لا يمكنني إنشاء حسابات Supabase أو GitHub أو نشر الموقع داخل حساباتك بدلًا منك من هنا، لكن أقدر أمشي معك خطوة بخطوة.
- لأن صور المعرض عامة، لا تستخدم صورًا حساسة أو شخصية جدًا. لو أردت صورًا خاصة لا يراها إلا من لديه صلاحية، نحتاج تحويل التخزين إلى خاص وإضافة روابط موقعة.
