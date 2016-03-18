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

:: Then build kbfsdokan
if NOT EXIST %GOPATH%\src\github.com\keybase\kbfs\dokan\dokan1.lib copy %GOPATH%\bin\dokan-dev\dokan-v1.0.0-RC2\Win32\Release\dokan1.lib %GOPATH%\src\github.com\keybase\kbfs\dokan
for /f "usebackq tokens=2*" %%i in (`powershell Get-FileHash -Algorithm sha1 %GOPATH%\src\github.com\keybase\kbfs\dokan\dokan1.lib`) do set DOKANLIBHASH=%%i
if NOT %DOKANLIBHASH%==8FCFE265C5558FBA9FC6BFF4AF8BB0B83A159611 exit /B 1
pushd %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan
go build -tags "production prerelease"
popd

:: Then the desktop:
pushd  %GOPATH%\src\github.com\keybase\client\desktop
npm i
npm run package -- --arch ia32 --platform win32 --appVersion %KEYBASE_VERSION%
popd