Name:           cockpit-cockpitremote
Version:        1.0.0
Release:        10%{?dist}
Summary:        Web-based remote desktop for Cockpit
License:        LGPL-2.1-or-later
URL:            https://github.com/christosdaggas/cockpitremote
Source0:        cockpitremote-%{version}.tar.gz
BuildArch:      noarch
BuildRequires:  make
BuildRequires:  nodejs >= 18
BuildRequires:  npm
Requires:       cockpit-bridge >= 266
Recommends:     gnome-remote-desktop
Requires:       guacd
Recommends:     libguac-client-vnc
Recommends:     libguac-client-rdp

%description
Cockpit application providing a browser-based remote desktop to the host, with
GNOME VNC/RDP through local guacd, backend detection, service management,
health checks and logs.

%prep
%autosetup -n cockpitremote-%{version}

%build
npm ci --no-audit --no-fund
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

%changelog
* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-10
- Count Guacamole instruction lengths in Unicode code points instead of UTF-16
  units, so a character outside the basic plane can no longer desynchronise the
  stream to guacd (the framing flaw of CVE-2023-30575)
- Cap a clipboard selection arriving from the remote desktop, which was
  collected without any limit and could grow the page's memory unchecked

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-9
- Add a VNC session selector in Settings, matching the RDP one: share the
  logged-in desktop, or give the connection its own virtual monitor so VNC
  works with no physical screen attached
- Report the VNC screen mode on the Dashboard and warn that screen sharing
  refuses connections when no session is logged in at a monitor, which GNOME
  otherwise only reports as "Unknown monitor" in its journal

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-8
- Stop the remote screen overhanging the console to the right and bottom in
  fullscreen: the remote pointer is clipped at the screen edge instead of
  enlarging the scroll area, and scaling now measures the space left by the
  scrollbars rather than the space they occupy
- Do not scroll the console at all while "Scale to fit" is on, since the
  display is sized to the box

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-7
- Stop forcing a layout reflow and three inline style writes on every synced
  frame; the console is only rescaled when its size or the remote resolution
  actually changes
- Apply the console's quality and compression preferences to the VNC
  connection, which previously used hardcoded levels, and show the controls
  only for VNC where guacd supports them

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-6
- Centre the remote display and drop the focus outline, so fullscreen no longer
  leaves the picture pinned top-left behind a blue box
- Size the fullscreen console from the element instead of vh units, which
  resolve against Cockpit's iframe rather than the screen
- Add an RDP session selector in Settings to connect either to GNOME screen
  sharing or to the headless Remote Login daemon

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-5
- Fix keyboard input being ignored by the remote desktop: the key-pressed flag
  is now sent as 1/0, which guacd parses, instead of true/false, which it read
  as 0 and treated as a key release
- Sync the clipboard between the browser and the remote desktop, so Ctrl+V
  pastes the local clipboard into the session

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-4
- Connect to the negotiated per-user GNOME RDP port instead of system Remote Login

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-3
- Capture RDP keyboard input at the document level while the console has focus

* Fri Aug 14 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-2
- Enable and start guacd automatically
- Fix RDP keyboard focus and duplicate cursor display

* Sun Jul 05 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-1
- Initial package
