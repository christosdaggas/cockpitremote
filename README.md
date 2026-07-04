# cockpitremote — Remote Desktop for Cockpit

A [Cockpit](https://cockpit-project.org/) application that gives you a **fully
web-based remote desktop to the host machine**. Open Cockpit
(`https://your-server:9090`), click **Remote Desktop** under *Tools*, and view
or control the host's desktop right in the browser.

- **Nothing to install on the client PC.** The VNC client is
  [noVNC](https://novnc.com/), pure JavaScript running in your browser.
- **No extra open ports.** VNC traffic is tunneled through Cockpit's own
  authenticated, TLS-encrypted WebSocket (the same mechanism cockpit-machines
  uses for VM consoles), so the VNC server on the host can stay bound to
  `127.0.0.1`.
- **The host needs a VNC server** (TigerVNC recommended). The plugin detects
  what is installed, manages its systemd service, helps you set it up, sets
  VNC passwords safely, shows health checks, and streams service logs.

## Screenshots

*(placeholders — to be added)*

- `docs/screenshot-dashboard.png` — backend detection and health checks
- `docs/screenshot-console.png` — the remote desktop console
- `docs/screenshot-settings.png` — connection settings

## Features

| Tab | What it does |
| --- | --- |
| **Dashboard** | Detects TigerVNC / x11vnc / wayvnc / GNOME Remote Desktop, shows service state (active/enabled), version, health checks (transport, unit, port, session), start/stop/restart/enable/disable with confirmation dialogs, and a guided setup (copyable or one-click package install). |
| **Remote desktop** | The noVNC console: connect/disconnect, fullscreen, Send Ctrl+Alt+Del (confirmed), view-only mode, scale-to-fit, quality/compression levels, VNC password prompt on demand. |
| **Settings** | Backend, systemd unit, address/port, TigerVNC session user and geometry; set the VNC password (stored obfuscated with mode 600, fed to `vncpasswd` via stdin — never argv, never logged). Saved to `/etc/cockpit/cockpitremote.json`. |
| **Logs** | Recent `journalctl` entries for the managed unit, with line-count and severity filters. |

## Supported distributions

Tested target platforms (Cockpit ≥ 266, i.e. any 2022+ release):

- Fedora Workstation/Server (38+, including Fedora 44)
- RHEL / CentOS Stream / AlmaLinux / Rocky 9+
- Debian 12+ and Ubuntu 22.04+
- openSUSE (best effort)

### Which VNC backend should I use?

- **TigerVNC (recommended, and the primary supported path).** Runs a separate
  *virtual* desktop session on the host — ideal for servers and required on
  modern Fedora/RHEL Workstation, where the physical GNOME **Wayland** session
  cannot be shared over VNC at all (x11vnc needs Xorg, wayvnc needs a wlroots
  compositor, and GNOME Remote Desktop dropped VNC in favor of RDP).
- **x11vnc.** Mirrors the physical monitor, but only for Xorg sessions.
- **wayvnc.** Only for wlroots compositors (Sway, Hyprland, …).
- **GNOME Remote Desktop** is detected and shown for information only.

## Requirements

- Cockpit ≥ 266 on the host
- A VNC server on the host (the Dashboard's setup guide installs one for you)
- Administrative access in Cockpit for service control, config saving and
  password management (reads work without it)

## Installation

### From source, system-wide

```sh
git clone https://github.com/christosdaggas/cockpitremote.git
cd cockpitremote
make                    # npm install + production build into dist/
sudo make install       # copies dist/ to /usr/local/share/cockpit/cockpitremote
```

Use `sudo make install PREFIX=/usr` to install to `/usr/share/cockpit` instead
(the path used by distribution packages). Uninstall with `sudo make uninstall`.

### For development (symlink into your user's Cockpit packages)

```sh
make devel-install      # builds and symlinks dist/ to ~/.local/share/cockpit/cockpitremote
```

Then open Cockpit and find **Remote Desktop** under *Tools*:

```
https://localhost:9090
```

Log in as your user. If the menu entry doesn't appear, log out of Cockpit and
back in (Cockpit scans packages at login).

Remove the development symlink with:

```sh
make devel-uninstall    # removes ~/.local/share/cockpit/cockpitremote
```

## Quick start on Fedora / RHEL (TigerVNC)

```sh
sudo dnf install -y tigervnc-server
echo ":1=YOUR_USERNAME" | sudo tee -a /etc/tigervnc/vncserver.users
```

Then in the plugin: **Settings → backend "TigerVNC" → Session user →
Set VNC password…**, back on the **Dashboard** press **Start** (and
**Enable on boot**), and connect from the **Remote desktop** tab. Display `:1`
corresponds to port `5901` — the Settings tab pre-fills this for you.

On Debian/Ubuntu install `tigervnc-standalone-server` instead.

## Building and developing

```sh
npm install       # install dependencies
npm run build     # production build into dist/
npm run watch     # rebuild on change
npm run test      # unit tests (vitest)
npm run lint      # eslint
make              # same as npm install + npm run build
make test         # same as npm run test
```

## Architecture

```
src/
├── lib/cockpit.ts       typed shim over the cockpit.js runtime global
├── services/            ALL system interaction (no React here)
│   ├── commands.ts      the only place argv arrays are built — every input validated
│   ├── spawn.ts         cockpit.spawn wrappers (LC_ALL=C, probe helper)
│   ├── systemd.ts       unit status + start/stop/restart/enable/disable
│   ├── backends.ts      VNC server detection (binaries, versions, units)
│   ├── channel.ts       builds the Cockpit channel WebSocket URL for noVNC
│   ├── vncpassword.ts   vncpasswd-via-stdin password flow
│   ├── config.ts        /etc/cockpit/cockpitremote.json + localStorage prefs
│   ├── journal.ts, network.ts, session.ts, osinfo.ts, packages.ts
├── hooks/               useRfb (console state machine), useBackends, useConfig
├── components/          PatternFly 5 UI (tabs, cards, modals, console)
└── utils/               pure validation / parsing / error mapping / health logic
test/                    vitest suites incl. a shell-injection corpus
```

The remote desktop transport: noVNC's `RFB` is pointed at
`wss://<host>/cockpit/channel/<csrf-token>?<base64 JSON>` where the JSON
describes a raw `stream` channel to `127.0.0.1:<port>`. Cockpit's bridge opens
that TCP connection on the host, so the browser never talks to the VNC server
directly and the Cockpit session's authentication and encryption apply.

## Security notes

- **No shell interpolation anywhere.** Commands run via `cockpit.spawn()` with
  argument arrays built in a single module behind strict validators
  (unit names, ports, addresses, usernames, paths, package names). Invalid
  input is rejected, never "sanitized". A regression test suite feeds an
  injection corpus (`; rm -rf /`, `$(reboot)`, option injection, …) to every
  builder.
- **Passwords** are fed to `vncpasswd -f` on stdin, written obfuscated with
  mode 600 (root- or session-user-owned), never placed in argv, state, logs or
  the config file.
- **Privileges**: reads use `superuser: "try"`; mutations (service control,
  config save, password files, package install) use `superuser: "require"`,
  which triggers Cockpit's standard privilege escalation. Without admin
  access the UI degrades gracefully and tells you what's missing.
- **Network exposure**: none added. The plugin recommends and health-checks
  that the VNC server listens on loopback only; a warning appears if it is
  reachable from the network.
- Destructive actions (stop/restart service, Ctrl+Alt+Del, package install)
  require an explicit confirmation dialog.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Plugin missing from the Cockpit menu | Re-log into Cockpit; check the symlink/`/usr/local/share/cockpit/cockpitremote` exists and contains `manifest.json`. |
| "Could not reach the VNC server at 127.0.0.1:5901" | Dashboard → is the service active? Health says whether the port is listening. TigerVNC: check `/etc/tigervnc/vncserver.users` maps `:1` to a real user and the user has a VNC password. |
| "Permission denied" alerts | Click your user menu in Cockpit and turn on *Administrative access*. |
| Authentication fails in the console | Reset the password via Settings → *Set VNC password…* (remember classic VNC uses only the first 8 characters). |
| Black screen after connecting | The virtual session may still be starting; wait a few seconds or check Logs. |
| TigerVNC unit fails immediately | `journalctl -u vncserver@:1` (or the Logs tab). A common cause is a missing `~/.vnc/passwd` for the mapped user. |

## Manual testing checklist

- [ ] Plugin appears in the Cockpit menu under Tools
- [ ] Dashboard loads and finishes detection without console errors
- [ ] Refresh updates backend status
- [ ] Start / Stop / Restart / Enable / Disable work and show toasts
- [ ] Stop/Restart ask for confirmation first
- [ ] Without admin access, mutations show a clear permission message
- [ ] Setup guide shows the right package manager commands for the distro
- [ ] Settings rejects an invalid unit name / port / geometry / username
- [ ] Settings save persists to `/etc/cockpit/cockpitremote.json`
- [ ] Set VNC password works; `~user/.vnc/passwd` is mode 600
- [ ] Remote desktop connects to a running TigerVNC on 127.0.0.1
- [ ] Password prompt appears when the server requires auth; wrong password shows a clear error and Retry works
- [ ] View-only blocks input; scale/quality/compression apply live
- [ ] Fullscreen enter/exit works; Ctrl+Alt+Del asks for confirmation
- [ ] Disconnecting shows the Disconnected state with Reconnect
- [ ] Logs display, refresh, and filter by severity
- [ ] Layout stays usable at narrow (mobile) widths
- [ ] Browser console shows no serious errors during all of the above

## Known limitations

- The physical **GNOME Wayland** session cannot be mirrored (upstream
  limitation: no VNC server supports Mutter; GNOME Remote Desktop is
  RDP-only). A TigerVNC *virtual* desktop is the supported alternative.
- wayvnc password/TLS configuration is not managed by the plugin (v1).
- Managing user-scoped systemd units (`systemctl --user`) is not supported.
- No automated end-to-end console tests; covered by the manual checklist.
- English only (no i18n yet).

## Future improvements

- RDP backend via gnome-remote-desktop for live GNOME session sharing
- Clipboard sharing UI in the console toolbar
- Editing `/etc/tigervnc/vncserver.users` and `~/.vnc/config` from Settings
- PatternFly 6 migration to match the newest Cockpit shell styling
- RPM/DEB packaging in CI (see `packaging-notes.md`)
- i18n via cockpit's gettext support

## License

LGPL-2.1-or-later (matching the Cockpit ecosystem). See `LICENSE`.
