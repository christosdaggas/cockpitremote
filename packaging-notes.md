# Packaging notes for cockpitremote

This document describes how to package the plugin as RPM and DEB. A working
spec lives at `cockpit-cockpitremote.spec` in the repository root; there is no
CI packaging yet.

The package also installs `io.github.christosdaggas.cockpitremote.metainfo.xml`
to `/usr/share/metainfo/` (done by `make install`). The metainfo declares the
Cockpit launchable and the owning package name (`cockpit-cockpitremote`), so
Cockpit's *Applications* page can show it and remove it via PackageKit when it
was installed as a real RPM/DEB package.

Manual installs and `make devel-install` are not PackageKit-managed. Remove
those with `make uninstall PREFIX=/usr`/`make uninstall` or
`make devel-uninstall` instead.

## What gets installed

The **entire installable payload is the `dist/` directory** produced by
`make build` (Node is a *build*-time dependency only — nothing from
`node_modules` ships, everything is bundled into `dist/index.js`/`index.css`):

```
dist/index.html      →  <cockpit-dir>/cockpitremote/index.html
dist/index.js        →  <cockpit-dir>/cockpitremote/index.js
dist/index.css       →  <cockpit-dir>/cockpitremote/index.css
dist/index.js.LEGAL.txt (bundled licenses; keep for compliance)
dist/manifest.json   →  <cockpit-dir>/cockpitremote/manifest.json
```

Install path:

- RPM (Fedora/RHEL): `/usr/share/cockpit/cockpitremote`
- DEB (Debian/Ubuntu): `/usr/share/cockpit/cockpitremote`
- Manual/local builds: `/usr/local/share/cockpit/cockpitremote` (the
  Makefile default, `PREFIX=/usr/local`)

`make install PREFIX=/usr DESTDIR=%{buildroot}` does the right thing for both
package formats.

## Runtime dependencies

- `cockpit` ≥ 266 (RPM: `Requires: cockpit-bridge >= 266`; DEB:
  `Depends: cockpit-bridge (>= 266)`)
- Recommends (not Requires) a VNC server: `tigervnc-server` (RPM) /
  `tigervnc-standalone-server` (DEB). The plugin runs without one and guides
  the admin through installation, so a *Recommends*/*Suggests* relationship is
  correct.

## Build dependencies

- `nodejs` ≥ 18 and `npm` (network access for `npm ci` — for offline distro
  builds, vendor `node_modules` or use a bundled-tarball workflow like
  Fedora's `nodejs-packaging` guidelines; `package-lock.json` is committed).

## RPM spec skeleton

```spec
Name:           cockpit-cockpitremote
Version:        1.0.0
Release:        1%{?dist}
Summary:        Web-based remote desktop for Cockpit
License:        LGPL-2.1-or-later
URL:            https://github.com/christosdaggas/cockpitremote
Source0:        %{url}/archive/v%{version}/cockpitremote-%{version}.tar.gz
BuildArch:      noarch
BuildRequires:  nodejs >= 18, npm, make
Requires:       cockpit-bridge >= 266
Recommends:     tigervnc-server

%description
Cockpit application providing a browser-based remote desktop (noVNC over
Cockpit's authenticated WebSocket) to the host, with VNC backend detection,
service management, health checks and logs.

%prep
%autosetup -n cockpitremote-%{version}

%build
npm ci
NODE_ENV=production node build.js

%install
make install PREFIX=/usr DESTDIR=%{buildroot}

%files
%license LICENSE
%doc README.md
/usr/share/cockpit/cockpitremote
/usr/share/metainfo/io.github.christosdaggas.cockpitremote.metainfo.xml
```

## DEB outline

- `debian/control`: `Package: cockpit-cockpitremote`, `Architecture: all`,
  `Depends: cockpit-bridge (>= 266)`, `Suggests: tigervnc-standalone-server`,
  `Build-Depends: debhelper-compat (= 13), nodejs (>= 18), npm, make`.
- `debian/rules`: dh defaults with
  `override_dh_auto_build: npm ci && NODE_ENV=production node build.js`
  and `override_dh_auto_install: make install PREFIX=/usr DESTDIR=debian/cockpit-cockpitremote`.

## Post-install steps

None required. Cockpit discovers packages on login — no daemon reload, no
systemd unit belongs to this package itself.

Configuration created at runtime (not owned by the package, do **not**
remove on upgrade; consider `%ghost` in RPM):

- `/etc/cockpit/cockpitremote.json` — plugin settings
- `/etc/cockpitremote/` — x11vnc password file (created on demand, mode 700)

## systemd service requirements

The plugin *manages* third-party units (e.g. `vncserver@:1.service` from
tigervnc-server) but ships none of its own.
