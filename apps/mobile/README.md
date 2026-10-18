# Fintech Médias — mobile

App Flutter (Android + iOS) branchée sur **l’API en ligne** `https://api.fintechmedias.com/api`.
Le site [fintechmedias.com](https://fintechmedias.com) est déjà en production : pas besoin de lancer l’API locale pour tester le lecteur public.

```bash
cd apps/mobile
flutter pub get
flutter run
```

`flutter run` sans argument utilise déjà `https://api.fintechmedias.com/api`.

Pour forcer une autre API :

```bash
# Production (défaut)
flutter run --dart-define=API_BASE_URL=https://api.fintechmedias.com/api

# API locale uniquement si vous développez le backend
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001/api   # émulateur Android
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3001/api  # iOS / desktop
```

**Faits prod**

- Santé : `GET https://api.fintechmedias.com/api/health`
- Médias : `https://cdn.fintechmedias.com`
- Accueil / rubriques / articles / HLS : disponibles sans compte
- Config app : `GET /settings/app` (captcha, Google, etc.)
- Magazines : numéros `FREE` — aperçu pages sans achat

Turnstile de secours si `/settings/app` n’est pas encore en ligne :

`--dart-define=TURNSTILE_SITE_KEY=…` (clé *site* publique, jamais le secret).

L’admin et les abonnements restent sur le site web.

Régénérer icône / splash après changement d’assets marque :

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

Si le build iOS échoue à cause de Swift Package Manager (`media_kit` / `flutter_secure_storage`) :

```bash
flutter config --no-enable-swift-package-manager
```
