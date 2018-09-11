set GOARCH=386

if DEFINED BUILD_NUMBER set KEYBASE_WINBUILD=%BUILD_NUMBER%

:: keybaserq
pushd %GOPATH%\src\github.com\keybase\client\go\tools\runquiet

for /f %%i in ('..\..\keybase\winresource.exe -cv') do set KEYBASE_VERSION=%%i
echo KEYBASE_VERSION %KEYBASE_VERSION%
for /f %%i in ('..\..\keybase\winresource.exe -cb') do set KEYBASE_BUILD=%%i

..\..\keybase\winresource.exe  -d "Keybase quiet start utility" -n "keybaserq.exe" -i ../../../media/icons/Keybase.ico
go build -ldflags "-H windowsgui" -o keybaserq.exe

SignTool.exe sign /i digicert /a /tr http://timestamp.digicert.com keybaserq.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
SignTool.exe sign /i digicert /a /as /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 keybaserq.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

popd

