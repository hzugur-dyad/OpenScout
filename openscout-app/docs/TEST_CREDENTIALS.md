# Test hesabı (geliştirme / test)

Yerel veya test ortamında giriş yapmak için aşağıdaki hesabı **önce kayıt (Register) sayfasından oluşturun**, sonra aynı bilgilerle giriş yapabilirsiniz.

| Alan      | Değer |
|-----------|--------|
| **E-posta** | `test@openscout.local` |
| **Şifre**   | `Test123!` |

## Kullanım

1. Uygulamayı çalıştırın: `npm run dev`
2. `/register` sayfasına gidin.
3. E-posta: `test@openscout.local`, şifre: `Test123!` ile kayıt olun.
4. E-posta onayı gerekiyorsa Supabase Dashboard → Authentication → Users üzerinden kullanıcıyı onaylayın veya projede e-posta onayını kapatın.
5. `/login` sayfasından aynı e-posta ve şifre ile giriş yapın.

## Not

- Bu bilgiler sadece yerel/test ortamı içindir; production’da kullanmayın.
- `.env.local` ve bu dosyayı git’e commit etmeyin (gerekirse `docs/TEST_CREDENTIALS.md`’yi `.gitignore`’a ekleyebilirsiniz).
