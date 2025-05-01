# Gyrfalcon

Gyrfalcon, [@virtuals-protocol/game](https://npmjs.com/package/@virtuals-protocol/game) ve [@virtuals-protocol/game-telegram-plugin](https://npmjs.com/package/@virtuals-protocol/game-telegram-plugin) kütüphanelerini kullanan, Telegram üzerinden bilmece üretme ve yanıtlamaya odaklı bir projedir.

## Kurulum

1. Projeyi klonlayın:

   ```bash
   git clone <repository-url>
   cd Gyrfalcon
   ```

2. Bağımlılıkları yükleyin:

   ```bash
   npm install
   ```

3. Ortam değişkenlerinizi yapılandırın:
   - `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli değerleri doldurun.
   ```bash
   cp .env.example .env
   ```

## Kullanım

Proje TypeScript ile yazılmıştır, bu nedenle derleme ve çalıştırma adımları aşağıdaki gibi gerçekleştirilebilir:

### Derleme

TypeScript dosyalarını JavaScript'e derlemek için:

```bash
npm run build
```

### Üretim Ortamında Çalıştırma

Derlenmiş dosyaları kullanarak uygulamayı başlatmak için:

```bash
npm start
```

### Geliştirme Modu

TypeScript dosyalarını doğrudan çalıştırmak için:

```bash
npm run dev
```

## Docker ile Çalıştırma

Docker kullanarak çalıştırmak için:

1. Docker ve Docker Compose yüklü olduğundan emin olun.
2. Aşağıdaki komut ile uygulamayı başlatın:
   ```bash
   docker-compose up --build
   ```

## Notlar

- Uygulamanın çalışabilmesi için uygun ortam değişkenlerinin (.env dosyası) tanımlı olması gerekmektedir.
- Proje, Telegram üzerinden gelen mesajlara yanıt vererek bilmece oluşturma işlevselliğini desteklemektedir.
- Daha fazla bilgi ve güncellemeler için dokümantasyonu kontrol ediniz.
