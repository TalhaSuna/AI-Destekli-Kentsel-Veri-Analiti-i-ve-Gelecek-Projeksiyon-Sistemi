# AI Service — Kentsel Veri Analitiği

Prophet ile zaman serisi tahmini yapan Python servisi.

## Kurulum

```bash
cd ai-service
pip install -r requirements.txt
```

## .env oluştur

```bash
cp .env.example .env
```

## Kullanım

### 1. Seed data yükle (7 günlük sahte veri)
```bash
python seed_data.py
```

### 2. API'yi başlat
```bash
python main.py
```

### 3. Tahmin tetikle
```bash
curl -X POST http://localhost:8000/api/predict
```

## API Endpoint'leri

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | /api/hourly/{channel} | Saatlik özet veri (density, traffic, speed) |
| GET | /api/predictions/{channel} | Prophet tahmin sonuçları |
| POST | /api/predict | Tüm kanallar için tahmin çalıştır |
| POST | /api/predict/{channel} | Tek kanal için tahmin çalıştır |
| GET | /health | Sağlık kontrolü |
