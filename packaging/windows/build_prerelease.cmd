:: Build keybase.exe with prerelease options
set GOARCH=386
set GO15VENDOREXPERIMENT=1

:: for Jenkins
if DEFINED WORKSPACE set GOPATH=%WORKSPACE%

set GOARCH=386
echo %GOPATH%

echo %GOROOT%
pushd %GOPATH%\src\github.com\keybase\client\go\keybase
go generate

for /f %%i in ('winresource.exe -cv') do set KEYBASE_VERSION=%%i
echo %KEYBASE_VERSION%
for /f %%i in ('winresource.exe -cb') do set KEYBASE_BUILD=%%i
echo %KEYBASE_BUILD%
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/client/go/libkb.PrereleaseBuild=%KEYBASE_BUILD%"

:: Then build kbfsdokan.
:: First, sanity-check the hashes
if NOT EXIST %GOPATH%\src\github.com\keybase\kbfs\dokan\dokan.lib copy %GOPATH%\bin\dokan-dev\dokan-v0.8.0\Win32\Release\dokan.lib %GOPATH%\src\github.com\keybase\kbfs\dokan
for /f "usebackq tokens=2*" %%i in (`powershell Get-FileHash -Algorithm sha1 %GOPATH%\src\github.com\keybase\kbfs\dokan\dokan.lib`) do set DOKANLIBHASH=%%i
if NOT %DOKANLIBHASH%==1C9316A567B805C4A6ADAF0ABE1424FFFB36A3BD exit /B 1
for /f "usebackq tokens=2*" %%i in (`powershell Get-FileHash -Algorithm sha1 %GOPATH%\bin\dokan-dev\dokan-v0.8.0\Win32\Release\dokan.dll`) do set DOKANDLLHASH=%%i
if NOT %DOKANDLLHASH%==5C4FC6B6E3083E575EED06DE3115A6D05B30DB02 exit /B 1

pushd %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan
:: winresource invokes git to get the current revision
for /f %%i in ('git -C %GOPATH%\src\github.com\keybase\kbfs rev-parse --short HEAD') do set KBFS_HASH=%%i
for /f "tokens=1 delims=+" %%i in ("%KEYBASE_BUILD%") do set KBFS_BUILD=%%i+%KBFS_HASH%
echo %KBFS_BUILD%
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/kbfs/libkbfs.PrereleaseBuild=%KBFS_BUILD%"
popd

:: Then the desktop:
pushd  %GOPATH%\src\github.com\keybase\client\desktop
npm i

buildui.bat
popd