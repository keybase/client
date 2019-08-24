:: Sign keybase.exe and generate a signed installer, with an embedded signed uninstaller
:: $1 is full path to keybase.exe
:: todo: specify output?
::
set GOARCH=amd64

echo %KEYBASE_SECRET_STORE_FILE%
:: This has to be reset too for a separate batch command
if DEFINED BUILD_NUMBER set KEYBASE_WINBUILD=%BUILD_NUMBER%
set SIGNTOOL=signtool
set CONFIGURATION=Release
if "%~1"=="debug" (
  set SIGNTOOL=echo
  set CONFIGURATION=Debug
  if NOT DEFINED KEYBASE_WINBUILD set KEYBASE_WINBUILD=0
)
set CERTISSUER=DigiCert

::
:: get the target build folder. Assume winresource.exe has been built.
:: If not, go there and do "go generate"
set Folder=%GOPATH%\src\github.com\keybase\client\go\keybase\
set PathName=%Folder%keybase.exe

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
popd

:: prompter
pushd %GOPATH%\src\github.com\keybase\go-updater\windows\WpfPrompter
msbuild WpfPrompter.sln /t:Clean
msbuild WpfPrompter.sln /p:Configuration=Release /t:Build
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
popd

call:dosignexe %PathName%
call:dosignexe %GOPATH%\src\github.com\keybase\client\go\kbfs\kbfsdokan\kbfsdokan.exe
call:dosignexe %GOPATH%\src\github.com\keybase\client\go\kbfs\kbfsgit\git-remote-keybase\git-remote-keybase.exe
call:dosignexe %GOPATH%\src\github.com\keybase\go-updater\service\upd.exe
call:dosignexe %GOPATH%\src\github.com\keybase\client\shared\desktop\release\win32-x64\Keybase-win32-x64\Keybase.exe
:: Browser Extension
call:dosignexe %GOPATH%\src\github.com\keybase\client\go\kbnm\kbnm.exe
:: prompter
call:dosignexe %GOPATH%\src\github.com\keybase\go-updater\windows\WpfPrompter\WpfApplication1\bin\Release\prompter.exe

:: Double check that keybase is codesigned
%SIGNTOOL% verify /pa %PathName%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that kbfs is codesigned
%SIGNTOOL% verify /pa %GOPATH%\src\github.com\keybase\client\go\kbfs\kbfsdokan\kbfsdokan.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that git-remote-keybase is codesigned
%SIGNTOOL% verify /pa %GOPATH%\src\github.com\keybase\client\go\kbfs\kbfsgit\git-remote-keybase\git-remote-keybase.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that updater is codesigned
%SIGNTOOL% verify /pa %GOPATH%\src\github.com\keybase\go-updater\service\upd.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that Keybase.exe gui is codesigned
%SIGNTOOL% verify /pa %GOPATH%\src\github.com\keybase\client\shared\desktop\release\win32-x64\Keybase-win32-x64\Keybase.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that browser extension is codesigned
%SIGNTOOL% verify /pa %GOPATH%\src\github.com\keybase\client\go\kbnm\kbnm.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Double check that the prompter exe is codesigned
%SIGNTOOL% verify /pa %GOPATH%\src\github.com\keybase\go-updater\windows\WpfPrompter\WpfApplication1\bin\Release\prompter.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

set BUILD_TAG=%SEMVER%

pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers

msbuild WIX_Installers.sln  /p:Configuration=%CONFIGURATION% /p:Platform=x64 /t:Build
popd
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
IF "%CONFIGURATION%"=="Debug" (
  EXIT /B 0
)

:: Here we rely on the previous steps checking out and building release.exe
set ReleaseBin=%GOPATH%\src\github.com\keybase\release\release.exe

if not EXIST %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG% mkdir %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%
pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%

move %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\KeybaseApps\bin\Release\*.msi %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%
for /f %%i in ('dir /od /b *.msi') do set KEYBASE_INSTALLER_NAME=%%i

:: Double check that the installer is codesigned
%SIGNTOOL% verify /pa %KEYBASE_INSTALLER_NAME%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Run ssss to get signature of update
pushd %GOPATH%\src\github.com\keybase\client\go\tools\ssss
go build
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
popd
set SigningBin="%GOPATH%\src\github.com\keybase\client\go\tools\ssss\ssss.exe"
set SigFile=sig.txt
%SigningBin% %KEYBASE_INSTALLER_NAME% > %SigFile%
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
  %ReleaseBin% update-json --version=%SEMVER% --src=%KEYBASE_INSTALLER_NAME% --uri=https://prerelease.keybase.io/windows --signature=%SigFile% --description=%GOPATH%\src\github.com\keybase\client\shared\desktop\CHANGELOG.txt > update-windows-prod-%KEYBASE_VERSION%.json
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

%ReleaseBin% update-json --version=%SEMVER% --src=%KEYBASE_INSTALLER_NAME% --uri=https://prerelease.keybase.io/windows --signature=%SigFile% --description=%GOPATH%\src\github.com\keybase\client\shared\desktop\CHANGELOG.txt > %JSON_UPDATE_FILENAME%

:end_update_json

popd

goto:eof


:dosignexe
:: Other alternate time servers:
::   http://timestamp.verisign.com/scripts/timstamp.dll
::   http://sha256timestamp.ws.symantec.com/sha256/timestamp (sha256)
::   http://timestamp.globalsign.com/scripts/timestamp.dll
::   http://tsa.starfieldtech.com
::   http://timestamp.comodoca.com/authenticode
::   http://timestamp.digicert.com

%SIGNTOOL% sign /i digicert /a /tr http://timestamp.digicert.com %~1
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
%SIGNTOOL% sign /i digicert /a /as /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 %~1
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

goto:eof
