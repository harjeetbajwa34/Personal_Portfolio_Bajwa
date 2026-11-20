# Personal_Portfolio_Bajwa
# Harjeet Bajwa: Portfolio Web Application

My personal portfolio website - Harjeet Bajwa, an IT student based in Nelson, New Zealand. The site has four pages (Home, Skills, Projects and Contact) and is built with plain HTML, CSS and JavaScript. The Contact page is connected to Google Firebase, which handles user accounts (Firebase Authentication) and stores visitor messages in real time (Cloud Firestore).

## Features

- **Registration and login:** Visitors create an account with their name, email and password, then log in with Firebase Authentication. The login stays active after a page refresh.
- **Email verification:** A verification email is sent when someone registers. The message form stays locked until the email address is confirmed.
- **reCAPTCHA v2:** The login and registration forms need the "I'm not a robot" box ticked before anything is sent to Firebase.
- **Real-time messages:** Messages appear on the page as soon as they are saved, without refreshing.
- **Edit and delete own messages:** Logged-in users can edit or delete only the messages they wrote. Firestore security rules enforce this on the server as well as on the page.
- **Password reset:** "Forgot password?" sends a reset link to the user's email.
- **Input checks:** Every form checks its fields before sending. Passwords need at least 8 characters with a letter and a number, and messages are limited to 1,000 characters.
- **Accessible layout:** Labelled form fields, visible keyboard focus, status messages read out by screen readers, a phone layout and support for reduced motion.

## Technologies

| Area | Used |
|---|---|
| Structure | HTML5 |
| Styling | CSS3 (custom properties, grid, flexbox), Google Fonts (Fraunces, IBM Plex Sans) |
| Scripting | JavaScript (ES modules), following the Airbnb JavaScript Style Guide |
| Backend | Firebase Authentication, Cloud Firestore (Firebase JS SDK 10.13.2) |
| Security | Google reCAPTCHA v2, Firestore security rules, email verification |

## Project structure

```
portfolio/
├── home.html           Home page
├── skills.html         Skills page
├── projects.html       Projects page
├── contact.html        Contact page: account, message form and message list
├── style.css           One stylesheet shared by all pages
├── script.js           Shared scripts for the other pages (nav highlight, lightbox)
├── firebase.js         Connects to Firebase and exports auth and db
├── app.js              Contact page logic: auth, reCAPTCHA, messages
├── firestore.rules     Firestore security rules
├── .eslintrc.json      ESLint settings (Airbnb style)
├── README.md
└── docs/
    ├── Task4-authentication-journey.md   Flowcharts, code snippets, screenshot list
    ├── flow-registration.png             Figure 1: registration and verification
    ├── flow-login-edit.png               Figure 2: login, posting and editing
    └── *.dot                             Graphviz sources for the flowcharts
```

## Getting started

### 1. What you need

- A Firebase project (this one uses `myportfolioassessment`)
- A code editor with a local server, for example VS Code with the Live Server extension

### 2. Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/), open the project.
2. Go to **Authentication > Sign-in method** and enable **Email/Password**.
3. Go to **Firestore Database > Rules**, paste in the contents of `firestore.rules` and click **Publish**. If other pages use other collections, keep their rules as well.
4. The web app settings are in `firebase.js`. To use a different project, replace the `firebaseConfig` values with the ones from **Project settings > Your apps**.

### 3. reCAPTCHA setup

1. Go to the [reCAPTCHA admin console](https://www.google.com/recaptcha/admin) and create a **v2 "I'm not a robot" checkbox** key.
2. Add the domains `localhost`, `127.0.0.1` and the live domain (for example `myportfolioassessment.web.app`).
3. Copy the **site key** into `RECAPTCHA_SITE_KEY` at the top of `app.js`.

The key that is in `app.js` now is Google's public test key. It always passes and shows a "testing purposes only" notice, so replace it before submitting or taking screenshots.

### 4. Run the site

Open the folder in VS Code and start **Live Server** on `home.html`. The site must be served over `http://`. Opening `contact.html` straight from the folder (`file://`) blocks the JavaScript modules.

To deploy with Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## How the authentication works

1. **Register:** `createUserWithEmailAndPassword()` creates the account, `updateProfile()` saves the name, and `sendEmailVerification()` sends the link.
2. **Verify:** The user opens the link, then clicks **I have verified**. The page calls `user.reload()` and `getIdToken(true)` so the new status reaches the security rules.
3. **Log in:** `signInWithEmailAndPassword()` logs the user in. `onAuthStateChanged()` updates the page and starts the real-time message listener.
4. **Post:** `addDoc()` saves the message with the user's `uid`, `name`, `email`, `message` and `createdAt`.
5. **Edit or delete:** Edit and Delete only appear on the user's own messages. `updateDoc()` changes the text and adds `updatedAt`, and `deleteDoc()` removes the message after a second confirming click.
6. **Log out:** `signOut()` ends the session and stops the listener.

The full journey is shown as flowcharts in `docs/Task4-authentication-journey.md`.

## Firestore data model

Collection: `messages`

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Firebase Auth ID of the author |
| `name` | string | 1 to 80 characters |
| `email` | string | Must match the logged-in user's email |
| `message` | string | 1 to 1,000 characters |
| `createdAt` | timestamp | Set by the server |
| `updatedAt` | timestamp | Set by the server when the message is edited |

## Security

- **Firestore rules:** Only logged-in users can read messages. Only verified users can post, and only under their own `uid` and email. Users can edit (text only) or delete only their own messages.
- **Email verification:** Checked on the page and in the rules (`request.auth.token.email_verified`).
- **reCAPTCHA:** Blocks automated login and sign-up attempts from the page. It is checked in the browser only. Firebase App Check with reCAPTCHA would add a check on the server.
- **Safe output:** Messages are shown with `textContent`, so HTML typed into a message cannot run as code.
- **Password reset privacy:** The reset message is the same whether or not the email has an account.
- **API key:** The Firebase web API key in `firebase.js` identifies the project and is not a secret. Data is protected by the security rules, not by hiding the key.

## Testing checklist

- [ ] Register with a new email: the account appears in Firebase **Authentication > Users**
- [ ] Try to register without ticking reCAPTCHA: an error is shown
- [ ] Use mismatched passwords or a weak password: field errors are shown
- [ ] Before verifying: the badge says "Email not verified" and the message form is locked
- [ ] Open the verification link, click **I have verified**: the badge turns green and the form unlocks
- [ ] Log in with a wrong password: "Email or password is incorrect"
- [ ] Send a message: it appears in the list straight away and in Firestore
- [ ] Edit your own message: the text updates and shows "edited"
- [ ] Another user's message shows no Edit or Delete buttons
- [ ] Delete your own message: it disappears after the confirming click
- [ ] Log out and refresh: messages are hidden and the login form shows

## Code style

JavaScript follows the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) and passes `eslint-config-airbnb-base` with no errors. To check it:

```bash
npm install --save-dev eslint@8 eslint-config-airbnb-base eslint-plugin-import
npx eslint app.js firebase.js
```

`.eslintrc.json` turns off the two import-path rules, because the Firebase SDK is loaded from full CDN URLs that ESLint cannot resolve.

## Author

Harjeet Bajwa, Nelson, New Zealand