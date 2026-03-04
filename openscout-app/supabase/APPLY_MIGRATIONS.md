# Supabase migrations

Kayıt (sign up) sırasında hata alıyorsanız, migration’ların Supabase projenizde çalıştırıldığından emin olun.

## Seçenek 1: Supabase Dashboard SQL Editor

1. [Supabase Dashboard](https://supabase.com/dashboard) → Projenizi seçin  
2. **SQL Editor** menüsüne gidin  
3. Migration dosyalarını sırayla çalıştırın:
   - `migrations/001_initial_schema.sql` → Tamamını kopyalayıp çalıştırın  
   - `migrations/002_seed_demo.sql` → Tamamını kopyalayıp çalıştırın  
   - `migrations/003_fix_handle_new_user.sql` → Trigger’ı düzeltmek için çalıştırın  

Özellikle **003** numaralı migration, “Database error saving new user” benzeri kayıt hatalarını giderir.

## Seçenek 2: Supabase CLI

```bash
npx supabase link --project-ref kjadbgenacovvskhxwsc
npx supabase db push
```
