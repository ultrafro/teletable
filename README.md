# TeleTable

<div align="center">
<video src="media/teasingle_2x.mp4" controls autoplay muted loop width="80%"></video>

<table>
<tr>
<td align="center">
<video src="media/teleop.mp4" controls width="100%"></video>
<br><b>Teleoperation</b>
</td>
<td align="center">
<video src="media/cleanbathroom.mp4" controls width="100%"></video>
<br><b>Cleaning Task</b>
</td>
</tr>
</table>
</div>

Bimanual teleoperation with stereo vision — control two robot arms remotely using your hands and a VR headset.

TeleTable streams your hand movements to dual SO-101 robot arms over a peer-to-peer connection, with depth perception from a stereo camera. One person runs the robot locally; another person controls it from anywhere with full 3D vision of the workspace.

---

## Quick Start

### 1. Run the Robot Server

On the machine connected to the robot:

```bash
cd SimpleRobotServer

# Install uv if you don't have it (Windows PowerShell):
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Linux/Mac:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run the server
uv run simple-robot-server
```

First run walks you through robot and port selection, then saves the config. Subsequent runs auto-start.

**No physical robot?** Use simulation mode:

```bash
uv run simple-robot-server --simulation
```

### 2. Run the Web App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Set Up Supabase (for room-based sessions)

Create a `.env.local` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Run the schema: `app/api/db/schema.sql` in your Supabase SQL editor.

### 4. Connect

1. Sign in at `/` and create a room
2. Share the room ID with someone remote
3. The remote person joins and sees the robot camera feed
4. They move their hands — the robot moves

---

## Hardware

### Robot Arm — SO-101

The SO-101 is an open-source 6-DOF robot arm designed for manipulation research. You need **one follower arm** (the physical arm that moves) and optionally one **leader arm** (a second arm you hold to control the first with your hands directly).

For TeleTable, the follower arm is controlled via WebSocket from the web app, so you don't necessarily need a leader arm — you can control it with hand tracking or a VR headset instead.

