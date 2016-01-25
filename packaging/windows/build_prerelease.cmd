:: Build keybase.exe with prerelease options
set GOARCH=386
go generate
for /f %%i in ('winresource.exe -cb') do set KEYBASE_BUILD=%%i
echo %KEYBASE_BUILD%
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/client/go/libkb.CustomBuild=%KEYBASE_BUILD%"

:: Then build kbfsdokan with go build -tags "production prerelease"

:: Then the desktop:
:: client\react-native\react>npm i
:: client\desktop>npm i
:: client\desktop>node package.js --arch ia32 --platform win32