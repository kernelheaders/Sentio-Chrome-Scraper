Playwright E2E Debugging for Sentio

Amaç
- Eklentiyi gerçek Chromium ile çalıştırıp akışı gözlemlemek, içerik loglarını toplamak, mock server ile job tetiklemek.

Kurulum
1) Bağımlılıkları kurun:
   npm install
   npx playwright install

2) Build alın (unpacked):
   node manual-build.js

3) Mock server’ı başlatın (ayrı terminal):
   npm run mock-server

Koşum
- Varsayılan senaryo (headful):
  npm run test:e2e

- UI mod (test seçip çalıştırma):
  npm run test:e2e:ui

Test ne yapar?
- Chromium’u eklentiyle açar (build/ yüklenir)
- https://www.sahibinden.com/ sayfasına gider
- Mock server’a detail_scrape job’ı yollar (varsayılan LISTING_URL: İzmir/Karşıyaka sahibinden)
- Yeni açılan detay sekmesini bekler; bulunduğunda URL ve temel seçicileri doğrular
- Tüm sayfa konsol loglarını ve önemli akış loglarını ( [flow], [collect], [resume], [navigate] ) terminale ve rapora yazar

Özel listing ile çalıştırma
  LISTING_URL="https://www.sahibinden.com/satilik/istanbul-beylikduzu/sahibinden" npm run test:e2e

Notlar
- Giriş gerekiyorsa test sırasında tarayıcı açıkken login olabilirsiniz. Akış devam eder; loglar toplanmaya devam eder.
- Service Worker logları Playwright’tan sınırlı görünür; içerik script logları sayfa konsolunda göründüğü için akış teşhisi için yeterlidir.

Gerçek Chrome’a bağlanma (Cloudflare doğrulama için önerilir)
1) Chrome’u uzaktan debug ile siz açın:
   macOS:
     /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \\
       --remote-debugging-port=9222 --user-data-dir=/tmp/sentio_profile
   Windows:
     "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\\tmp\\sentio_profile

2) Gerekirse bu Chrome’da eklentiyi (build/) elle yükleyin ve login olun.

3) Testi mevcut Chrome’a bağlayarak çalıştırın:
   node -e "process.env.LISTING_URL='https://www.sahibinden.com/satilik/izmir-karsiyaka/sahibinden'; process.exit(require('child_process').spawnSync('npx', ['playwright','test'], {stdio:'inherit', env: process.env}).status)" 
   (Ya da yardımcı skripti ekleyebilirsiniz; connectOverCDP helpers.js içinde mevcuttur.)


Sorun giderme
- build/ yok uyarısı: node manual-build.js
- Job görünmüyor: mock-server çalıştığından emin olun (http://127.0.0.1:3001/v1)
- Blok/backoff: Popup’taki 🧹 Reset Local ve 🐞 Debug butonlarıyla lokal state’i temizleyin ve durumu kontrol edin.
