# OpenScout — Teknoloji ve Altyapı Raporu

Bu belge projede kullanılan teknolojileri, modelleri, servisleri ve yapılandırmaları özetler.

---

## 1. Proje Özeti

- **İsim:** OpenScout  
- **Versiyon:** 0.1.0  
- **Amaç:** Yapay zeka destekli iş arama ve mülakat hazırlık platformu (aday odaklı MVP).

---

## 2. Çalışma Ortamı ve Dil

| Öğe | Seçim |
|-----|--------|
| **Runtime** | Node.js |
| **Dil** | TypeScript 5.x |
| **Paket Yöneticisi** | npm |

---

## 3. Ana Çatı ve Kütüphaneler

### 3.1 Frontend / Full‑Stack

| Teknoloji | Versiyon | Kullanım |
|-----------|----------|----------|
| **Next.js** | 16.1.6 | App Router, SSR, API Routes, middleware |
| **React** | 19.2.3 | UI bileşenleri |
| **React DOM** | 19.2.3 | DOM render |

### 3.2 Stil ve UI

| Teknoloji | Versiyon | Kullanım |
|-----------|----------|----------|
| **Tailwind CSS** | ^4 | Utility-first CSS |
| **@tailwindcss/postcss** | ^4 | PostCSS entegrasyonu (Tailwind v4) |
| **Framer Motion** | ^11.11.0 | Sayfa ve bileşen animasyonları |
| **Lucide React** | ^0.468.0 | İkon seti |

### 3.3 Fontlar

- **Geist Sans** ve **Geist Mono** — `next/font/google` ile yükleniyor (`layout.tsx`).

### 3.4 Tema / CSS Değişkenleri

- `globals.css` içinde tanımlı:
  - `--background`, `--foreground`, `--primary`, `--primary-light`, `--primary-lighter`, `--primary-dark`, `--primary-muted`, `--border`, `--border-strong`, `--muted`, `--muted-foreground`
- Tailwind v4 `@theme inline` ile bu değişkenler tema renkleri ve fontlara bağlanıyor.

---

## 4. Yapay Zeka (OpenAI)

### 4.1 Kütüphane ve İstemci

- **openai** (npm): `^4.104.0`
- API anahtarı: `process.env.OPENAI_API_KEY` (sunucu tarafında; `.env.local`).

### 4.2 Kullanılan Model

Tüm AI özelliklerinde tek model kullanılıyor:

| Model | Kullanıldığı Yer |
|-------|-------------------|
| **gpt-4o** | CV analizi, mock mülakat sohbeti, mülakat değerlendirmesi |

- Ek parametre: CV analizi ve mülakat değerlendirmesinde `response_format: { type: "json_object" }` ile JSON yanıt zorunlu.

### 4.3 Kullanım Senaryoları

1. **CV Analizi** (`/api/cv-analysis`)
   - Girdi: CV metni (PDF/TXT’den çıkarılmış) + iş kategorisi.
   - Sistem rolü: HR uzmanı; verilen iş kategorisine göre CV değerlendirmesi.
   - Çıktı: `overall_score`, `category_scores` (professional_summary, work_experience, skills, education, online_presence, highlights), `strengths`, `improvements` (JSON).

2. **Mock Mülakat (Canlı Sohbet)** (`/api/mock-interview`)
   - Girdi: Kullanıcı mesajları dizisi + `jobCategory` + `userName`.
   - Sistem rolü: İş kategorisine göre mülakatçı; tek tek soru, kısa yanıt, İngilizce.
   - Çıktı: Serbest metin (sohbet); mülakat bitişinde "INTERVIEW_ENDED" + JSON (score, strengths, improvements).

3. **Mülakat Değerlendirmesi** (`/api/mock-interview/result`)
   - Girdi: Mülakat transkripti + `jobCategory`.
   - Sistem rolü: Mülakat değerlendirme uzmanı.
   - Çıktı: `score`, `strengths`, `improvements` (JSON).

---

## 5. Veritabanı ve Kimlik Doğrulama (Supabase)

### 5.1 Kütüphaneler

| Paket | Versiyon | Amaç |
|-------|----------|------|
| **@supabase/supabase-js** | ^2.45.0 | İstemci; auth + Postgres erişimi |
| **@supabase/ssr** | ^0.5.0 | Sunucu/SSR ve middleware için cookie tabanlı oturum |

