# PK Transport App – நிறுவும் வழிமுறை

## 1. Project திறப்பது
ZIP-ஐ Extract செய்து அந்த `pk-transport` folder-ஐ VS Code-ல் Open செய்யவும்.

## 2. Packages நிறுவுதல்
VS Code Terminal-ல்:
```bash
npm install
```

## 3. Firebase அமைப்பு
`src/firebase.js`-ல் உங்கள் Firebase Web App configuration உள்ளது. உங்கள் Firebase project-இன் config-உடன் ஒப்பிட்டு சரிபார்க்கவும்.

Firebase Console → Authentication → Sign-in method → **Email/Password** Enable செய்யவும்.

## 4. Firestore Role அமைப்பு
Authentication-ல் பயனர் account உருவாக்கப்பட்டிருக்க வேண்டும். அதன் UID-ஐப் பயன்படுத்தி Firestore → `users` collection-ல் அதே UID-யை Document ID ஆக அமைக்கவும்.

உதாரணம்:
- Document ID: Firebase Authentication UID
- Field: `role`
- Type: string
- Value: `admin` அல்லது `staff` அல்லது `driver`

முன்பே உருவாக்கிய Admin UID-க்கு `role: "admin"` அமைக்கவும். Collection பெயர் துல்லியமாக `users` (சிறிய u) ஆக இருக்க வேண்டும்.

## 5. Firestore Collections
App இவை பயன்படுத்தும்:
- `users`
- `vehicles`
- `trips`
- `income`
- `expenses`

## 6. Security Rules
Firebase Console → Firestore Database → Rules பகுதியில் `firestore.rules` கோப்பின் உள்ளடக்கத்தை paste செய்து Publish செய்யவும்.

**கவனம்:** உங்கள் Firestore-ல் முன்பிருந்த `Users` (பெரிய U) collection வேறு. இந்த App `users` (சிறிய u) collection-ஐப் பயன்படுத்துகிறது.

## 7. App இயக்குதல்
```bash
npm run dev
```
Terminal-ல் காட்டப்படும் Local URL-ஐ Browser-ல் திறக்கவும் (பொதுவாக http://localhost:5173).

Production build சோதனை:
```bash
npm run build
```

## Login பயன்பாடு
Email + Password மூலம் உள்நுழையவும். Role-ஐ Login form-ல் தேர்வு செய்ய வேண்டியதில்லை; Firestore `users/{uid}` document-ல் உள்ள role-ஐ வைத்து App அனுமதியை நிர்ணயிக்கிறது.

புதிய Staff/Driver கணக்குகளை Firebase Console → Authentication → Users பகுதியில் உருவாக்கி, அவர்களின் UID-க்கு `users` collection-ல் role document சேர்க்க வேண்டும்.

## பாதுகாப்பு குறிப்பு
Firebase Web API key browser-ல் பயன்படுத்தப்படும் public project identifier. பாதுகாப்பு Firestore Rules மற்றும் Authentication-ல் அமைகிறது. Admin password அல்லது service-account private key-ஐ source code-ல் எழுத வேண்டாம்.


## Route மற்றும் Trip KM கணக்கீடு
1. Admin அல்லது Office Staff login செய்து Routes பகுதியில் ஒவ்வொரு வழிக்கும் Start Location, End Location, Allowed KM ஆகியவற்றை ஒருமுறை சேமிக்க வேண்டும்.
2. Driver Trips பகுதியில் சென்று சேமித்த Route-ஐ தேர்வு செய்ய வேண்டும்.
3. Driver வாகனத்தின் meter reading-ஐ Start KM மற்றும் End KM-ல் உள்ளிட வேண்டும்.
4. App தானாக Total KM = End KM - Start KM கணக்கிடும்.
5. Extra KM = max(0, Total KM - Route Allowed KM). நிர்ணயிக்கப்பட்ட KM-ஐ மீறினால் மட்டுமே Extra KM வரும்.
6. Route தேர்வு செய்யும் போது Start/End Location மற்றும் Allowed KM தானாகப் பெறப்படும்.

குறிப்பு: Route-களை முதலில் Admin/Office Staff பதிவு செய்ய வேண்டும். புதிய Route இல்லையெனில் Driver Trip பதிவு செய்ய முடியாது.
