:: Build keybase.exe with prerelease options
set GOARCH=386
go generate
for /f %%i in ('winresource.exe -cb') do set KEYBASE_BUILD=%%i
echo %KEYBASE_BUILD%
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/client/go/libkb.CustomBuild=%KEYBASE_BUILD%"

:: Then build kbfsdokan
cd %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan
go build -tags "production prerelease"

Then the desktop:
cd %GOPATH%\src\github.com\keybase\client\react-native\react
npm i
cd %GOPATH%\src\github.com\keybase\client\desktop
npm i
node package.js --arch ia32 --platform win32