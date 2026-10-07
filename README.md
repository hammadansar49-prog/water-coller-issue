# Cooler Duty

Doston ke liye water cooler bharne ki bari ka system. Web app: saada HTML, CSS aur JavaScript, data Firebase Firestore mein live sync hota hai.

- `app/`: web app (index.html, style.css, app.js, firebase-config.js, firestore.rules)
- `cooler/project/`: design canvas files (desktop + mobile)

## Local par chalana

```bash
python -m http.server 5173 -d app
```

## Deploy (Firebase Hosting)

```bash
cd app
npx firebase-tools deploy
```
