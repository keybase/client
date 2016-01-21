:: Build keybase.exe with prerelease options
set GOARCH=386
go generate
for /f %%i in ('winresource.exe -cb') do set KEYBASE_BUILD=%%i
echo %KEYBASE_BUILD%
go build -a -tags "prerelease production" -ldflags="-X github.com/keybase/client/go/libkb.CustomBuild=%KEYBASE_BUILD%"