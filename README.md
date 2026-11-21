# BIRD GRAND PRIX — Version 0.4

A 3D bird ground-racing game that runs in a web browser (PC, iPad, phone).
This version covers **Phase 1 (foundation), Phase 2 (racing), Phase 3 (AI) and Phase 4 (career & training)** of the plan, plus **6 stadiums and career travel**.

**Play it online:** once GitHub Pages is switched on (see below) the game is at
`https://abbas-is-tuff.github.io/Bird-Grand-Prix/`

---

## What works in this version

| Area | What is in the game right now |
|---|---|
| Birds | 13 birds across 6 species (Lovebird, Cockatiel, Pigeon, Parrot, Budgerigar, Canary). Your birds Abbas, Cookie, Snowflake, Silver and Pikachu are marked ★ YOURS. |
| 3D models | Built in code with natural proportions. Wing, tail and crest feathers are individual feathers that move. Parrot-type birds have 2 toes forward / 2 back; pigeons and canaries have 3 forward / 1 back. |
| Running | Feet are planted on the ground (they don't slide), legs use inverse kinematics, the body bobs and leans into bends, and the head is steadied. Pigeons do their real head-bob. Tails fan when braking and wings open for balance. |
| Physics | Force-based running: acceleration, momentum, grip on bends (heavy birds run wide if too fast), grass is slower than the track, birds can bump into each other. |
| Stamina | Sprinting drains stamina; tired birds slow down. |
| Races | 100 m (straight), 200 m and 400 m (staggered starts, stay in lane), 800 m (2 laps, break line, lap bell). |
| Rules | Random "Set" hold time, false starts (warning, then disqualified), reaction times, lane violations on bends, photo-accurate finish times. |
| AI | 5 personalities: Aggressive, Consistent, Fast starter, Endurance, Unpredictable. They react to the gun, pace themselves, kick for the line, slow for bends, overtake on the outside in the 800 m. Easy / Normal / Hard. |
| Cameras | Chase, TV Side, Bird Level, Trackside, Finish Line, Cinematic (auto director). Smooth transitions. |
| Stadiums | 6 venues (see below), each with its own track surface, stands, crowd, scenery and lighting. Live scoreboard, finish gantry timer, sponsor boards (invented names). Day / Sunset / Night outdoors. |
| Sound | Footsteps, starter's gun with echo, countdown, lap bell, crowd that gets louder in close finishes, chirps, wing flaps, victory tune, spoken commentary (uses your device's voice). All sounds are generated in code. |
| Records | Personal bests per bird and stadium records are saved on your device. |

| Time trials | Quick Race → Rivals → **Time trial**: race alone against the clock. |
| Barriers | Bird-sized hurdles. **JUMP** just before each one. Clear it and you keep your speed; hit it and it falls over and you lose half your speed. **100 m Barriers** is a race type (also in career from Amateur level). |

### Stadiums

Pick one in **Quick Race → Venue**. All are invented places.

| Venue | Where | Track | What it's like |
|---|---|---|---|
| 🏟️ Featherfield Stadium | Featherfield (home) | Red rubber | Your home stadium: covered grandstand, floodlights, city and trees. |
| 🌳 Meadowbrook Green | Meadowbrook | Grass | Village field with picnic banks, marquees and hedges. Grass is slower and slippery. |
| 🌾 Hollow Hills Course | Hollow Hills | Cinder | Countryside track between farms (barn, silo, a spinning windmill). Fans lean on the fence. |
| 🏜️ Dune Valley Speedway | Dune Valley | Clay | Desert track under shade sails, with palms, rocks and dunes. A little slippery. |
| ❄️ Aurora Indoor Arena | Nordhaven | Purple rubber | Indoors: a full ring of seats, a roof with lamps, perfect conditions, no time of day. |
| 🌍 Grand Aviary Stadium | Skyhaven | Blue rubber | The biggest stage: a giant bowl with a ring roof, flags and two scoreboards. |

Grass, cinder and clay grip less than rubber, so birds are a bit slower and run wider on the bends there.

### Career travel — the life of a travelling racer

