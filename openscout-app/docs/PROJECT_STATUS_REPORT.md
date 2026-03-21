# OpenScout — Proje Genel Durum Raporu

*Son güncelleme: Proje yapısı ve mevcut koda göre derlendi.*

---

## 1. Proje Özeti

**OpenScout**, AI destekli iş arama ve mülakat hazırlık platformu. Adaylar CV analizi ve yapay zeka mülakatı yapıyor; işverenler ilan açıp yalnızca “Scout-vetted” (CV + mülakat tamamlamış) adayların başvurularını görüyor. Ücretli planda sınırsız ilan ve başvuru detayları sunuluyor.

| Öğe | Değer |
|-----|--------|
| **Stack** | Next.js 16, React 19, TypeScript, Tailwind v4, Supabase, Groq (LLM), Stripe |
| **Versiyon** | 0.1.0 |
| **Migration sayısı** | 11 (001–011) |

---

## 2. Neler Çalışıyor?

### 2.1 Kimlik ve Erişim
- **Kayıt / Giriş:** Supabase Auth (email + şifre), e-posta yönlendirme.
- **Middleware:** Korunan path’ler (`/dashboard`, `/onboarding`, `/cv-analysis`, `/mock-interview`, `/employer`, `/jobs/.../apply`) giriş zorunlu; e-posta doğrulanmamışsa `/confirm-email`’e yönlendirme.
- **Confirm email:** `/confirm-email` sayfası ve “Resend confirmation email” akışı mevcut.

### 2.2 Aday Akışı
- **Onboarding:** 5 adımlı profil (About, Work Experience, Education, Job Preferences, Links); Dashboard’da tamamlanma göstergesi.
- **CV analizi:** PDF/TXT yükleme, Groq ile role göre skor + rapor, `cv_analyses` ve isteğe bağlı `job_id` ile kayıt.
- **Mock mülakat:** Kategori seçimi, mikrofön testi, sesli mülakat (Web Speech API + TTS), Groq ile değerlendirme; sonuç `mock_interviews`’e (ve varsa `job_id`) yazılıyor.
- **İlan listesi ve detay:** `/jobs`, `/jobs/[jobId]` — sadece `is_active = true` ilanlar.
- **Başvuru:** `/jobs/[jobId]/apply` — sadece aktif ilanlar; CV skoru (önce `job_id`, yoksa `job_category`) ve mock mülakat zorunlu; “Job not found” / inactive için net mesaj.

### 2.3 İşveren Akışı
- **Şirket:** Tek şirket oluşturma, isim düzenleme.
- **İlanlar:** Oluşturma, düzenleme, aktif/pasif, `min_cv_score`, `ai_interview_config` (custom questions, cv_required_items).
- **Kota:** Free tier’da 1 ilan (trigger: `009_employer_listing_limit`); abonelikle sınırsız.
- **Abonelik:** Stripe Checkout, webhook (`subscription.updated/deleted`, `checkout.session.completed`), `verify-session` ile aktivasyon; hata durumunda UI’da mesaj + retry.
- **Checkout:** Opsiyonel `company_id` ile doğru şirkete abonelik; pricing sayfasında şirket yoksa “Create a company first” CTA.
- **Başvurular:** Sadece `stripe_subscription_status = 'active'` olan şirketler başvuru listesi/detay görebiliyor (RLS: `010_employer_applications_subscriber_only`); değilse “Upgrade to Growth” mesajı.

### 2.4 Scout Pass (Credential)
- Paylaşılabilir credential; `/pass/[slug]` ve `/api/scout-pass/[slug]` — `SUPABASE_SERVICE_ROLE_KEY` ile public okuma.

### 2.5 Referral
- `?ref=CODE` ile davet; `/api/referral/attribute` — ilk atıf kazanır (üzerine yazılmıyor); my-code API.

### 2.6 Altyapı
- **API’ler:** Auth zorunlu (cv-analysis, mock-interview, mock-interview/result, job-applications); job-applications CV skorunu yalnızca DB’den (`cv_analyses`) alıyor.
- **Veritabanı:** 11 migration; RLS, trigger’lar, `job_id` (cv_analyses, mock_interviews) ile ilan bazlı eşleştirme.

