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

Sorun giderme
- build/ yok uyarısı: node manual-build.js
- Job görünmüyor: mock-server çalıştığından emin olun (http://127.0.0.1:3001/v1)
- Blok/backoff: Popup’taki 🧹 Reset Local ve 🐞 Debug butonlarıyla lokal state’i temizleyin ve durumu kontrol edin.