| Feature | How it works |
|---|---|
| Where you are | Your bird lives in **Featherfield**. The career screen always shows where you are (📍). |
| Races around the map | Each week one event is near you and one is somewhere else. The level's final is held at a big venue (Featherfield → Dune Valley → Aurora → Grand Aviary). Bigger venues pay more prize money. |
| TRAVEL tab | A map of all six places. Tap a pin to see the venue, this week's races there, and the trip options. Race cards also have **BUS / TRAIN / PLANE & ENTER** buttons. |
| 🚌 Bus | Cheapest, only for nearby places. Slow: can use up 1–2 training sessions and makes your bird tired. |
| 🚆 Train | Middle price, medium distances, uses 1 training session, less tiring. |
| ✈️ Plane | Expensive but quick. Long flights cause **jet lag** (−3% speed in your next race). |
| Costs | Trips cost more at higher levels. Every week you stay away from home you pay for a **hotel**. If you are completely broke away from home, the club pays for your ride back. |
| Home advantage | A week at home gives extra rest (+6 freshness) and the home crowd gives you +1.5% speed. |
| Things happen | Sometimes something happens on the trip: a delayed flight, a broken-down bus, a fan sharing millet, a radio interview… |
| Passport | **RECORDS** shows every venue you've visited with your races, wins and best times there, plus total distance travelled and flights. New trophies: *First flight* and *World traveller* (race at all six venues). |

Careers saved before version 0.4 still load; your bird simply starts at home in Featherfield.

### Phase 4: Career mode

| Feature | How it works |
|---|---|
| Career levels | **Beginner → Amateur → Professional → Champion.** Each season is 8 weeks; week 8 is the championship final. Finish the season in the **top 3 of the standings** to be promoted. |
| Competitions | Each week you choose one of two events (or rest). Higher levels add longer races, sunset and night meetings, entry fees and bigger prize money. Rivals get faster at every level. |
| Prize money | Paid for places 1–6. Spend it on entry fees, a pro coach, the physio or training camps. |
| Ranking points | Earned by finishing position (double in the final). All 13 birds earn points every week, so the standings table is a real league. |
| Training | Every session is a **drill you play on the track**. Two sessions per week (three with a training camp). Your grade (S, A, B, C, D) decides how much your bird improves — an S is worth three times a D. Gains also shrink near each stat's limit and when your bird is tired, so nothing maxes out instantly. Training slowly fades if you stop. Stopping a drill early wastes the session. |
| Fatigue | Training and racing make your bird tired. A tired bird races slower and starts with less stamina. Rest, Recovery sessions and the physio bring freshness back. |
| Sponsors & contracts | From Amateur level, sponsors offer contracts: weekly pay, a bonus per win, and a big completion bonus if you reach their top-3 goal in time. |
| Records | Career statistics, best times, season finishes, racing history, training log and a trophy cabinet (final medals, season titles, promotions and milestones). |
| Saving | The career saves automatically on your device after every action. |

**Training drills**

| Session | Drill | What is graded |
|---|---|---|
| ⚡ Sprint training | Barrier sprints: 100 m, 5 barriers | time + barriers |
| 🔋 Endurance runs | Endurance lap: 400 m, 4 barriers | time + barriers |
| 🚀 Acceleration drills | Start & burst: 60 m from the gun, 2 barriers | reaction time + time + barriers |
| 🌀 Turning practice | Bend control: 200 m with **no lane assist**, 3 barriers | staying in your lane + barriers + time |
| 🛁 Recovery | Cool-down jog: 80 m | don't sprint! |

Leaving a career race through the pause menu counts as a DNF (did not finish), so you can't restart a race you're losing.

**Not in this version yet (coming in later phases):** garage/customisation, obstacle races, weather, online multiplayer. Their menu buttons are shown as locked.

---

## How to play

* **Wait for the gun.** Pressing RUN or SPRINT after "Set" but before the gun is a false start.
* **RUN** = steady race pace. **SPRINT** = 100% effort but uses stamina fast.
* In the 400 m and 800 m, RUN most of the way and SPRINT near the end when you still have stamina.
* With **Lane Assist** on (default), your bird steers itself. Left/right only nudges it, and in the 800 m moves you between lanes after the green break line.

| Action | Keyboard | Touch |
|---|---|---|
| Run | W or ↑ | RUN button |
| Sprint | Shift | SPRINT button |
| Jump (barriers) | Space or J | JUMP button (appears when there are barriers) |
| Steer | A / D or ← / → | ◀ ▶ buttons |
| Change camera | C | 🎥 button |
| Pause | P or Esc | ❚❚ button |
| Skip intro | Enter | Tap the screen |

---

## Why Three.js (the game engine)

* It runs in any web browser, so the same game works on your iPad, phone and PC with **nothing to install**.
* It uses JavaScript, the language you are learning in VS Code.
* It is free and open source (MIT licence).
* Unity, Unreal and Godot can make more photo-realistic graphics, but they need large installs, cannot run on an iPad for development, and are much harder for a beginner. If the game later needs console-level graphics, the game logic can be moved across.

---

## Running it on your Windows PC

1. Unzip `bird-grand-prix.zip` into your **my personal coded games** folder.
2. Open **VS Code** → **File → Open Folder…** → choose the `bird-grand-prix` folder.
3. Click the **Extensions** icon on the left (four squares), search **Live Server** (by Ritwick Dey) and click **Install**.
4. Right-click `index.html` in the file list → **Open with Live Server**. The game opens in your browser.