### 5.2 Ortam Değişkenleri

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase proje URL’i  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon (public) anahtar  

(Örnek: `.env.local.example`)

### 5.3 Kullanım

- **Auth:** E-posta/şifre ile kayıt ve giriş; `auth.exchangeCodeForSession` ile callback.
- **İstemci türleri:**
  - Tarayıcı: `createBrowserClient` (`@/lib/supabase/client.ts`).
  - Sunucu: `createServerClient` + cookie store (`@/lib/supabase/server.ts`).
- **Middleware:** `@/lib/supabase/middleware.ts` — oturum yenileme; korumalı yollar (`/onboarding`, `/dashboard`, `/cv-analysis`, `/mock-interview`, `/jobs/[id]/apply`) ve auth sayfaları (`/login`, `/register`) yönlendirmesi.

### 5.4 Veritabanı Şeması (Özet)

- **profiles** — auth.users’a bağlı profil (ad, e-posta, konum, özet vb.)
- **work_experiences**, **educations**, **job_preferences**, **professional_links** — profil detayları
- **companies**, **job_listings** — şirket ve iş ilanları
- **cv_analyses** — CV analiz sonuçları (skor, kategoriler, güçlü/zayıf yönler)
- **mock_interviews** — mock mülakat oturumları (skor, rapor)
- **job_applications** — başvurular (cv_score, interview_score, status)

RLS (Row Level Security) tüm bu tablolarda açık; politikalar kullanıcı bazlı (kendi verisi) veya public read (companies, job_listings).

---

## 6. Dosya ve Metin İşleme

- **pdf-parse** (^1.1.4): PDF’den metin çıkarma (CV yükleme).
- Desteklenen formatlar: PDF, TXT.
- Limit: 10 MB (`MAX_FILE_BYTES`).
- DOC/DOCX desteklenmiyor (kod ve hata mesajında belirtilmiş).

---

## 7. Tarayıcı API’leri (Mock Mülakat)

Ses tabanlı mock mülakat için sadece tarayıcı API’leri kullanılıyor (harici ses SDK’sı yok):

| API | Kullanım |
|-----|----------|
| **Web Speech API – SpeechRecognition** | Kullanıcı sesini metne çevirme (Chrome: `webkitSpeechRecognition`) |
| **Web Speech API – SpeechSynthesis** | AI yanıtlarını sesli okuma |
| **navigator.mediaDevices.getUserMedia({ audio: true })** | Mikrofon izni |

Not: Bu API’ler tüm tarayıcılarda yok (özellikle Firefox/Safari’de sınırlı); Chrome’da en uyumlu.

---

## 8. Geliştirme ve Kalite Araçları

| Araç | Versiyon | Görev |
|------|----------|--------|
| **TypeScript** | ^5 | Tip kontrolü |
| **ESLint** | ^9 | Lint |
| **eslint-config-next** | 16.1.6 | Next.js + TypeScript kuralları (core-web-vitals, typescript) |
| **@types/node** | ^20 | Node tip tanımları |
| **@types/react** / **@types/react-dom** | ^19 | React tip tanımları |

---

## 9. Yapılandırma Dosyaları

| Dosya | İçerik |
|-------|--------|
| **next.config.ts** | Varsayılan Next config (ek seçenek yok) |
| **postcss.config.mjs** | `@tailwindcss/postcss` eklentisi |
| **eslint.config.mjs** | ESLint flat config; next vitals + TypeScript; .next, out, build ignore |
| **.env.local.example** | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY |

Tailwind için ayrı `tailwind.config.js` yok; v4 ile `globals.css` ve `@theme inline` kullanılıyor.

---

## 10. Özet Tablo: Teknoloji ve Modeller

| Kategori | Teknoloji / Model |
|----------|-------------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, Framer Motion 11, Lucide React |
| Dil | TypeScript 5 |
| AI | OpenAI API, model: **gpt-4o** (Chat Completions) |
| Backend / DB / Auth | Supabase (Postgres, Auth, RLS) |
| PDF | pdf-parse |
| Ses (tarayıcı) | Web Speech API (SpeechRecognition, SpeechSynthesis), getUserMedia |
| Font | Geist Sans, Geist Mono (Next.js Google Fonts) |
| Lint | ESLint 9 + eslint-config-next |

Bu rapor, projedeki teknoloji ve model kullanımının anlık görüntüsüdür; versiyonlar `package.json` güncellendiğinde değişebilir.
