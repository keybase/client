:: Sign keybase.exe and generate a signed installer, with an embedded signed uninsaller
:: $1 is full path to keybase.exe
:: todo: specify output?
::
set GOARCH=386

echo %KEYBASE_SECRET_STORE_FILE%
:: This has to be reset too for a separate batch command
if DEFINED BUILD_NUMBER set KEYBASE_WINBUILD=%BUILD_NUMBER%
set SIGNTOOL=signtool
set CERTISSUER=DigiCert

::
:: get the target build folder. Assume winresource.exe has been built.
:: If not, go there and do "go generate"
set Folder=%GOPATH%\src\github.com\keybase\client\go\keybase\
set PathName=%Folder%keybase.exe

if NOT DEFINED DOKAN_PATH set DOKAN_PATH=c:\work\bin\dokan-dev\build81
echo DOKAN_PATH %DOKAN_PATH%

for /F delims^=^"^ tokens^=2 %%x in ('findstr ProductCodeX64 %DOKAN_PATH%\dokan_wix\version.xml') do set DokanProductCodeX64=%%x
for /F delims^=^"^ tokens^=2 %%x in ('findstr ProductCodeX86 %DOKAN_PATH%\dokan_wix\version.xml') do set DokanProductCodeX86=%%x

pushd %GOPATH%\src\github.com\keybase\client\packaging\windows

:: Capture the windows style version
for /f %%i in ('%Folder%winresource.exe -w') do set KEYBASE_WINVER=%%i
echo KEYBASE_WINVER %KEYBASE_WINVER%

:: Capture keybase's semantic version
for /f "tokens=3" %%i in ('%PathName% -version') do set SEMVER=%%i
echo %SEMVER%
::Set this again for Jenkins
set KEYBASE_VERSION=%SEMVER%

echo KEYBASE_VERSION %KEYBASE_VERSION%

:: dokan source binaries.
:: There are 8 (4 windows versions times 32/64 bit) but they all seem to have the same version.
for /f %%i in ('PowerShell "(Get-Item %DOKAN_PATH%\Win32\Win10Release\dokan1.sys).VersionInfo.FileVersion"') do set DOKANVER=%%i
echo DOKANVER %DOKANVER%
IF %DOKANVER%=="" (
  EXIT /B 1
)

call:dosignexe %PathName%
call:dosignexe %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan\kbfsdokan.exe
call:dosignexe %GOPATH%\src\github.com\keybase\go-updater\service\upd.exe
call:dosignexe %GOPATH%\src\github.com\keybase\client\go\tools\runquiet\runquiet.exe
call:dosignexe %GOPATH%\src\github.com\keybase\client\go\tools\dokanclean\dokanclean.exe
call:dosignexe %GOPATH%\src\github.com\keybase\client\shared\desktop\release\win32-ia32\Keybase-win32-ia32\Keybase.exe
:: Browser Extension
call:dosignexe %GOPATH%\src\github.com\keybase\client\go\kbnm\kbnm.exe

:: Double check that keybase is codesigned
signtool verify /pa %PathName%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that kbfs is codesigned
signtool verify /pa %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan\kbfsdokan.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that updater is codesigned
signtool verify /pa %GOPATH%\src\github.com\keybase\go-updater\service\upd.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that Keybase.exe gui is codesigned
signtool verify /pa %GOPATH%\src\github.com\keybase\client\shared\desktop\release\win32-ia32\Keybase-win32-ia32\Keybase.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that browser extension is codesigned
signtool verify /pa %GOPATH%\src\github.com\keybase\go\kbnm\kbnm.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

if NOT DEFINED BUILD_TAG set BUILD_TAG=%SEMVER%

pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers

echo ^<?xml version=^"1.0^" encoding=^"utf-8^"?^> > dokanver.xml
echo ^<Include^> >> dokanver.xml
echo ^<?define DokanProductCodeX86=^"%DokanProductCodeX86%^" ?^> >> dokanver.xml
echo ^<?define DokanProductCodeX64=^"%DokanProductCodeX64%^" ?^> >> dokanver.xml
echo ^<?define DOKAN_PATH=^"%DOKAN_PATH%^" ?^> >> dokanver.xml
echo ^</Include^>  >> dokanver.xml

msbuild WIX_Installers.sln  /p:Configuration=Release /p:Platform=x86 /t:Build
popd
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Here we rely on the previous steps checking out and building release.exe
set ReleaseBin=%GOPATH%\src\github.com\keybase\release\release.exe

if not EXIST %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG% mkdir %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%
pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%

move %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\KeybaseBundle\bin\Release\*.exe %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%
for /f %%i in ('dir /od /b *.exe') do set KEYBASE_INSTALLER_NAME=%%i

:: Double check that the installer is codesigned
signtool verify /pa %KEYBASE_INSTALLER_NAME%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Run keybase sign to get signature of update
set KeybaseBin="%LOCALAPPDATA%\Keybase\keybase.exe"
set SigFile=sig.txt
%KeybaseBin% sign -d -i %KEYBASE_INSTALLER_NAME% -o %SigFile%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)


:: UpdateChannel is a Jenkins select parameter, one of: Smoke, Test, None
echo UpdateChannel: %UpdateChannel%

:: Test means to skip smoke
IF %UpdateChannel% EQU Test (
  GOTO set_test_channel
)

:: We need a test channel updater .json in all smoke cases
IF "%UpdateChannel:~0,5%"=="Smoke" (
  %ReleaseBin% update-json --version=%SEMVER% --src=%KEYBASE_INSTALLER_NAME% --uri=https://prerelease.keybase.io/windows --signature=%SigFile% --description=%GOPATH%\src\github.com\keybase\client\shared\desktop\CHANGELOG.txt --prop=DokanProductCodeX64:%DokanProductCodeX64% --prop=DokanProductCodeX86:%DokanProductCodeX86% > update-windows-prod-%KEYBASE_VERSION%.json
  :: All smoke builds go in the test channel too except Smoke2
  IF %UpdateChannel% NEQ Smoke2 GOTO set_test_channel
  :: Don't make a production json either for smoke2
  GOTO end_update_json
)
set JSON_UPDATE_FILENAME=update-windows-prod-v2.json

GOTO end_test_channel

:set_test_channel
set JSON_UPDATE_FILENAME=update-windows-prod-test-v2.json

:end_test_channel

echo %JSON_UPDATE_FILENAME%

%ReleaseBin% update-json --version=%SEMVER% --src=%KEYBASE_INSTALLER_NAME% --uri=https://prerelease.keybase.io/windows --signature=%SigFile% --description=%GOPATH%\src\github.com\keybase\client\shared\desktop\CHANGELOG.txt --prop=DokanProductCodeX64:%DokanProductCodeX64% --prop=DokanProductCodeX86:%DokanProductCodeX86% > %JSON_UPDATE_FILENAME%

:end_update_json

goto:eof


:dosignexe
:: Other alternate time servers:
::   http://timestamp.verisign.com/scripts/timstamp.dll
::   http://timestamp.globalsign.com/scripts/timestamp.dll
::   http://tsa.starfieldtech.com
::   http://timestamp.comodoca.com/authenticode
::   http://timestamp.digicert.com

SignTool.exe sign /i digicert /a /tr http://timestamp.digicert.com %~1
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
SignTool.exe sign /i digicert /a /as /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 %~1
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

goto:eof