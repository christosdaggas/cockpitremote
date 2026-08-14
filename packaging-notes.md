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
- `guacd` is required and enabled/started by the package because every browser
  console connection depends on it. GNOME Remote Desktop and the VNC/RDP guacd
  protocol plugins remain recommendations so the UI can report missing pieces.

## Build dependencies

- `nodejs` ≥ 18 and `npm` (network access for `npm ci` — for offline distro
  builds, vendor `node_modules` or use a bundled-tarball workflow like
  Fedora's `nodejs-packaging` guidelines; `package-lock.json` is committed).

## RPM spec skeleton

```spec
Name:           cockpit-cockpitremote
Version:        1.0.0
Release:        10%{?dist}
Summary:        Web-based remote desktop for Cockpit
License:        LGPL-2.1-or-later
URL:            https://github.com/christosdaggas/cockpitremote
Source0:        %{url}/archive/v%{version}/cockpitremote-%{version}.tar.gz
BuildArch:      noarch
BuildRequires:  nodejs >= 18, npm, make
Requires:       cockpit-bridge >= 266
Recommends:     gnome-remote-desktop
Requires:       guacd
Recommends:     libguac-client-vnc
Recommends:     libguac-client-rdp

%description
Cockpit application providing a browser-based remote desktop to the host, with
GNOME VNC/RDP through local guacd, backend detection, service management, health
checks and logs.

%prep
%autosetup -n cockpitremote-%{version}

%build
npm ci
NODE_ENV=production node build.js

%install
make install PREFIX=/usr DESTDIR=%{buildroot}

%post
systemctl enable --now guacd.service >/dev/null 2>&1 || :

%files
%license LICENSE
%doc README.md
/usr/share/cockpit/cockpitremote
/usr/share/metainfo/io.github.christosdaggas.cockpitremote.metainfo.xml
```

## DEB outline

- `debian/control`: `Package: cockpit-cockpitremote`, `Architecture: all`,
  `Depends: cockpit-bridge (>= 266), guacd`, `Recommends: gnome-remote-desktop, libguac-client-vnc, libguac-client-rdp`,
  `Build-Depends: debhelper-compat (= 13), nodejs (>= 18), npm, make`.
- `debian/rules`: dh defaults with
  `override_dh_auto_build: npm ci && NODE_ENV=production node build.js`
  and `override_dh_auto_install: make install PREFIX=/usr DESTDIR=debian/cockpit-cockpitremote`.

## Post-install steps

Enable and start `guacd.service` during installation. Cockpit discovers the UI
package on login; no daemon reload or extension-owned systemd unit is needed.

Configuration created at runtime (not owned by the package, do **not**
remove on upgrade; consider `%ghost` in RPM):

- `/etc/cockpit/cockpitremote.json` — plugin settings
- GNOME Remote Desktop stores its own secrets; the plugin does not own password files.

## systemd service requirements

The plugin *manages* GNOME Remote Desktop's `gnome-remote-desktop.service` but
ships no systemd unit of its own.
