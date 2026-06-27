# How to Run River Run Fishing (Easy Launchers)

These launcher files let you start and stop the game with a double-click —
no command-line knowledge needed. They do **not** change any game code; they
only start and stop the local development server.

---

## One-time requirement: Node.js

The game needs **Node.js** installed on your computer (this is the engine that
runs the development server). You only have to do this once.

1. Go to **https://nodejs.org**
2. Download the **LTS** version (the big green button).
3. Install it like any normal app, then restart your computer.

If you skip this, the launcher will detect it's missing and show you these
same steps.

---

## Windows

**To start the game:**
1. Open the project folder (`river-run-fishing`).
2. Double-click **`Launch River Run Fishing.bat`**.
3. A black window opens and shows the startup steps. The **first time**, it
   installs the game's building blocks — this can take a few minutes. After
   that, startup is quick.
4. Your web browser opens automatically to **http://localhost:5173**.
5. **Keep the black window open while you play.**

> If Windows shows a blue "Windows protected your PC" box, click
> **More info → Run anyway**. This happens because the file isn't from the
> app store; it's a normal local script.

**To stop the game:**
- Double-click **`Stop River Run Fishing.bat`**, **or**
- Simply close the black launcher window.

---

## Mac

**First time only — allow the launchers to run:**
macOS blocks double-clicked scripts until you allow them once.
- **Easiest:** Right-click (or Control-click) **`Launch River Run Fishing.command`**
  → choose **Open** → click **Open** in the dialog. After doing this once,
  normal double-clicking works.
- If macOS still refuses, open **System Settings → Privacy & Security**, scroll
  down, and click **Open Anyway**.

**To start the game:**
1. Open the project folder (`river-run-fishing`).
2. Double-click **`Launch River Run Fishing.command`**.
3. A Terminal window opens and shows the startup steps. The **first time**, it
   installs the game's building blocks — this can take a few minutes.
4. Your web browser opens automatically to **http://localhost:5173**.
5. **Keep the Terminal window open while you play.**

**To stop the game:**
- Double-click **`Stop River Run Fishing.command`**, **or**
- Click the Terminal window and press **Control + C**, or just close it.

---

## Frequently asked

**Nothing opened in my browser.**
Wait a few more seconds (the server is still starting), then open your browser
and type **http://localhost:5173** yourself.

**"Port 5173 is already in use."**
The game is probably already running in another window. Run the **Stop** script,
then launch again.

**Do I need internet?**
Only the very first launch (to download the building blocks). After that it
runs fully offline.

**Will this change my game or saves?**
No. These launchers only start/stop the development server. They never touch
game code, assets, or saved games.

---

## What these scripts actually do (for the curious)

- Move into the project folder automatically.
- Check that Node.js is installed (and guide you if not).
- Run `npm install` **only** if the `node_modules` folder is missing.
- Run `npm run dev`, which starts the Vite development server on port **5173**.
- Open your browser to the game.
- The Stop scripts find whatever is using port 5173 and shut it down cleanly,
  without disturbing other Node.js programs you may be running.
