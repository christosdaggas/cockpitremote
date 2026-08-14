# cockpitremote — Remote Desktop for Cockpit

<img width="100%" height="auto" alt="image" src="https://github.com/user-attachments/assets/59061614-5056-44b8-a332-cc57a17d3b58" />


A [Cockpit](https://cockpit-project.org/) application that gives you a **fully
web-based remote desktop to the host machine**. Open Cockpit
(`https://your-server:9090`), click **Remote Desktop** under *Tools*, and view
or control the host's desktop right in the browser.

- **Nothing to install on the client.** No VNC/RDP viewer, no browser
  extension, no Java. The console is [guacamole-common-js](https://guacamole.apache.org/)
  running in the page.
- **No extra open ports.** Console traffic is tunneled through Cockpit's own
  authenticated, TLS-encrypted WebSocket — the same mechanism `cockpit-machines`
  uses for VM consoles — so `guacd` and the desktop service can stay bound to
  loopback.
- **Built around GNOME Remote Desktop.** The plugin detects its VNC and RDP
  endpoints, manages the service, sets GNOME VNC passwords safely, and shows
  health checks and logs.

## What it does

| Tab | What it does |
| --- | --- |
| **Dashboard** | Detects GNOME Remote Desktop's VNC/RDP endpoints, shows service state, version and health checks (transport, unit, port, session), and offers start/stop/restart/enable/disable with confirmation dialogs. |
| **Remote desktop** | The browser console: connect/disconnect, fullscreen, Send Ctrl+Alt+Del (confirmed), a clipboard panel, view-only, scale-to-fit, clipboard sync, and a credentials prompt per connection. |
| **Settings** | Backend, RDP session mode, VNC session mode, systemd unit, address and port. Sets the GNOME VNC password through `grdctl` stdin — never argv, never logged. Saved to `/etc/cockpit/cockpitremote.json`. |
| **Logs** | Recent `journalctl` entries for the managed unit, filtered by line count and severity. |

### Keyboard and clipboard

Keyboard input is captured at the document level while the console has focus and
forwarded as X11 keysyms. Clipboard sync works in both directions:

- **Into the session** — press `Ctrl+V` (or `Cmd+V`). The plugin reads the local
  clipboard from the browser's own paste event, sends it to `guacd`, and only
  then replays the shortcut to the remote, so the remote pastes what you
  actually copied locally.
- **Out of the session** — text copied on the remote desktop is written to your
  local clipboard on a best-effort basis.

Both halves depend on browser permissions that quietly refuse: Firefox only
allows a clipboard write while handling a user gesture, and a browser that
suppresses the paste event leaves nothing to forward. The toolbar's
**Clipboard** button is the manual path for those cases — it shows the last
selection copied on the remote with a *Copy* button (the click is the gesture
Firefox wants), and a box for sending text the other way without a shortcut.

A selection arriving from the remote is capped at one mebibyte; the stream is
server-driven, so an unbounded one could grow the page's memory until the tab
died.

### RDP session modes

GNOME Remote Desktop can run **two independent daemons at once**, and Settings
lets you pick which one the console connects to:

| Mode | Session | Resolution |
| --- | --- | --- |
| **Screen sharing** | Mirrors the logged-in GNOME session — you see the physical screen | Fixed by the real monitor; fullscreen letterboxes when aspect ratios differ |
| **Remote Login** | A headless session created for you (GNOME's *Remote Login*) | Adopts whatever the browser asks for, so fullscreen fills the window exactly |

The plugin reads both configurations (`grdctl status` and
`grdctl --system status`) and connects to the right port for the selected mode.
Note that when both daemons run, GNOME negotiates a second port for the
user-session daemon — typically `3390`, because the system daemon already holds
`3389`. The Dashboard reports the port it detected.

### VNC session modes

VNC has no second daemon, but it does choose where its picture comes from, and
Settings offers the same choice:

| Mode | Screen | Resolution |
| --- | --- | --- |
| **Screen sharing** | Records the primary monitor of the logged-in GNOME session | Fixed by the real monitor |
| **Virtual monitor** | A screen created for the connection — no physical monitor needed | Starts at 1920x1080, then follows the browser |

This one is GNOME's own setting rather than a plugin preference, so the plugin
reads and writes it directly:

```sh
gsettings get org.gnome.desktop.remote-desktop.vnc screen-share-mode
```

It matters more than it sounds. In screen-sharing mode there must be a session
sitting at a monitor to record — if the only session is a headless *Remote
Login*, or the machine was rebooted and nobody logged in locally, GNOME logs
`Failed to record monitor: Unknown monitor` and drops the connection right
after authentication. Picking the virtual monitor removes that requirement.
Either way the change applies to the next connection; sessions already running
keep the screen they started with.

## How it works

```
browser (Cockpit page)
   │  Guacamole protocol over a Cockpit "stream" channel  (wss://…/cockpit/channel/<csrf>)
   ▼
cockpit-ws / cockpit-bridge on the host
   │  raw TCP to 127.0.0.1:4822
   ▼
guacd
   │  RDP or VNC to the configured address/port
   ▼
GNOME Remote Desktop
```

The browser speaks the Guacamole wire protocol **directly to `guacd`**. There is
no Guacamole web application, no Tomcat and no `guacamole-server` REST API in the
picture — `src/services/guacdTunnel.ts` implements the tunnel itself and performs
the `guacd` handshake in the page:

1. `select` announces the protocol (`rdp` or `vnc`).
2. `guacd` replies with `args`, the list of parameters it accepts.
3. The client answers with `size`, `audio`, `video`, `image`, `timezone`, `name`
   and finally `connect`, filling in each requested argument by name. Arguments
   `guacd` did not ask for are never sent, so the same code works across `guacd`
   versions.
4. `guacd` replies `ready`, and the session begins.

Because the transport is a Cockpit channel, it inherits Cockpit's authentication
and TLS — the host never needs to expose 4822, 3389 or 5900 to the network.

Two details worth knowing if you read the code:

- **Key events** go out as `key,<keysym>,<1|0>`. `guacd` parses the pressed flag
  numerically, so it must be `1`/`0` — sending `true`/`false` silently turns
  every keypress into a key release.
- **Scaling** fits the remote display inside the console box and centres it. The
  scale is recomputed only when the box or the remote resolution actually
  changes, so a running session does not force a layout reflow on every frame.

## Requirements

- Cockpit ≥ 266 on the host
- GNOME Remote Desktop with RDP or VNC enabled
- `guacd` plus `libguac-client-rdp` / `libguac-client-vnc` on the host — pulled
  in automatically by the RPM, which also enables and starts `guacd.service`
- Administrative access in Cockpit for service control, saving settings and
  password management. Read-only use works without it; the UI degrades
  gracefully and says what is missing.

Verified on Fedora 44 with GNOME Remote Desktop and `guacd` 1.6. Other
Cockpit ≥ 266 platforms (RHEL/CentOS Stream/Alma/Rocky 9+, Debian 12+,
Ubuntu 22.04+, openSUSE) are expected to work but are not routinely tested.

## Installation

### From a release (recommended)

Download the RPM from the [releases page](https://github.com/christosdaggas/cockpitremote/releases)
and install it:

```sh
sudo dnf install ./cockpit-cockpitremote-1.0.0-11.fc44.noarch.rpm
```

Then hard-reload Cockpit in the browser so it drops the cached bundle. If the
menu entry does not appear, log out of Cockpit and back in — packages are
scanned at login.

### From source, system-wide

```sh
git clone https://github.com/christosdaggas/cockpitremote.git
cd cockpitremote
make                    # npm install + production build into dist/
sudo make install       # copies dist/ to /usr/local/share/cockpit/cockpitremote
```

Use `sudo make install PREFIX=/usr` to install to `/usr/share/cockpit` instead
(the path distribution packages use). Uninstall with `sudo make uninstall`.

> Cockpit searches `~/.local/share/cockpit`, then `/usr/local/share/cockpit`,
> then `/usr/share/cockpit`. A leftover copy in an earlier path silently wins
> over a later one — worth checking if an update seems not to apply.

### For development

```sh
make devel-install      # builds and symlinks dist/ into ~/.local/share/cockpit
make devel-uninstall    # removes the symlink
```

## Quick start on Fedora / GNOME

```sh
sudo dnf install -y gnome-remote-desktop guacd libguac-client-rdp libguac-client-vnc
sudo systemctl enable --now guacd
grdctl rdp enable
grdctl rdp set-credentials            # prompts for username and password
```

Select **GNOME RDP** in the plugin, check the port the Dashboard reports, and
connect from the **Remote desktop** tab.

For VNC (only on GNOME builds that still ship the VNC backend — recent versions
are RDP-only, and the Dashboard will tell you):

```sh
grdctl vnc enable
grdctl vnc set-auth-method password
grdctl vnc set-password
```

To use **Remote Login** instead of screen sharing, enable it in GNOME Settings
under *System → Remote Desktop → Remote Login*, then pick it in the plugin's
Settings.

## Building and developing

```sh
npm install       # install dependencies
npm run build     # production build into dist/
npm run watch     # rebuild on change
npm run test      # unit tests (vitest)
npm run lint      # eslint
```

Packaging an RPM is documented in [`packaging-notes.md`](packaging-notes.md); the
spec lives at `cockpit-cockpitremote.spec`.

## Architecture

```
src/
├── lib/cockpit.ts       typed shim over the cockpit.js runtime global
├── services/            ALL system interaction (no React here)
│   ├── commands.ts      the only place argv arrays are built — every input validated
│   ├── spawn.ts         cockpit.spawn wrappers (LC_ALL=C, probe helper)
│   ├── systemd.ts       unit status + start/stop/restart/enable/disable
│   ├── backends.ts      endpoint detection (binaries, versions, units, ports)
│   ├── channel.ts       builds Cockpit stream WebSocket URLs
│   ├── guacdTunnel.ts   the guacd handshake and tunnel described above
│   ├── vncpassword.ts   grdctl password flow
│   ├── config.ts        /etc/cockpit/cockpitremote.json + localStorage prefs
│   └── journal.ts, network.ts, session.ts
├── hooks/               useGuacd (console, keyboard, clipboard), useBackends, useConfig
├── components/          PatternFly 6 UI (tabs, cards, modals, console)
└── utils/               pure validation / parsing / error mapping / health logic
test/                    vitest suites incl. a shell-injection corpus
```

Machine-wide settings live in `/etc/cockpit/cockpitremote.json` so every admin
session sees the same target. Cosmetic per-user preferences (scale-to-fit,
view-only, log filters) live in `localStorage`.

## Security notes

- **No shell interpolation anywhere.** Commands run via `cockpit.spawn()` with
  argument arrays built in a single module behind strict validators (unit names,
  ports, addresses, usernames, paths). Invalid input is rejected, never
  "sanitized". A regression suite feeds an injection corpus (`; rm -rf /`,
  `$(reboot)`, option injection, …) to every builder.
- **Passwords** for GNOME VNC are fed to `grdctl` on stdin, never placed in
  argv, logs or the config file. RDP credentials are prompted per connection and
  are not persisted.
- **Privileges**: reads use `superuser: "try"`; mutations (service control,
  config save, passwords) use `superuser: "require"`, which triggers Cockpit's
  standard privilege escalation.
- **Network exposure**: none added. The plugin health-checks that the desktop
  service listens on loopback and warns when it is reachable from the network.
- **Clipboard**: nothing crosses on its own. Data moves only when you paste, or
  when the remote puts something on its clipboard during an active session.
- Destructive actions (stop/restart service, Ctrl+Alt+Del) require an explicit
  confirmation dialog.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Plugin missing from the Cockpit menu | Re-log into Cockpit; check the install path contains `manifest.json`, and that no stale copy shadows it in an earlier search path. |
| "guacd is not listening on port 4822" | Install `guacd` and the protocol plugins and start `guacd.service`. Note that removing this plugin can take `guacd` with it, since it is pulled in as a dependency. |
| Cannot reach the desktop service | Dashboard → is GNOME Remote Desktop active, and is RDP/VNC enabled in `grdctl status`? Health reports whether the port is listening. |
| Connects to the wrong session | Check the RDP session mode in Settings. Screen sharing and Remote Login are different daemons on different ports. |
| "Permission denied" alerts | Open your user menu in Cockpit and turn on *Administrative access*. |
| Black screen after connecting | In screen-sharing mode the GNOME session must be unlocked and belong to the same user you use in Cockpit. |
| VNC drops the connection straight after the password | Screen sharing has no monitor to record — the journal says `Unknown monitor`. Log in at the physical screen, or switch the VNC session to the virtual monitor in Settings. |
| Changes seem not to apply after an update | Hard-reload the browser — Cockpit caches the bundle. |

## Known limitations

- The browser console requires local `guacd` with the RDP/VNC protocol plugins.
- Pasting into the remote uses the browser's paste event, so it works through
  `Ctrl+V` / `Cmd+V` but not through the browser's Edit menu.
- Copying *out* relies on `navigator.clipboard.writeText()`, which Firefox only
  permits during a user gesture; the copy is dropped silently when refused.
- Image quality and compression are VNC-only `guacd` parameters and apply on the
  next connection, not to a running session. The RDP client has no equivalent.
- In screen-sharing mode the remote resolution cannot be changed, so fullscreen
  letterboxes when aspect ratios differ. Remote Login and the VNC virtual
  monitor have no such limit.
- Managing user-scoped systemd units (`systemctl --user`) is not supported.
- No automated end-to-end console tests.
- Translations cover the plugin's own strings, not PatternFly's or Cockpit's
  shell.

## Translations

The interface ships in **English, Greek, German, Italian, French and
Portuguese**. Nothing selects a language: `index.html` asks for `po.js`, and
cockpit-ws serves whichever `po.<lang>.js` matches the browser's
`Accept-Language`, exactly as the stock Cockpit pages do. English is the source
language and has no catalogue — gettext returns the string it was given
whenever no translation exists, which is also what makes a partly translated
catalogue safe.

Catalogues live in `po/<lang>.json` as plain `"English source": "translation"`
maps, and `build.js` turns each one into the `cockpit.locale()` call Cockpit
expects. To add a language, drop in another JSON file; the build picks it up by
filename.

Strings are marked in the source with `_()`, or with `N_()` where the text is
written in a table of constants and translated at the point it is read.
`test/i18n.test.ts` extracts those markers and fails the build if a catalogue
is missing an entry, carries one the code no longer uses, leaves a translation
empty, or drops a `$0` placeholder — so a reworded string cannot quietly fall
back to English.

## Roadmap

- Optional reduced-resolution rendering for slow links
- RPM/DEB packaging in CI

## License

Copyright © 2026 Christos A. Daggas.

Released under the **GNU Lesser General Public License, version 2.1 or any
later version** (`LGPL-2.1-or-later`) — the same license as Cockpit itself. The
full text is in [`LICENSE`](LICENSE), and every source file carries an
[SPDX](https://spdx.dev/) identifier saying so.

You are free to use, study, share and modify this plugin, including
commercially. If you distribute a modified version, that version has to stay
under the same license and its source has to be available. There is no
warranty of any kind.

### Third-party code

The build bundles other people's work into `index.js`, all of it under
permissive licenses that impose nothing on yours:

| Component | License |
| --- | --- |
| [React](https://react.dev/) | MIT |
| [PatternFly](https://www.patternfly.org/) | MIT |
| [guacamole-common-js](https://guacamole.apache.org/) | Apache-2.0 |

Their notices are collected at build time into `index.js.LEGAL.txt`, which
ships beside the bundle in the package, so the attribution travels with the
binary. Cockpit's own `cockpit.js` is **not** bundled — the shell provides it at
runtime — so nothing here links against LGPL code at build time.