Why Live Server? The game is split into many small files (modules). Browsers only load modules from a web server, not by double-clicking the file. If you just want to play without VS Code, double-click **`play-offline.html`** instead — it is the whole game packed into one file.

## Putting it on your iPad (GitHub Pages)

The code lives in the GitHub repository `Abbas-is-tuff/Bird-Grand-Prix`.

1. On github.com open the repository → **Settings → Pages**.
2. Under *Build and deployment → Branch* choose `main` and `/ (root)`, then **Save**.
3. After a minute or two your game is at `https://abbas-is-tuff.github.io/Bird-Grand-Prix/`.
4. Open that link in Safari on the iPad → **Share → Add to Home Screen**. It opens full-screen like an app.

Your career and records are saved separately on each device and each web address.

---

## Where everything is

```
bird-grand-prix/
├── index.html            the page: menus, HUD, buttons
├── style.css             how the menus and HUD look
├── icon.png              home-screen icon
├── logo.svg              the game logo (vector, any size)
├── play-offline.html     the whole game in one file (double-click to play)
├── lib/                  Three.js 3D engine (don't edit)
└── src/
    ├── main.js           starts the game
    ├── core/game.js      the main loop: menus ⇄ races, camera, sound, scoreboard
    ├── core/settings.js  settings and personal bests (saved on your device)
    ├── core/utils.js     small maths helpers
    ├── data/species.js   ★ the 6 species: speed, stamina, grip, body shape, gait
    ├── data/roster.js    ★ every bird: name, number, colours, personality
    ├── data/races.js     race distances, pace, difficulty levels
    ├── data/venues.js    ★ the 6 stadiums: track colour/surface, stands, roof, scenery, map position
    ├── world/track.js    400 m track maths (lanes, staggers, distances)
    ├── world/trackMesh.js   draws the track, lines and markings
    ├── world/stadium.js  builds any venue: stands, crowd, roofs, floodlights, scoreboards, scenery
    ├── world/environment.js sky, sun, shadows, day/sunset/night
    ├── world/textures.js all textures, painted in code
    ├── world/barriers.js the hurdle barriers (and knocking them over)
    ├── birds/birdModel.js    builds a 3D bird (body, head, beak, feathers, legs)
    ├── birds/birdAnimator.js running animation (foot planting, IK, head, feathers)
    ├── birds/birdPhysics.js  running physics + stamina
    ├── race/race.js      start procedure, rules, finish, results
    ├── race/racer.js     one competitor (model + physics + name tag)
    ├── race/commentary.js   commentator lines
    ├── career/careerData.js  ★ career rules: levels, prize money, training, sponsors, travel prices
    ├── career/career.js      the career itself: weeks, seasons, training, standings, trophies
    ├── career/drills.js      ★ the training drills and how they are graded
    ├── ai/aiController.js    computer racers and their personalities
    ├── input/input.js        keyboard + touch buttons
    ├── input/playerController.js  your bird's controls + lane assist
    ├── camera/cameraDirector.js   the six cameras
    ├── audio/audio.js        all sounds
    └── ui/                   HUD, menus, career screens, bird portraits
```

### Easy things to try changing yourself

* **A bird's colours:** open `src/data/roster.js`, find the bird, change a colour code like `body: '#5fae3e'`. Save, and refresh the browser.
* **Add a new bird:** copy one whole `{ ... }` block in `roster.js`, give it a new `id`, `name` and `number`, and pick a `species`.
* **Make a species faster:** in `src/data/species.js` raise `topSpeed` a little (e.g. 8.9 → 9.1).
* **Change a stadium:** in `src/data/venues.js` change a venue's `track: { color: '#c2452f' }` to repaint its track, or `seats` to change the seat colour.
* **Cheaper travel:** in `src/career/careerData.js` lower the numbers in `TRAVEL_MODES` or `HOTEL_PER_WEEK`.
* **Make the career easier:** in `src/career/careerData.js` lower the `oppSpeed` numbers for a level, or raise `START_MONEY`.

After editing, run `node build.mjs` (see below) only if you want to update `play-offline.html`. The normal `index.html` uses your changes straight away.

### Re-building play-offline.html (optional)

Needs Node.js (nodejs.org, LTS version). In a terminal inside the folder:

```
npm install
node build.mjs
```

---

## Credits and licences

* 3D engine: [Three.js](https://threejs.org) — MIT licence.
* Logo lettering: shapes traced from the font *Saira Condensed* by Omnibus-Type — SIL Open Font Licence 1.1.
* Everything else (bird models, textures, sounds, music, sponsor names) is original and generated in code for this game.
