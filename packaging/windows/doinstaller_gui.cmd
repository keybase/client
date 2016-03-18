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

:: dokan source binaries.
:: There are 8 (4 windows versions times 32/64 bit) but they all seem to have the same version.
for /f %%i in ('PowerShell "(Get-Item %GOPATH%\bin\dokan-dev\dokan-v1.0.0-RC2\Win32\Win10Release\dokan1.sys).VersionInfo.FileVersion"') do set DOKANVER=%%i
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
IF %ERRORLEVEL% NEQ 0 (k
  EXIT /B 1
)
SignTool.exe sign /a /tr http://timestamp.digicert.com %GOPATH%\src\github.com\keybase\client\desktop\release\win32-ia32\Keybase-win32-ia32\Keybase.exe
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

if NOT DEFINED BUILD_TAG set BUILD_TAG=%SEMVER%

"%ProgramFiles(x86)%\Inno Setup 5\iscc.exe" /O%BUILD_TAG% /DMyExePathName=%PathName% /DMyAppVersion=%BUILDVER% /DMySemVersion=%SEMVER% /DNewDokanVersion=%DOKANVER% "/sSignCommand=signtool.exe sign /tr http://timestamp.digicert.com $f" %GOPATH%\src\github.com\keybase\client\packaging\windows\setup_windows_gui.iss
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

echo off
for /f %%i in ('dir %BUILD_TAG% /od /b') do set KEYBASE_INSTALLER_NAME=%%i
echo %KEYBASE_INSTALLER_NAME%

go get github.com/keybase/release
go install github.com/keybase/release
set release_bin=%GOPATH%\bin\windows_386\release.exe


pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%
%GOPATH%\bin\windows_386\release update-json --version=%SEMVER% --src=%KEYBASE_INSTALLER_NAME% --uri=https://s3.amazonaws.com/prerelease.keybase.io/windows > update-windows-prod.json
::"%ProgramFiles%\S3 Browser\s3browser-con.exe" upload keybase %KEYBASE_INSTALLER_NAME% prerelease.keybase.io/windows
:: After sanity checking, do:
::"%ProgramFiles%\S3 Browser\s3browser-con.exe" upload keybase update-windows-prod.json prerelease.keybase.io
:: popd
::%GOPATH%\bin\windows_386\release index-html --bucket-name=prerelease.keybase.io --prefixes="darwin/,linux_binaries/deb/,linux_binaries/rpm/,windows/" --dest=index.html
::"%ProgramFiles%\S3 Browser\s3browser-con.exe" upload keybase index.html prerelease.keybase.io