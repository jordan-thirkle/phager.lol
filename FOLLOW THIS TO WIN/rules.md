
vibejam2026 — rules.sh
$ cat rule_01.txt
Anyone can enter with their game.

! cat rule_02_REQUIRED.txt
Add the JS snippet from the widget section below ↓ to your game — games without it are disqualified.

$ cat rule_03.txt
At least 90% of the code has to be written by AI.

$ cat rule_04.txt
Only NEW games created during the jam period will be accepted. Do not submit games that existed prior to April 1, 2026.

$ cat rule_05.txt
Game has to be accessible on web without any login or signup and free-to-play (preferably its own domain or subdomain).

$ cat rule_06.txt
Multiplayer games preferred but this is not required!

$ cat rule_07.txt
You can use any engine but usually ThreeJS is recommended.

$ cat rule_08.txt
NO loading screens and heavy downloads (!!!) — has to be almost instantly in the game (except maybe ask username if you want).

$ cat rule_09.txt
One entry per person — focus on making one really good game!

$ cat rule_10.txt
Deadline: 1 MAY 2026 @ 13:37 UTC. Check the countdown above!

$ cat ps.txt
P.S. You can already submit your game now and keep working on it until the deadline.

WIDGET (REQUIRED)
vibejam2026 — widget.sh
(!) IMPORTANT — This JS snippet is REQUIRED.

Add this code to your game's HTML to show you're an entrant:

<script async src="https://vibej.am/2026/widget.js"></script>
We use this to track entrants and also how popular each game is for the Most Popular sub prizes.

Make sure your game is on a single domain (like vibegame.com, or fly.pieter.com, or rally.bolt.new) because that's how we track the games.

FAQ

$
help --topic "what-counts-as-vibe-coding"
+


$
help --topic "can-i-use-existing-code"
+


$
help --topic "what-engine"
+


$
help --topic "prizes"
+


$
help --topic "show-entrant-badge"
+

TIMELINE
APR 1, 2026
Jam Starts — Start Building!
MAY 1, 2026 @ 13:37 UTC
Submissions Close
MAY 2026
Judging Period
TBA
Winners Announced
PORTALS (OPTIONAL)
vibejam2026 — portals.sh
Note: this Vibe Jam Portal is a totally different thing than the required widget snippet above. The widget is mandatory and just tracks your game; portals are optional and let players hop between games like a webring.

Make an exit portal in your game players can walk/fly/drive into — you can add a label like Vibe Jam Portal. This way players can play and hop to the next game like a Vibe Jam 2026 Webring! Your game will be added to the webring if you have a portal.

When the player enters the portal, redirect them to:

https://vibej.am/portal/2026
You can send GET query params that get forwarded to the next game:

username= — username/name of the player
color= — player color in hex or just red/green/yellow
speed= — meters per second
ref= — URL of the game the player came from
Use ?ref= to add a portal BACK to the game they came from.

Example URL:

https://vibej.am/portal/2026?username=levelsio&color=red&speed=5&ref=fly.pieter.com
The receiving game can use this info to spawn the player with full continuity!

Optional extra params:

avatar_url=
team=
hp= — health points; 1..100 range
speed_x= — meters per second
speed_y= — meters per second
speed_z= — meters per second
rotation_x= — radians
rotation_y= — radians
rotation_z= — radians
The portal redirector will always add ?portal=true so you can detect when a user comes from a portal and instantly drop them into your game out of another portal — no start screens.

(!) IMPORTANT — Add a start portal:

When receiving a user (with ?portal=true in your URL) and a ?ref=, make a portal where the user spawns out of so they can return back to the previous game by walking into it. When returning them, make sure to send all the query parameters again too.

All parameters except portal are optional and may or may not be present — do not rely on their presence.

IMPORTANT: make sure your game instantly loads — no loading screens, no input screens — so the continuity is nice for players.

SAMPLE CODE — copy-paste-ready Three.js snippet for start + exit portals. Include it with a <script src>, call initVibeJamPortals({ scene, getPlayer }) once, and animateVibeJamPortals() inside your animate loop.

https://vibej.am/2026/portal/sample.js

<script src="https://vibej.am/2026/portal/sample.js"></script>
<script>
  initVibeJamPortals({
    scene: yourScene,
    getPlayer: () => yourPlayerObject3D,
    spawnPoint:   { x: 0, y: 0, z: 0 },
    exitPosition: { x: -200, y: 200, z: -300 },
  });
  // Inside your existing animate/render loop:
  // animateVibeJamPortals();
</script>