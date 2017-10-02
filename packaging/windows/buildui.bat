pushd %GOPATH%\src\github.com\keybase\client\go\keybase

for /f %%i in ('winresource.exe -cv') do set KEYBASE_VERSION=%%i
echo Calling vcvars

echo on
call "%ProgramFiles(x86)%\\Microsoft Visual Studio 14.0\\vc\\bin\\vcvars32.bat"

echo on
pushd  %GOPATH%\src\github.com\keybase\client\shared
echo Calling yarn run modules
call yarn run modules

yarn run package -- --arch ia32 --platform win32 --appVersion %KEYBASE_VERSION% --icon %GOPATH%\src\github.com\keybase\client\media\icons\Keybase.ico