- **Official docs & BOM:** [huggingface.co/docs/lerobot/so101](https://huggingface.co/docs/lerobot/so101)
- **Assembly guide:** [huggingface.co/docs/lerobot/en/assemble_so101](https://huggingface.co/docs/lerobot/en/assemble_so101)
- **GitHub (3D files):** [github.com/TheRobotStudio/SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100)
- **Buy assembled or kit:** [WowRobo](https://shop.wowrobo.com/products/so-arm101-diy-kit-assembled-version-1) · [OpenELAB](https://openelab.io/blogs/seeed-studio/build-your-own-so-101-robot)

**What you need for the arm:**
- 6x STS3215 servo motors (7.4V or 12V variant)
- 1x Feetech bus servo adapter (for USB connection to PC)
- 3D printed parts (STL files in the GitHub repo above)
- 5V or 12V power supply (match your motor variant)
- M2 and M3 screws (see BOM in the docs)

### Vision — Stereo Camera

For depth perception and a good view of the workspace:

**[MMlove USB Stereo Camera Module 1200P](https://www.amazon.com/dp/B0FD2TP6S6)**
Global shutter, 60FPS, 112° wide angle, dual synchronous lenses. Works over USB directly — no drivers needed. This gives the remote operator a 3D sense of the workspace.

### Camera Mount

**[UBeesize Overhead Camera Mount with 360° Adjustable Arm](https://www.amazon.com/dp/B0DMRZ37RF)**
Desk-clamp arm mount with a flexible gooseneck. Positions the stereo camera directly above or in front of the robot workspace, freeing up desk space and keeping the view stable.

### Robot Stand / Workspace

**[REHOSEUP Adjustable Stand (22–55", 33lb capacity)](https://www.amazon.com/dp/B0BNHHXHRS)**
Height-adjustable stand for mounting the robot arm or positioning equipment at the right working height. The 33lb weight rating handles the arm and any cabling easily.

### VR Headset (Optional — for immersive control)

Any PC-compatible VR headset works for immersive remote viewing and hand tracking. The web app supports XR mode (`/xr`) for headset-based control. Tested with:

- **Meta Quest 3** (recommended — standalone + PC link, good hand tracking)
- **Meta Quest 2** (budget option)

With a VR headset, the remote operator sees the robot's camera feed in stereoscopic 3D and controls the arm with natural hand gestures, with no physical controller required.

---

## Building the Hardware

### Step 1 — Assemble the SO-101

Follow the [official assembly guide](https://huggingface.co/docs/lerobot/en/assemble_so101). The main steps:

1. **Configure motors first** — before assembly, connect each motor via USB and run the LeRobot motor config script to assign IDs 1–6
2. **3D print** the arm parts (PLA works fine; TPU for the gripper fingers)
3. **Assemble bottom-up** — base motor → shoulder → elbow → wrist → gripper
4. **Connect the bus** — all 6 motors daisy-chain via 3-pin cables to the bus servo adapter → USB to PC
5. **Calibrate** — run `uv run simple-robot-server` and follow the prompts

Expect 4–8 hours for the full build if you're 3D printing. Assembled kits skip to step 5.

### Step 2 — Mount the Camera

Clamp the UBeesize arm to the desk edge. Position the stereo camera so it has a clear overhead or front-angled view of the robot's workspace. The camera should capture the full reach of the gripper, including the area where objects will be placed.

Plug the stereo camera into the PC via USB. It shows up as a standard webcam — no special drivers needed.

### Step 3 — Set Up the Stand

Place the robot arm on the adjustable stand or on a stable desk surface. The arm base should be at a height where it can reach the work surface comfortably. For table tasks (making tea, wiping a surface), having the arm at about desk height works well.

### Step 4 — Run Everything

1. Plug in the robot USB and power supply
2. Start the SimpleRobotServer
3. Start the web app
4. Join a room from another device (or another browser tab to test)

---

## What You Can Do With It

TeleTable is useful for **simple, slow-paced physical tasks** where you want to let someone remote help with something hands-on. Some examples:

- **Making tea** — moving a teabag, pressing a button on a kettle, placing a cup
- **Wiping a surface** — slow sweeping motions with a cloth attached to the gripper
- **Moving objects** — picking up and repositioning small items on a table
- **Simple button presses** — operating switches or controls
- **Demonstrating tasks** — showing someone how to do something physical

### Limitations

The SO-101 is a capable research arm, but it has real constraints for daily-life tasks:

**Range of motion** is the biggest bottleneck. The arm has a fixed base, so it can only reach objects within roughly a 30–40cm sphere in front of it. Anything outside that zone is unreachable. For kitchen tasks this means you need to carefully position everything within the arm's workspace before the session.

**No mobility** — the arm doesn't move around. It can only interact with what's already in front of it. This rules out tasks that require walking, reaching across rooms, or repositioning.

**Payload is light** — around 200–500g depending on reach distance. Heavy mugs or full teapots won't work well. Empty cups and light objects are fine.

**Speed is slow** — for safety and precision, commands are sent and actuated in near-real-time but the arm moves deliberately. Fast motions or reactive tasks (like catching something) aren't feasible.

**Gripper is binary** — the default gripper opens and closes but doesn't have fingertip sensitivity. Grabbing soft or irregularly shaped objects can be hit or miss.

Despite these limits, for carefully staged tasks in a fixed workspace, it's genuinely useful — especially for remote assistance where someone just needs a helping hand for a specific, simple thing.

---

## SimpleRobotServer Reference

The SimpleRobotServer is a lightweight Python WebSocket server that bridges the web app to the physical robot. No inverse kinematics — just direct joint angle commands.

**Protocol:** WebSocket on `ws://localhost:9000`

**Send joint command:**
```json
{ "type": "joint_control", "joints": [0.0, 0.5, -0.3, 0.2, 0.0, 50.0] }
```
Joints 0–4 are angles in radians. Joint 5 is gripper (0–100).

**Query current state:**
```json
{ "type": "get_joints" }
```

See `SimpleRobotServer/README.md` for the full protocol reference.

**Options:**
```bash
uv run simple-robot-server --simulation          # no physical robot needed
uv run simple-robot-server --host 0.0.0.0        # allow remote connections
uv run simple-robot-server --ws-port 8765        # custom port
uv run simple-robot-server --reset               # reconfigure from scratch
```

---

## Project Structure

```
teletable/
├── SimpleRobotServer/      # Python WebSocket server for robot control
│   ├── simple_robot_server.py
│   ├── requirements.txt
│   └── README.md
├── app/                    # Next.js web application
│   ├── rooms/[id]/         # Main room UI (host + client views)
│   ├── hooks/              # WebSocket, camera, PeerJS hooks
│   └── api/                # Room management API routes
├── public/SO101/           # Robot 3D model assets
└── README.md
```
