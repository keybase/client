if DEFINED WORKSPACE set GOPATH=%WORKSPACE%
pushd %GOPATH%\src\github.com\keybase\client\go\keybase

for /f %%i in ('winresource.exe -cv') do set KEYBASE_VERSION=%%i
echo %KEYBASE_VERSION%

pushd  %GOPATH%\src\github.com\keybase\client\desktop
npm run package -- --arch ia32 --platform win32 --appVersion %KEYBASE_VERSION%