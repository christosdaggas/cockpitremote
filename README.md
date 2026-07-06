# cockpitremote — Remote Desktop for Cockpit

A [Cockpit](https://cockpit-project.org/) application that gives you a **fully
web-based remote desktop to the host machine**. Open Cockpit
(`https://your-server:9090`), click **Remote Desktop** under *Tools*, and view
or control the host's desktop right in the browser.

- **Nothing to install on the client PC.** VNC and RDP use
  [guacamole-common-js](https://guacamole.apache.org/) with local `guacd` on
  the host.
- **No extra open ports.** Console traffic is tunneled through Cockpit's own
  authenticated, TLS-encrypted WebSocket (the same mechanism cockpit-machines
  uses for VM consoles), so host services can stay local.
- **The host needs GNOME Remote Desktop.** The plugin focuses on GNOME Remote
  Desktop's VNC/RDP endpoints. It manages service state, sets GNOME VNC passwords safely, shows
  health checks, and streams service logs.

## Screenshots

*(placeholders — to be added)*

- `docs/screenshot-dashboard.png` — backend detection and health checks
- `docs/screenshot-console.png` — the remote desktop console
- `docs/screenshot-settings.png` — connection settings

## Features

| Tab | What it does |
| --- | --- |
| **Dashboard** | Detects GNOME Remote Desktop VNC/RDP, shows service state (active/enabled), version, health checks (transport, unit, port, session), and start/stop/restart/enable/disable with confirmation dialogs. |
| **Remote desktop** | Browser console for GNOME VNC and GNOME RDP through Guacamole/guacd: connect/disconnect, fullscreen, Send Ctrl+Alt+Del (confirmed), view-only mode, scale-to-fit, and authentication prompts. |
| **Settings** | Backend, systemd unit, address/port; set the GNOME VNC password via `grdctl` stdin — never argv, never logged. Saved to `/etc/cockpit/cockpitremote.json`. |
| **Logs** | Recent `journalctl` entries for the managed unit, with line-count and severity filters. |

## Supported distributions

Tested target platforms (Cockpit ≥ 266, i.e. any 2022+ release):

- Fedora Workstation/Server (38+, including Fedora 44)
- RHEL / CentOS Stream / AlmaLinux / Rocky 9+
- Debian 12+ and Ubuntu 22.04+
- openSUSE (best effort)

### Which backend should I use?

- **GNOME Remote Desktop.** Shares the physical GNOME session (Wayland or
  Xorg). The plugin probes `grdctl status` and connects to either GNOME VNC or
  GNOME RDP when available. Browser sessions require local `guacd` with the
  VNC/RDP protocol plugins installed.

## Requirements

- Cockpit ≥ 266 on the host
- GNOME Remote Desktop with VNC or RDP enabled
- `guacd`, `libguac-client-vnc`, and `libguac-client-rdp` on the host
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

## Quick start on Fedora / GNOME

```sh
sudo dnf install -y gnome-remote-desktop guacd libguac-client-vnc libguac-client-rdp
sudo systemctl enable --now guacd
grdctl vnc enable
grdctl vnc set-auth-method password
grdctl vnc set-password
```

Then select **GNOME Remote Desktop** in the plugin, verify port `5900`, and
connect from the **Remote desktop** tab. If your GNOME build is RDP-only, the
Dashboard will report that the VNC endpoint is unavailable.

For GNOME RDP:

```sh
grdctl rdp enable
```

Then select **GNOME RDP**, verify port `3389`, and connect from the **Remote desktop** tab.

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
│   ├── backends.ts      remote desktop backend detection (binaries, versions, units)
│   ├── channel.ts       builds Cockpit stream WebSocket URLs
│   ├── guacdTunnel.ts   raw guacd handshake/tunnel for browser VNC/RDP
│   ├── vncpassword.ts   grdctl password flow
│   ├── config.ts        /etc/cockpit/cockpitremote.json + localStorage prefs
│   ├── journal.ts, network.ts, session.ts
├── hooks/               useGuacd console state, useBackends, useConfig
├── components/          PatternFly 6 UI (tabs, cards, modals, console)
└── utils/               pure validation / parsing / error mapping / health logic
test/                    vitest suites incl. a shell-injection corpus
```

The browser transport uses Cockpit's stream channel to reach local `guacd` on
port `4822`. The browser-side Guacamole client performs the `guacd` handshake;
`guacd` then connects to GNOME Remote Desktop at the configured VNC/RDP address/port.

## Security notes

- **No shell interpolation anywhere.** Commands run via `cockpit.spawn()` with
  argument arrays built in a single module behind strict validators
  (unit names, ports, addresses, usernames, paths, package names). Invalid
  input is rejected, never "sanitized". A regression test suite feeds an
  injection corpus (`; rm -rf /`, `$(reboot)`, option injection, …) to every
  builder.
- **Passwords** for GNOME VNC are fed to `grdctl` on stdin, never placed in
  argv, logs or the config file. RDP credentials are prompted per connection and
  are not persisted.
- **Privileges**: reads use `superuser: "try"`; mutations (service control,
  config save, password files) use `superuser: "require"`,
  which triggers Cockpit's standard privilege escalation. Without admin
  access the UI degrades gracefully and tells you what's missing.
- **Network exposure**: none added. The plugin recommends and health-checks
  that the VNC server listens on loopback only; a warning appears if it is
  reachable from the network.
- Destructive actions (stop/restart service, Ctrl+Alt+Del)
  require an explicit confirmation dialog.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Plugin missing from the Cockpit menu | Re-log into Cockpit; check the symlink/`/usr/local/share/cockpit/cockpitremote` exists and contains `manifest.json`. |
| "Could not reach the VNC server at 127.0.0.1:5900" | Dashboard → is GNOME Remote Desktop active and is VNC enabled in `grdctl status`? Health says whether the port is listening. |
| "guacd is not listening on port 4822" | Install `guacd`, `libguac-client-vnc`, `libguac-client-rdp`, and start `guacd.service`; the browser console needs this local gateway. |
| "Permission denied" alerts | Click your user menu in Cockpit and turn on *Administrative access*. |
| Authentication fails in the console | Reset the password via Settings → *Set VNC password…* (remember classic VNC uses only the first 8 characters). |
| Black screen after connecting | Verify the GNOME session is unlocked and the remote desktop service belongs to the same user you use in Cockpit. |

## Manual testing checklist

- [ ] Plugin appears in the Cockpit menu under Tools
- [ ] Dashboard loads and finishes detection without console errors
- [ ] Refresh updates backend status
- [ ] Start / Stop / Restart / Enable / Disable work and show toasts
- [ ] Stop/Restart ask for confirmation first
- [ ] Without admin access, mutations show a clear permission message
- [ ] Settings rejects an invalid unit name / port / geometry / username
- [ ] Settings save persists to `/etc/cockpit/cockpitremote.json`
- [ ] Set VNC password works through GNOME Remote Desktop
- [ ] Remote desktop connects to GNOME Remote Desktop on 127.0.0.1:5900 when VNC is available
- [ ] Remote desktop connects to GNOME RDP on 127.0.0.1:3389 when RDP and guacd are available
- [ ] Password prompt appears when the server requires auth; wrong password shows a clear error and Retry works
- [ ] View-only blocks input; scale/quality/compression apply live
- [ ] Fullscreen enter/exit works; Ctrl+Alt+Del asks for confirmation
- [ ] Disconnecting shows the Disconnected state with Reconnect
- [ ] Logs display, refresh, and filter by severity
- [ ] Layout stays usable at narrow (mobile) widths
- [ ] Browser console shows no serious errors during all of the above

## Known limitations

- Browser console support depends on local `guacd` with VNC/RDP protocol plugins installed.
- Managing user-scoped systemd units (`systemctl --user`) is not supported.
- No automated end-to-end console tests; covered by the manual checklist.
- English only (no i18n yet).

## Future improvements

- Clipboard sharing UI in the console toolbar
- PatternFly 6 migration to match the newest Cockpit shell styling
- RPM/DEB packaging in CI (see `packaging-notes.md`)
- i18n via cockpit's gettext support

## License

LGPL-2.1-or-later (matching the Cockpit ecosystem). See `LICENSE`.