---

## 3. Neler Çalışmıyor / Bilinen Riskler

### 3.1 İş Mantığı / UX
- **Job title vs kategori uyumsuzluğu:** İşveren formu `JOB_TITLES` (örn. "Java Developer", "UX Designer", "İnsan Kaynakları", "Diğer") kullanıyor; mock interview sayfası farklı bir `JOB_CATEGORIES` listesi kullanıyor ("Pazarlama Uzmani", "Finans Uzmani" vb.). CV analizi sayfası `JOB_TITLES` ile aynı. Apply tarafında eşleşme `job_title` / `job_category` ve `job_id` ile yapılıyor. “Java Developer” gibi sadece employer tarafta olan bir başlıkla ilan açılırsa, aday apply sayfasında bu ilan için kategori seçip CV/mülakat yapabiliyor (çünkü CV analizi `JOB_TITLES` kullanıyor). Mock interview’da ise “Java Developer” seçeneği yok; aday farklı bir kategoriyle mülakat yaparsa başvuru akışında `job_id` veya `job_category` eşleşmesi tutarsız olabilir. **Öneri:** Tek merkezi liste (örn. `jobFormOptions.JOB_TITLES`) kullanılmalı; mock interview ve CV analizi aynı listeyle senkron olmalı.
- **Mock interview sonuç sayfası:** Skor ve rapor hâlâ URL query’den okunuyor; link manipüle edilerek sahte skor gösterilebilir. Credential DB’den üretildiği için güvenilir; sadece sonuç *gösterimi* URL’e güveniyor. **Öneri:** Sonucu `sessionId` veya kullanıcı + job’a göre sunucudan çekip göstermek.
- **Login redirect:** `redirect` parametresi `startsWith("/")` ile kontrol ediliyor; `//evil.com` gibi protocol-relative URL’lere izin verilebilir (open redirect). **Öneri:** `//` ile başlayanları reddetmek veya sadece tek `/` ile başlayan path’lere izin vermek.

### 3.2 Eksik / Opsiyonel
- **Rate limit:** Upstash tabanlı limitler birçok API’de aktif (başvuru, CV analizi, mülakat, TTS, checkout, webhook, işveren başvuru güncelleme, public profil linki vb.); üretimde `UPSTASH_REDIS_*` tanımlı olmalı.
- **Scout Pass:** İptal / süre sonu yok; link ömür boyu geçerli.
- **Abonelik sonrası ilan sayısı:** Abonelik iptal edilince mevcut ilanlar silinmiyor; sadece yeni ilan ekleme 1 ile sınırlı (bilinçli tasarım, dokümante edilmeli).

### 3.3 Ortam ve Dokümantasyon
- **README:** `OPENAI_API_KEY` yazıyor; proje CV ve mülakat için **Groq** kullanıyor. **Öneri:** README’de `GROQ_API_KEY` belirtmek.
- **.env örneği:** `.env.local.example` veya benzeri yok; gerekli env değişkenleri README ve TECHNOLOGY_REPORT’ta dağınık.

---

## 4. Eksikler

| Kategori | Eksik |
|----------|--------|
| **Test** | Unit / entegrasyon / E2E testi yok; `package.json`’da test script’i tanımlı değil. |
| **Env** | `.env.example` veya `.env.local.example` yok (NEXT_PUBLIC_SUPABASE_*, GROQ_API_KEY, STRIPE_*, SUPABASE_SERVICE_ROLE_KEY). |
| **Error sınırları** | Global error boundary veya API hata formatı standardı tanımlı değil. |
| **Loading** | Bazı sayfalarda tutarlı loading/skeleton yok. |
| **i18n** | Türkçe/İngilizce karışık metinler; tek dil veya i18n yapısı yok. |
| **Erişilebilirlik** | ARIA, klavye, ekran okuyucu için sistematik kontrol yok. |
| **Monitoring** | Hata takibi / analytics entegrasyonu yok. |

