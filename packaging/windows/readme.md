# Windows Build Setup
## Building Client Executables
[go for windows](https://golang.org/dl)

Environment: `set GOPATH=C:\work`

[git for windows](https://git-scm.com/downloads)
- Select "Use Git and optional Unix tools from the Command Prompt" (so scripts with `rm` will work)
- Checkout as-is, conmmit Unix style line endings
- Use Windows' default console window (especially on Windows 10)

- Open a command console and make a directory for cloning the repo, e.g.:
```
git clone https://github.com/keybase/client.git c:\work\src\github.com\keybase\client
git clone https://github.com/keybase/go-updater.git c:\work\src\github.com\keybase\go-updater
```

- set GOPATH, e.g. `set GOPATH=c:\work`
- `cd %GOPATH%\src\github.com\keybase\client\go\keybase`
- `go build`

[Chocolatey](https://chocolatey.org/install) (helpful for yarn)
then: `choco install yarn`

[node version manager](https://github.com/coreybutler/nvm-windows)
`nvm install latest`
`nvm use [version]`

[GCC via Mingw-64](https://sourceforge.net/projects/mingw-w64/) (for building kbfsdokan)
- Be sure and choose architecture x86-64, NOT i686
- Also recommend not installing in `program files`
  - Try `C:\mingw-w64\.... instead`

Environment:
```
set PATH=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\bin;%PATH%
set CC=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\bin\gcc
set CPATH=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\include
```

## Building Installers

[Visual Studio 2015 Professional](https://visualstudio.microsoft.com/vs/older-downloads/)
(may require live.com account)

Environment:
`call "C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\Tools\vsvars32.bat"`

[.net 3.5.1](https://www.microsoft.com/en-us/download/details.aspx?id=22)

[WIX tools 3.11.1](http://wixtoolset.org/releases/)

Codesigning: see /keybase/team/keybase.builds.windows/readme.html

## CMD Scripts
`build_prerelease.cmd` builds most of the client executables
`buildui.bat` builds the ui
`buildrq.cmd` builds runquiet utility
   - if you want this without code signing, try:
      - from `go\tools\runquiet`:
        `go build -ldflags "-H windowsgui" -o keybaserq.exe`
`doinstaller_wix.cmd` does codesigning on all the executabls and builds the installer
`dorelease.cmd` calls the above scripts and copies to s3. Invoked by the build bot.

# Upgrading Dokan
Download `DokanSetup_redist.exe` from https://github.com/dokan-dev/dokany/releases
Upload to S3 at prerelease.keybase.io/windows-support/dokan-dev/[VERSION]/DokanSetup_redist.exe
Get the sha1 hash of DokanSetup_redist.exe:
`powershell Get-FileHash -Algorithm sha1 DokanSetup_redist.exe`
Set the hash and version numbers in the installer project file: https://github.com/keybase/client/blob/master/packaging/windows/WIXInstallers/KeybaseApps/KeybaseApps.wixproj#L68
Change the version the service considers new enough: https://github.com/keybase/client/blob/master/go/install/fuse_status_windows.go#L17
Optional: change the minimum version KBFS will work with: https://github.com/keybase/client/blob/master/go/kbfs/dokan/loaddll.go#L110

# Windows VMs
- available [here](https://dev.windows.com/en-us/microsoft-edge/tools/vms/windows/)
- full isos [here](https://www.microsoft.com/en-gb/software-download/windows10ISO), which might need product keys

