pushd %GOPATH%\src\github.com\keybase\client\go\keybase

for /f %%i in ('winresource.exe -cv') do set KEYBASE_VERSION=%%i

popd

echo on
pushd  %GOPATH%\src\github.com\keybase\client\shared
echo Calling yarn run modules
:: yarn sometimes exits this console
cmd /C  yarn install --pure-lockfile

yarn run package -- --arch ia32 --platform win32 --appVersion %KEYBASE_VERSION% --icon %GOPATH%\src\github.com\keybase\client\media\icons\Keybase.ico
popd