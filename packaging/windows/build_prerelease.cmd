:: Build keybase.exe with prerelease options

echo GOPATH %GOPATH%

:: CGO causes dll loading security vulnerabilities
set CGO_ENABLED=0
go env
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
popd

:: Then build kbfsdokan.
pushd %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan
:: Make sure the whole build fails if we can't build kbfsdokan
del kbfsdokan.exe
:: winresource invokes git to get the current revision
for /f %%i in ('git -C %GOPATH%\src\github.com\keybase\kbfs rev-parse --short^=8 HEAD') do set KBFS_HASH=%%i
for /f "tokens=1 delims=+" %%i in ("%KEYBASE_BUILD%") do set KBFS_BUILD=%%i+%KBFS_HASH%
echo KBFS_BUILD %KBFS_BUILD%
set CGO_ENABLED=1
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/kbfs/libkbfs.PrereleaseBuild=%KBFS_BUILD%"
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
popd

:: git-remote-keybase
pushd %GOPATH%\src\github.com\keybase\kbfs\kbfsgit\git-remote-keybase
del get-remote-keybase.exe
go build -a
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
popd

:: Updater
pushd %GOPATH%\src\github.com\keybase\go-updater\service
del upd.exe
go build -a -o upd.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
popd

:: Browser Extension
pushd %GOPATH%\src\github.com\keybase\client\go\kbnm
del kbnm.exe
if "%KBNM_BUILD%" == "" (
    set KBNM_BUILD=%KEYBASE_BUILD%
)
echo KBNM_BUILD %KBNM_BUILD%
go build -a -ldflags="-X main.Version=%KBNM_BUILD%"
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
popd
