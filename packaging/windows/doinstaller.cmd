:: Sign keybase.exe and generate a signed installer, with an embedded signed uninsaller
:: $1 is full path to keybase.exe
:: todo: specify output?
::
:: For Jenkins:
if DEFINED WORKSPACE set GOPATH=%WORKSPACE%
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

:: Other alternate time servers:
::   http://timestamp.verisign.com/scripts/timstamp.dll
::   http://timestamp.globalsign.com/scripts/timestamp.dll
::   http://tsa.starfieldtech.com
::   http://timestamp.comodoca.com/authenticode
::   http://timestamp.digicert.com
::SignTool.exe sign /a /tr http://timestamp.digicert.com %1
::IF %ERRORLEVEL% NEQ 0 (
::  EXIT /B 1
::)

SignTool.exe sign /a /tr http://timestamp.digicert.com %PathName%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

if NOT DEFINED BUILD_TAG set BUILD_TAG=%SEMVER%

"%ProgramFiles(x86)%\Inno Setup 5\iscc.exe"  /O%BUILD_TAG% /DMyExePathName=%PathName% /DMyAppVersion=%BUILDVER% /DMySemVersion=%SEMVER% "/sSignCommand=signtool.exe sign /tr http://timestamp.digicert.com $f" %GOPATH%\src\github.com\keybase\client\packaging\windows\setup_windows.iss

:: Publish to servers (requires bash)l
::ssh-agent bash
::ssh-add [path/to/your/key]
::ssh -A steve@gw1.keybase.io
::ssh -A keybase@dist.keybase.io
::
::to pull without establishing credentials or userId:
::git pull https://zanderz@github.com/keybase/server-ops.git