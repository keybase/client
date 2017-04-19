:: Sign keybase.exe and generate a signed installer, with an embedded signed uninsaller
:: $1 is full path to keybase.exe
:: todo: specify output?
::

set GOARCH=386
::
:: get the target build folder. Assume winresource.exe has been built.
:: If not, go there and do "go generate"
set Folder=%GOPATH%\src\github.com\keybase\client\go\keybase\
set PathName=%Folder%keybase.exe

pushd %GOPATH%\src\github.com\keybase\client\packaging\windows

:: Capture the windows style version - this is the only way to store it in a .cmd variable
for /f %%i in ('%Folder%winresource.exe -w') do set BUILDVER=%%i
echo %BUILDVER%

:: Capture keybase's semantic version - this is the only way to store it in a .cmd variable
for /f "tokens=3" %%i in ('%PathName% -version') do set SEMVER=%%i
echo %SEMVER%

:: dokan source binaries.
:: There are 8 (4 windows versions times 32/64 bit) but they all seem to have the same version.
for /f %%i in ('PowerShell "(Get-Item %GOPATH%\bin\dokan-dev\dokan-v0.8.0\Win32\Win10Release\dokan.sys).VersionInfo.FileVersion"') do set DOKANVER=%%i
echo %DOKANVER%
IF %DOKANVER%=="" (
  EXIT /B 1
)

:: Other alternate time servers:
::   http://timestamp.verisign.com/scripts/timstamp.dll
::   http://timestamp.globalsign.com/scripts/timestamp.dll
::   http://tsa.starfieldtech.com
::   http://timestamp.comodoca.com/authenticode
::   http://timestamp.digicert.com
SignTool.exe sign /a /tr http://timestamp.digicert.com %PathName%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
SignTool.exe sign /a /tr http://timestamp.digicert.com %GOPATH%\src\github.com\keybase\kbfs\kbfsdokan\kbfsdokan.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
SignTool.exe sign /a /tr http://timestamp.digicert.com %GOPATH%\src\github.com\keybase\go-updater\service\upd.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
SignTool.exe sign /a /tr http://timestamp.digicert.com %GOPATH%\src\github.com\keybase\client\go\tools\runquiet\runquiet.exe
IF %ERRORLEVEL% NEQ 0 (k
  EXIT /B 1
)
SignTool.exe sign /a /tr http://timestamp.digicert.com %GOPATH%\src\github.com\keybase\client\desktop\release\win32-ia32\Keybase-win32-ia32\Keybase.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

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
signtool verify /pa %GOPATH%\src\github.com\keybase\client\desktop\release\win32-ia32\Keybase-win32-ia32\Keybase.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

if NOT DEFINED BUILD_TAG set BUILD_TAG=%SEMVER%

"%ProgramFiles(x86)%\Inno Setup 5\iscc.exe" /O%BUILD_TAG% /DMyExePathName=%PathName% /DMyAppVersion=%BUILDVER% /DMySemVersion=%SEMVER% /DNewDokanVersion=%DOKANVER% "/sSignCommand=signtool.exe sign /tr http://timestamp.digicert.com $f" %GOPATH%\src\github.com\keybase\client\packaging\windows\setup_windows_gui.iss
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

go get github.com/keybase/release
go install github.com/keybase/release
set ReleaseBin=%GOPATH%\bin\windows_386\release.exe


pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%

for /f %%i in ('dir /od /b') do set KEYBASE_INSTALLER_NAME=%%i
echo %KEYBASE_INSTALLER_NAME%

:: Double check that the installer is codesigned
signtool verify /pa %KEYBASE_INSTALLER_NAME%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

if NOT DEFINED JSON_UPDATE_FILENAME set JSON_UPDATE_FILENAME=update-windows-prod.json

:: Run keybase sign to get signature
set KeybaseBin="c:\Program Files (x86)\Keybase\keybase.exe"
set SigFile=sig.txt
%KeybaseBin% sign -d -i %KEYBASE_INSTALLER_NAME% -o %SigFile%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

%ReleaseBin% update-json --version=%SEMVER% --src=%KEYBASE_INSTALLER_NAME% --uri=https://prerelease.keybase.io/windows --signature=%SigFile% > %JSON_UPDATE_FILENAME%

echo off
