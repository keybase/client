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
::for /f %%i in ('winresource.exe -cv') do set KEYBASE_VERSION=%%i
::echo %KEYBASE_VERSION%
::for /f %%i in ('winresource.exe -cb') do set KEYBASE_BUILD=%%i
::echo %KEYBASE_BUILD%
go build -a -tags "production"
popd