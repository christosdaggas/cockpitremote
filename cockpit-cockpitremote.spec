Name:           cockpit-cockpitremote
Version:        1.0.0
Release:        1%{?dist}
Summary:        Web-based remote desktop for Cockpit
License:        LGPL-2.1-or-later
URL:            https://github.com/christosdaggas/cockpitremote
Source0:        cockpitremote-%{version}.tar.gz
BuildArch:      noarch
BuildRequires:  make
BuildRequires:  nodejs >= 18
BuildRequires:  npm
Requires:       cockpit-bridge >= 266
Recommends:     tigervnc-server

%description
Cockpit application providing a browser-based remote desktop (noVNC over
Cockpit's authenticated WebSocket) to the host, with VNC backend detection,
service management, health checks and logs.

%prep
%autosetup -n cockpitremote-%{version}

%build
npm ci --no-audit --no-fund
NODE_ENV=production node build.js

%install
make install PREFIX=/usr DESTDIR=%{buildroot}

%files
%license LICENSE
%doc README.md
/usr/share/cockpit/cockpitremote
/usr/share/metainfo/io.github.christosdaggas.cockpitremote.metainfo.xml

%changelog
* Sun Jul 05 2026 Christos A. Daggas <info@hotwebdesign.gr> - 1.0.0-1
- Initial package
