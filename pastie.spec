Summary: A simple, internal paste bin
Name: pastie
Version: 0
Release: 1
License: AppNexus, Inc.
Group: Applications/Internet
Source: %{name}-%{version}.tar.gz
Vendor: AppNexus, Inc.
Packager: DevOps <devops@appnexus.com>
BuildRoot: %{_tmppath}/%{name}-%{version}-buildroot
Requires: nodejs >= 0.12
Requires: redis

%description
Pastie is a paste bin application similar to gist.github.com

%prep

%setup -q

%build

%install
%{__mkdir_p} %{buildroot}/usr/local/adnxs/%{name}/%{version}
%{__cp} -r node_app %{buildroot}/usr/local/adnxs/%{name}/%{version}
%{__mkdir_p} %{buildroot}/etc/init.d
%{__cp} %{name}.init %{buildroot}/etc/init.d/%{name}

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root)
/etc/init.d/%{name}
/usr/local/adnxs/%{name}/%{version}

%post
ln -sfn /usr/local/adnxs/%{name}/%{version} /usr/local/adnxs/%{name}/current

%preun
# stop service when uninstalling [http://stackoverflow.com/questions/8854882]
if [ "$1" == "0" ]; then
    sudo service %{name} stop
fi

%postun
rm -rf /usr/local/adnxs/%{name}/%{version}
