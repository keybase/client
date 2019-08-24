# Windows Build Setup

## Install Prereqs

### Go
- [go for windows](https://golang.org/dl)
- Environment: `set GOPATH=C:\work`

### Git

- [git for windows](https://git-scm.com/downloads)
  - Select "Use Git and optional Unix tools from the Command Prompt" (so scripts with `rm` will work)
  - Checkout as-is, conmmit Unix style line endings
  - Use Windows' default console window (especially on Windows 10)

- Open a command console and make a directory for cloning the repo, e.g.:
```
git clone https://github.com/keybase/client.git c:\work\src\github.com\keybase\client
git clone https://github.com/keybase/go-updater.git c:\work\src\github.com\keybase\go-updater
```

### Build Service, Etc

- set GOPATH, e.g. `set GOPATH=c:\work`
- `cd %GOPATH%\src\github.com\keybase\client\go\keybase`
- `go build`

### Electron

#### Node

- Easiest way is via [nodjs binary download](https://nodejs.org/en/download/)
- Alternative way:
  - [node version manager](https://github.com/coreybutler/nvm-windows):

```
> nvm install latest
> nvm use [version]
```

#### Yarn

`npm` should be in your path from the previous step. Then:

```
> npm i -g yarn
```

###  Mingpw

- [GCC via Mingw-64](https://sourceforge.net/projects/mingw-w64/) (for building kbfsdokan)
  - Be sure and choose architecture x86-64, NOT i686
  - Also recommend not installing in `program files`
    - Try `C:\mingw-w64\.... instead`

## Building
[GCC via Mingw-64](https://sourceforge.net/projects/mingw-w64/) (for building kbfsdokan)
- Be sure and choose architecture x86-64, NOT i686
- Also recommend not installing in `program files`, e.g. `C:\mingw-w64\...` instead of `C:\Program Files (x86)\mingw-w64\...`

Environment:
```
set PATH=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\bin;%PATH%
set CC=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\bin\gcc
set CPATH=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\include
```

## Building Installers

- [Visual Studio 2015 Professional](https://visualstudio.microsoft.com/vs/older-downloads/)
(may require live.com account)

- Environment:
  - `call "C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\Tools\vsvars32.bat"`
  - [.net 3.5.1](https://www.microsoft.com/en-us/download/details.aspx?id=22) (needed for WIX)
  - [WIX tools 3.11.1](http://wixtoolset.org/releases/) (needed to build the installer)
  - Codesigning: see /keybase/team/keybase.builds.windows/readme.html

## Building a debug installer without codesigning

- Environment:
  - `set KEYBASE_WINBUILD=0`

- Invoke the scripts to build the executables:

```cmd
build_prerelease.cmd
buildui.cmd
doinstaller_wix.cmd debug
```

- OR, there's a little script that combines the above:
   - `.\build_debug_installer.cmd`

- Make sure you restart `CMD.exe` after doing the above installs; otherwise, these scripts
  won't be able to find WIX.

## Production CMD Scripts
- `build_prerelease.cmd` builds most of the client executables
- `buildui.cmd` builds the ui
- `doinstaller_wix.cmd` does codesigning on all the executabls and builds the installer (requires signing certificate)
- `dorelease.cmd` calls the above scripts and copies to s3. Invoked by the build bot.

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

#  Might be Useful...
- [Chocolatey](https://chocolatey.org/install) (helpful for yarn)
  - then: `choco install yarn`

# Installed Product Layout and Functionality
The installer places/updates all the files and adds:
- startup shortcut for
- start menu shortcut
- background tile color

The service is invoked by the GUI with this command:
`[INSTALLFOLDER]\keybaserq.exe keybase.exe --log-format=file --log-prefix="[INSTALLFOLDER]watchdog." ctl watchdog2`
This starts a copy of keybase.exe in watchdog mode, which in turn runs the service and kbfs processes, restarting them if they die or are killed.
If the service is closed with `keybase ctl stop`, which the GUI does when the widtget menu is used, the watchdog will see a different exit code and not restart the processes.

`keybaserq.exe` has 2 main jobs: de-elevating permissions to run as current user, and running Keybase invisibly, without the CMD window appearing, since it is a console program.

Notable executables
`DokanSetup_redist.exe` - Dokan driver package, invoked from files tab in GUI
`git-remote-keybase.exe` - GIT helper
`kbfsdokan.exe` - kbfs
`kbnm.exe` - browser extension
`keybase.exe` - service
`keybase.rq.exe` - quiet launcher and de-elevator
`prompter.exe` - updater GUI
`upd.exe` - updater
`Gui\Keybase.exe` - GUI

