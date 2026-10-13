# HamperMan Game

Hamperman is a Laundr-themed endless runner inspired by Google Chrome’s dino game. It is available on desktop and mobile browsers. The game is built on the pixi-js framework, allowing for wide compatibility and solid performance.

## Motivation

This project was built to give users of the Laundr website a fun way to interact with the site when they run into a 404 page.

## Build status

Check for the active build deployments under the environments tab. The [main build](http://laundr-game.herokuapp.com/) is the deployment of the most recent master commit.

## Tech/framework used

Game code was created using Javascript. Active deployments are created with [heroku](https://www.heroku.com/).

<b>Built with</b>

- [Pixi.js](https://github.com/pixijs)
- [pixi-sound](https://github.com/pixijs/pixi-sound)

## Features

- Endless running, with uncapped scores and 30-second milestones
- Variable-height jumps, ducking, fast falls, and a 150 ms jump input buffer
- A predictable first obstacle and contextual hints for new actions
- Denser obstacle groups and more double loads as levels rise, with safe minimum spacing
- One extra life per run at 1,000 points; a hit consumes it and grants three seconds of flashing invulnerability
- Tokens worth 25 points, placed along jump and duck paths throughout the run
- Token pickup text, landing puffs, and personal-best celebrations
- Immediate replay with optional score saving and remembered initials
- A top-ten leaderboard and personal best stored on the current device
- Responsive desktop and portrait layouts with large touch controls
- Pause on loss of focus, tab switching, or a change in game aspect ratio; explicit resume
- Persistent mute preference and score sharing through links or copied text
- Locally bundled Pixi.js; no third-party social widgets needed to play

## Installation

To install all necessary files required for further development, run:

```
npm i
```

Optionally, run:

```
npm run-script env
```

to change the port the npm runs on.

To start, run:

```
npm start
```

## Integration

To integrate the game into the Laundr website, add all files from our project into your directory, ensuring that pathways remain intact. For example, if you must move the .js files from the js folder, ensure all import statements at the top of game.js are updated to remain accurate.

In the main index.html page of the Laundr website, only 3 lines of code need to be added.

To add the game itself, the following html will need to be added inside the <body> element.

```
<iframe src="index.html" title="Hamperman endless runner"
  style="width: 100%; min-height: 640px; border: 0;"></iframe>
```

If you would like for the game to display in the same location as we have set it up in the gameDemo deployment, please open that branch. The Laundr 404 page has been downloaded and modified in our demo.htm file. Our code has been indicated with large comment blocks (stating “THIS IS OUR STUFF”); you may find the location of where to insert the above code by finding these comment blocks.

The game loads its artwork and sounds once. Gameplay advances through a fixed 144 Hz simulation in `js/simulation.js`, so physics, spawning, scoring, and difficulty share the same active clock. Difficulty caps at a playable speed, while runs, scores, tokens, and milestone numbers continue indefinitely.

Death-screen puns are read from `inputData/lose_puns.txt`, one per line. The former timed win, coupon screen, and finish sequence are no longer part of gameplay. Their existing artwork and text files remain available in the repository.

## Tests

Run the dependency-free regression suite:

```sh
npm test
```

It checks frame-rate consistency, buffered jumps, held jumps and fast falls, collision handling, level-based density, safe difficulty bounds, jumpable obstacle groups on desktop and portrait, extra-life awards and invulnerability, a ten-minute endless run, cleanup and restart state, optional score entry, and storage failures.

For browser verification, run `PORT=8080 npm start` and open `http://localhost:8080`. Check keyboard and touch controls, orientation changes, pause/resume, mute, repeated replay, and score entry. The score leaderboard is local to each device, not a shared online ranking.

## How to play

Press **Space** or **↑** to jump. Hold it to jump higher and farther. Press and hold **↓** to duck under high flying irons; pressing it in the air accelerates your fall. A brief jump press just before landing is buffered so it can take effect after you touch down. Each new press makes one jump.

On mobile, use the large **Jump** and **Duck** buttons. You can also tap the upper two-thirds of the game field to jump or the lower third to duck. Hold to maintain the action; the separate buttons support simultaneous touches.

Collect golden tokens for **25 points** each. Every 30 seconds marks another level, with shorter gaps between obstacle groups and more frequent double loads at higher levels. Spacing has a safe minimum so you still have room to jump and land.

Reach **1,000 points** to earn **one extra life per run**, including points from tokens. Your next collision consumes it and grants **three seconds of invulnerability**: Hamperman flashes gold while passing safely through obstacles. Jumping, ducking, scoring, and token collection continue normally. The life indicator shows whether the life is ready, used, or providing protection. After protection ends, the next collision ends your run. Restarting resets the life reward. With reduced motion enabled, protection uses a steady gold tint.

Press **P** or **Escape** to pause or resume, and **M** to toggle sound. Switching away from the game pauses it until you explicitly resume; this also freezes the invulnerability timer.

After a collision, press **Space** or **↑**, or choose **Play again**, to restart immediately. Saving a score is optional: enter one to three letters, select **Save**, or choose **Skip**. Initials are remembered on the device. The personal best is saved even when you skip leaderboard entry.

## Credits

This game was inspired by the [Google Chrome dino game](https://chromedino.com/). References used while building this project include [kittykatattack's Learning Pixi](https://github.com/kittykatattack/learningPixi) tutorial, as well as [Dower Chin's Pixi.js Video Series](https://www.youtube.com/user/dowerchin).

The people who worked on this project include:

**Kyle Hassall** - [kylehassall27](https://github.com/kylehassall27)

- Scrum Master
- Resizing
- Jumping and ducking
- Keyboard and touch input
- House spawning
- Mute
- Game demo page
- Heroku deployment

**Oliver Thomas** - [thomasoliver2021](https://github.com/thomasoliver2021)

- Product Owner
- Obstacle spawning
- End-screen and instruction windows
- Collision
- Audio

**Olivia Jacques-Baker** - [piptstc](https://github.com/piptstc)

- Obstacle spawning
- Social media integration
- Player sprites
- Collision
- Unit testing
- Win functionality and sequence

**Simran Patel** - [simranpatel-coder](https://github.com/simranpatel-coder)

- Jumping
- Coupon code
- Obstacle sprites
- Background sprites
- Score and highscore
- Restart functionality

**Michael Zinn** - [mzinn18](https://github.com/mzinn18)

- Token sprite
- Button sprite
- Game demo page
- End game puns

## License

This game was created for [Laundr Inc.](https://www.laundr.io/).
