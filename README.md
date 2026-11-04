# NextGen Storytellers 2.0: Workshop Series

The website for the workshop series run by the **National Showcasing Team**,
AIESEC in Sri Lanka. Purple-and-black space theme, live countdown, a
"HAPPENING NOW: JOIN" takeover for online sessions, and registration for the
physical workshops in Colombo and Kandy.

Plain HTML, CSS and JavaScript modules. No build step, no npm install.

---

## 1. Run it locally

```bash
node serve.js
```

Then open <http://localhost:5179>.

You need a server (not `file://`) because the site uses JavaScript modules.
`serve.js` has no dependencies: it is ~60 lines of Node's own `http` module.

**The site works right now, before you touch Firebase.** It falls back to the
schedule in `assets/js/data.js` and keeps registrations in the browser, so you
can show it to the team today and wire the database later.

### In VS Code

1. **File → Open Folder…** and pick this folder (the one that contains `index.html`).
2. Press **Ctrl+Shift+B**. That runs the "Run site" task, which starts the server in a
   VS Code terminal. Or open a terminal (**Ctrl+`**) and type `npm start`, which is just
   a shortcut for `node serve.js`.
3. **Ctrl+click** the `http://localhost:5179` link in the terminal, or paste it into
   your browser.

**Ctrl+C** in that terminal stops the server. You need Node.js installed (`node --version`
prints a version if you have it). The VS Code *Live Server* extension works too: the
site only needs a server, not specifically this one.

---

## 2. Pages

| Page | What it does |
|---|---|
| `index.html` | Hero with the animated logo, live countdown, series roadmap, sessions, season-1 recap video |
| `workshops.html` | Every session in full, the two modules, the entity clusters |
| `register.html` | One form for all four sessions, ends in a printable confirmation pass |
| `contact.html` | MCVP, the four managers, a message form and the links block |
| `admin.html` | **The control room**: the live switch, meeting links, dates, registrations, CSV export |

All pages share `assets/css/styles.css`. The loading screen is `assets/js/loader.js`; its timings are at the top of that file.

The nav, footer, live bar and takeover are built in `assets/js/ui.js` and
injected into every page, so there is one copy to edit, not five.

---

## 3. The bit you will use most: the live switch

Open `yoursite/admin`. It is not linked from any page, so keep the address within the team.

**Mode**

- **Automatic**: a session goes live by the clock, between its start and end
  time. Set the real times once and forget about it.
- **Force on**: show the live screen right now, whatever the clock says.
  Use it when a session starts late, or runs long.
- **Force off**: never show it. Use it if a session is cancelled.

**Join link**: paste the Google Meet link. It appears on the live screen, the
top bar and the session card. Leave it empty and the button quietly becomes
"Session details" instead, so nothing ever links to a dead meeting.

**Rehearse it first:** open
[`index.html?preview=live`](index.html?preview=live): that forces the live
screen on **your browser only** and never touches the database. Add
`&w=graphics-online` to preview a specific session.

---

## 4. Connect Firebase

Everything below is optional until you want registrations to reach the team.

### 4.1 Create the project

1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Firestore Database → Create database** → production mode.
3. **Project settings → General → Your apps → Web (`</>`)** → register the app.
4. Copy the `firebaseConfig` object it shows you.

### 4.2 Paste the config

Open `assets/js/firebase-config.js` and replace the placeholders:

```js
export const firebaseConfig = {
  apiKey:            "AIza…",
  authDomain:        "nextgen-storytellers.firebaseapp.com",
  projectId:         "nextgen-storytellers",
  storageBucket:     "nextgen-storytellers.appspot.com",
  messagingSenderId: "1234567890",
  appId:             "1:1234567890:web:abcdef"
};
```

That is all. Reload the site: the admin page will say *"Connected to
Firebase"* instead of *"local mode"*.

> These keys are meant to be public. They identify the project, they do not
> grant access. Access is controlled by the rules in the next step.

### 4.3 Turn on Google sign-in

**Authentication → Get started → Sign-in method → Google → Enable**, choose a
support email and save. Team members sign in with their own Google accounts, so
there are no accounts or passwords to create.

To give someone access, add their lower-case email to `team()` in
`firestore.rules` and publish the rules again. Anyone else can complete the
Google sign-in, but the admin page signs them straight out and the rules refuse
their reads and writes.

When the site is hosted, add its address under **Authentication → Settings →
Authorized domains**, or the sign-in window will refuse to open.

### 4.4 Publish the rules

`firestore.rules` is written and ready. Either paste it into
**Firestore → Rules** in the console, or deploy it:

```bash
npm install -g firebase-tools && firebase login && firebase init && firebase deploy --only firestore:rules
```

What the rules do:

- **anyone** can read the schedule and the live switch
- **anyone** can create a registration, a message or a mailing-list entry
- **only the signed-in team account** can read registrations back, or change
  the schedule, meeting links and the live switch

So attendee details are never readable by the public, even though the form is.

---

## 5. Deploy

```bash
firebase deploy --only hosting
```

`firebase.json` is already set up: it publishes this folder, strips the dev
files, and sets sensible cache headers. Any static host works too: Netlify,
Vercel, GitHub Pages: just upload the folder.

---

## 6. Firestore collections

| Collection | Written by | Read by |
|---|---|---|
| `workshops/{id}` | admin page | everyone |
| `settings/live` | admin page (live switch) | everyone |
| `registrations/{auto}` | the register form | team only |
| `messages/{auto}` | the contact form | team only |
| `subscribers/{email}` | the "keep me posted" box | team only |

A `workshops` document only needs the fields you want to **override**: the
rest falls back to `data.js`. So to publish a Google Meet link, one field is enough:

```
workshops/graphics-online  →  { joinUrl: "https://meet.google.com/…" }
```

---

## 7. Where the content lives

Everything that is not code is in **`assets/js/data.js`**:

- `SERIES`: name, blurb, **and `contact`, which is still blank**
- `CLUSTERS`: the entities for each physical day, shown as "AIESEC in …"
- `WORKSHOPS`: the four sessions
- `MODULES`: the DXP + Videography blocks
- `LEAD` / `MANAGERS`: Matheen and the four managers

### Please fill these in

```js
contact: {
  email:     "",   // shows an Email card on the contact page
  instagram: "",   // adds the Instagram icon to the footer
  phone:     "",
  …
}
```

Blank entries are hidden automatically, so nothing broken ever ships: the
links simply do not appear until you add them.

---

## 8. Dates

All four dates are confirmed. To change one, edit it in the admin page. If you
untick **Date is confirmed**, the site shows a "date to be confirmed" note.

| Session | Date |
|---|---|
| Graphics Design Masterclass | Tue 10 Nov, 19:00–21:30 |
| Video Editing Masterclass | Thu 12 Nov, 19:00–21:00 |
| Physical · Colombo | Sat 21 Nov, 10:00–17:30 |
| Physical · Kandy | Sat 28 Nov, 10:00–17:30 |

All times are Asia/Colombo and are rendered in Sri Lanka time for every
visitor, wherever they are.

---

## 9. Assets

| File | Where it came from |
|---|---|
| `nextgen-logo.png` | the 2.0 logo, black background removed |
| `favicon.png` | the heart mark from the logo |
| `showcase-your-story-white.png` | your lettermark |
| `aiesec-logo-white.png` / `-black.png` | the AIESEC logo, reduced to mono |
| `team-*.jpg` | cropped from the management team poster |
| `video/nst-animated-logo.mp4` | your animated logo (hero portal) |
| `video/recap-nextgen-1.mp4` | the season 1 recap, playing inline |

The hero video is blended with `mix-blend-mode: screen`, which drops its black
backdrop so the lettering floats in the portal. If you swap it for a
light-background clip, remove that line in `styles.css`.

---

## 10. The admin page

`yoursite/admin` opens the admin page: stats, every registered
person, search and filter, **Export to Excel** (a real .xlsx with sheets for
registrations, sessions and entities), the live switch and the session editors.

- **Firebase connected:** sign in with Google. This is the real protection, because
  `firestore.rules` only lets the emails listed in `team()` read registrations.
- **Firebase unreachable:** the page says so and stays closed.

---

## 11. Putting it on GitHub

Everything in this folder is safe to commit. The Firebase web config is meant to be
public, because `firestore.rules` protects the data, and registrations live in
Firestore, never in this repository. Create an empty repository on GitHub, then run
these from this folder with your own address. If this folder already has a `.git`
folder, skip `git init` and use `git remote set-url origin` with your address instead
of `git remote add`:

```bash
git init -b main
git add .
git commit -m "NextGen Storytellers 2.0 website"
git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
git push -u origin main
```
