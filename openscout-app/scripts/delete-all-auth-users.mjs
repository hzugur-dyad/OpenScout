/**
 * Tüm Supabase Auth kullanıcılarını siler.
 * profiles ve ilgili tablolar CASCADE ile auth.users'a bağlı olduğu için otomatik silinir.
 *
 * Kullanım (proje kökünden):
 *   node --env-file=.env.local scripts/delete-all-auth-users.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Hata: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local'dan yüklenir).");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

async function deleteAllUsers() {
  let page = 1;
  const perPage = 1000;
  let totalDeleted = 0;

  while (true) {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });

    if (listError) {
      console.error("Kullanıcı listesi alınamadı:", listError.message);
      process.exit(1);
    }

    if (!users?.length) {
      if (page === 1) console.log("Silinecek kullanıcı yok.");
      break;
    }

    console.log(`Sayfa ${page}: ${users.length} kullanıcı işleniyor...`);

    for (const user of users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`  Silinemedi: ${user.email ?? user.id} - ${deleteError.message}`);
      } else {
        console.log(`  Silindi: ${user.email ?? user.id}`);
        totalDeleted++;
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  console.log(`\nToplam ${totalDeleted} hesap silindi.`);
}

deleteAllUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