---

## 5. Fazlalar / Teknik Borç

- **İki risk raporu:** `.agent/PROJECT_RISK_REPORT.md` ve `docs/PROJECT_RISK_MISSING_FEATURE_REPORT.md` — biri daha güncel (düzeltmeler sonrası), diğeri eski maddeler içeriyor; birleştirilip tek “Known issues & roadmap” dokümanı yapılabilir.
- **TECHNOLOGY_REPORT.md:** OpenAI’dan bahsediyor; gerçekte Groq kullanılıyor; güncellenmeli.
- **Mock interview `JOB_CATEGORIES`:** `jobFormOptions.JOB_TITLES` ile aynı liste kullanılırsa tek kaynak olur; şu an iki ayrı liste.

---

## 6. Sıradaki Adımlar (Öncelik Sırasıyla)

1. **Kritik:**  
   - Login redirect’i güvenli hale getir (`//` ve protocol-relative URL’leri kabul etme).  
   - Job title / kategori listesini tek kaynakta topla (JOB_TITLES); mock interview ve CV analizi bu listeyi kullansın.  
   - Mock interview sonuç sayfasında skor/raporu sunucudan (session veya user+job) al, URL’i sadece yönlendirme için kullan.

2. **Dokümantasyon:**  
   - README’de `GROQ_API_KEY` ve isteğe bağlı env’leri yaz; `.env.local.example` ekle.  
   - TECHNOLOGY_REPORT’u Groq’a göre güncelle.  
   - Risk raporlarını tek dokümanda topla veya “Known issues” bölümüne taşı.

3. **Kalite:**  
   - En azından kritik API’ler (job-applications, cv-analysis, auth) için basit entegrasyon veya E2E testi ekle.  
   - Lint/type-check’i CI’da çalıştır (varsa).

4. **Ürün:**  
   - Scout Pass için opsiyonel süre sonu/revoke değerlendirmesi.  
   - Global error boundary ve tutarlı hata/loading UX.

---

## 7. Tamamlanma Tahmini

| Alan | Ağırlık | Durum | Not |
|------|---------|--------|-----|
| Auth & erişim | %10 | ~%95 | Confirm email, middleware, RLS tamam. |
| Aday akışı (profil, CV, mülakat, başvuru) | %30 | ~%85 | Akış çalışıyor; kategori/liste uyumu ve sonuç sayfası güvenliği eksik. |
| İşveren (şirket, ilan, abonelik, başvurular) | %25 | ~%90 | Checkout, webhook, RLS, limit, hata mesajları uygulanmış. |
| Scout Pass & Referral | %10 | ~%85 | Çalışıyor; rate limit ve pass revoke/expiry yok. |
| Marketing (landing, blog, pass sayfası) | %5 | ~%90 | Sayfalar mevcut. |
| Altyapı (API, DB, güvenlik) | %10 | ~%80 | Auth, RLS, job_id; open redirect ve sonuç sayfası kaldı. |
| Test, dokümantasyon, ops | %10 | ~%25 | Test yok, env örneği yok, raporlar dağınık. |

**Genel tamamlanma (ağırlıklı):** yaklaşık **%78–82**.

---

## 8. Özet

- **Çalışan:** Aday ve işveren ana akışları (kayıt, profil, CV analizi, mock mülakat, ilanlar, başvuru, abonelik, başvuru listesi), Scout Pass, referral, e-posta doğrulama ve abonelik hata yönetimi.
- **Eksik / risk:** Job title–kategori tek listesi, mock sonuç sayfasının sunucudan beslenmesi, login open redirect, testler, .env örneği, README/TECHNOLOGY_REPORT güncellemesi.
- **Sıradaki adımlar:** Güvenlik (redirect, sonuç sayfası) ve liste birleştirme → dokümantasyon ve env örneği → test ve kalite.

Bu rapor, mevcut kod ve dokümanlara göre hazırlanmıştır; canlı ortamda mutlaka bir kez daha doğrulanmalıdır.
