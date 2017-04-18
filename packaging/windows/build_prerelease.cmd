:: Build keybase.exe with prerelease options
set GOARCH=386
set GO15VENDOREXPERIMENT=1

if NOT DEFINED DOKAN_PATH set DOKAN_PATH=%GOPATH%\bin\dokan-dev\dokan-v1.0.0-RC4.2
echo DOKAN_PATH %DOKAN_PATH%

echo GOPATH %GOPATH%

:: CGO causes dll loading security vulnerabilities
set CGO_ENABLED=0
echo GOROOT %GOROOT%
pushd %GOPATH%\src\github.com\keybase\client\go\keybase
:: Make sure the whole build fails if we can't build keybase
del keybase.exe
go version
go generate
winresource.exe -kbfsicon=../../media/icons/windows/keybase-root-icon.ico

if DEFINED BUILD_NUMBER set KEYBASE_WINBUILD=%BUILD_NUMBER%

for /f %%i in ('winresource.exe -cv') do set KEYBASE_VERSION=%%i
echo KEYBASE_VERSION %KEYBASE_VERSION%
for /f %%i in ('winresource.exe -cb') do set KEYBASE_BUILD=%%i
echo KEYBASE_BUILD %KEYBASE_BUILD%
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/client/go/libkb.PrereleaseBuild=%KEYBASE_BUILD%"


:: Then build kbfsdokan.
:: First, sanity-check the hashes
copy %DOKAN_PATH%\Win32\Release\dokan1.lib %GOPATH%\src\github.com\keybase\kbfs\dokan

::for /f "usebackq tokens=2*" %%i in (`powershell Get-FileHash -Algorithm sha1 %GOPATH%\src\github.com\keybase\kbfs\dokan\dokan.lib`) do set DOKANLIBHASH=%%i
::if NOT %DOKANLIBHASH%==1C9316A567B805C4A6ADAF0ABE1424FFFB36A3BD exit /B 1
::for /f "usebackq tokens=2*" %%i in (`powershell Get-FileHash -Algorithm sha1 %GOPATH%\bin\dokan-dev\dokan-v0.8.0\Win32\Release\dokan.dll`) do set DOKANDLLHASH=%%i
::if NOT %DOKANDLLHASH%==5C4FC6B6E3083E575EED06DE3115A6D05B30DB02 exit /B 1

pushd %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan
:: Make sure the whole build fails if we can't build kbfsdokan
del kbfsdokan.exe
:: winresource invokes git to get the current revision
for /f %%i in ('git -C %GOPATH%\src\github.com\keybase\kbfs rev-parse --short HEAD') do set KBFS_HASH=%%i
for /f "tokens=1 delims=+" %%i in ("%KEYBASE_BUILD%") do set KBFS_BUILD=%%i+%KBFS_HASH%
echo KBFS_BUILD %KBFS_BUILD%
set CGO_ENABLED=1
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/kbfs/libkbfs.PrereleaseBuild=%KBFS_BUILD%"
popd

:: Updater
pushd %GOPATH%\src\github.com\keybase\go-updater\service
go build -a -o upd.exe
popd

:: Runquiet
pushd %GOPATH%\src\github.com\keybase\client\go\tools\runquiet
..\..\keybase\winresource.exe  -d "Keybase quiet start utility" -n "runquiet.exe" -i ../../../media/icons/Keybase.ico
go build -ldflags "-H windowsgui"
popd

:: dokanclean
pushd %GOPATH%\src\github.com\keybase\client\go\tools\dokanclean
go build
popd

:: release
pushd %GOPATH%\src\github.com\keybase\release
go build
popd

:: Browser Extension
pushd %GOPATH%\src\github.com\keybase\client\go\kbnm
if "%KBNM_BUILD%" == "" (
    KBNM_BUILD = %KEYBASE_BUILD%
)
echo KBNM_BUILD %KBNM_BUILD%
go build -a -ldflags="-X main.Version=%KBNM_BUILD%"
powershell -Command "(gc host_json.template) -replace '@@HOST_PATH@@', 'kbnm.exe' -replace '`r`n', '`n' | Out-File kbnm.json"
popd

