# Лабораторна робота №6 — Використання Node.js

Автор: Шкудор Максим

- **Фреймворк:** hapi (`@hapi/hapi`) + `@hapi/inert` для роздачі статичних файлів
- **Додаткове поле:** `phone`, необов'язкове. Якщо його заповнено, дозволені лише `+`, цифри, пробіли, `(`, `)` і `-`.

Сервер роздає сайт-резюме з `public/`, приймає форму зворотного зв'язку на `POST /api/contact`, перевіряє дані та дописує кожне звернення рядком у `data/feedback.jsonl` (формат JSON Lines). Сторонні онлайн-сервіси не використовуються.

## Структура

```
lab6-server/
├── server.js          # hapi-сервер: статика, POST /api/contact, валідація, збереження
├── package.json       # залежності та скрипт npm start
├── public/            # статичний сайт (index.html, css/, js/)
├── data/              # звернення (поза public/, не потрапляють у git)
│   └── .gitkeep
└── test/              # JSON-файли для перевірки запитів через curl
```

## Запуск

```
npm install
npm start
```

Сайт відкривається на http://localhost:3000. Сервер слухає `0.0.0.0:3000`, а в консоль виводить адреси в локальній мережі, наприклад `http://192.168.1.25:3000`.

Зупинити сервер: `Ctrl+C`.

## API

`POST /api/contact`, `Content-Type: application/json`, розмір тіла до 10 КБ.

| Ситуація | Код | Відповідь |
|---|---|---|
| Звернення збережено | 201 | `{"ok":true,"message":"Feedback saved locally.","id":"..."}` |
| Некоректні дані | 400 | `{"ok":false,"error":"A valid email address is required."}` |
| Тіло більше за 10 КБ | 413 | `{"ok":false,"error":"..."}` |
| Не JSON (`Content-Type`) | 415 | `{"ok":false,"error":"..."}` |
| Помилка запису у файл | 500 | `{"ok":false,"error":"Internal server error. ..."}` |

Сервер перевіряє, що:
- тіло запиту є JSON-об'єктом;
- `name`, `email`, `subject` і `message` є рядками й не порожні після `trim()`;
- `email` має базовий формат;
- довжина полів обмежена: name 100, email 254, phone 30, subject 150, message 2000 символів;
- `phone`, якщо заповнений, містить лише дозволені символи.

`id` (`randomUUID`) і `createdAt` створює сервер; значення цих полів від клієнта ігноруються.

## Перевірка через curl

**Windows (PowerShell).** Використовуйте саме `curl.exe` і готові файли з `test/`, щоб уникнути проблем з лапками:

```
curl.exe -i -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" --data-binary "@test/valid.json"
curl.exe -i -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" --data-binary "@test/invalid-email.json"
curl.exe -i -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" --data-binary "@test/invalid-phone.json"
curl.exe -i http://localhost:3000/data/feedback.jsonl
```

**Linux / macOS:**

```
curl -i -X POST http://localhost:3000/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test User","email":"test@example.com","phone":"+380 (67) 123-45-67","subject":"Lab 6","message":"Local persistence test"}'
```

Очікувано: перший запит повертає `201`, некоректні повертають `400` і не додають рядок у файл, а `/data/feedback.jsonl` повертає `404`.

## Доступ з іншого пристрою в мережі

1. Виконайте `ipconfig` і знайдіть **IPv4 Address** активного адаптера (або візьміть адресу, яку сервер вивів у консоль).
2. Підключіть телефон до тієї самої Wi-Fi мережі й відкрийте `http://<IPv4>:3000`.
3. Під час першого запуску Windows може запитати дозвіл для Node.js у брандмауері. Дозвольте доступ для **приватних** мереж.
4. Надішліть вигадане звернення й перевірте, що в `data/feedback.jsonl` з'явився новий рядок.

Гостьові та університетські мережі можуть ізолювати клієнти одне від одного. Тоді перевірку виконують через `localhost`.

## Безпека

- `data/` лежить поза `public/`, тому файл зі зверненнями не можна завантажити як статичний.
- Валідація виконується на сервері, бо запит можна надіслати в обхід форми (curl, DevTools).
- Сервер не має HTTPS і автентифікації, тому використовуйте лише вигадані тестові дані й не запускайте його в ненадійних мережах.
