:: Sign keybase.exe and generate a signed installer, with an embedded signed uninsaller
:: $1 is full path to keybase.exe
:: todo: specify output?
::
set GOARCH=386


:: get the target build folder. Assume winresource.exe has been built.
:: If not, go there and do "go generate"
set Folder=%GOPATH%\src\github.com\keybase\client\go\keybase\
set PathName=%Folder%keybase.exe

if NOT DEFINED DOKAN_PATH set DOKAN_PATH=c:\work\bin\dokan-dev\build81
echo DOKAN_PATH %DOKAN_PATH%

for /F delims^=^"^ tokens^=2 %%x in ('findstr UpgradeCodeX64 %DOKAN_PATH%\dokan_wix\version.xml') do set DokanUpgradeCodeX64=%%x
for /F delims^=^"^ tokens^=2 %%x in ('findstr UpgradeCodeX86 %DOKAN_PATH%\dokan_wix\version.xml') do set DokanUpgradeCodeX86=%%x
for /F delims^=^"^ tokens^=2 %%x in ('findstr OldUpgradeCodeX64 %DOKAN_PATH%\dokan_wix\version.xml') do set OldDokanUpgradeCodeX64=%%x
for /F delims^=^"^ tokens^=2 %%x in ('findstr OldUpgradeCodeX86 %DOKAN_PATH%\dokan_wix\version.xml') do set OldDokanUpgradeCodeX86=%%x
for /F delims^=^"^ tokens^=2 %%x in ('findstr VCMinRequired  %DOKAN_PATH%\dokan_wix\version.xml') do set VCMinRequired=%%x

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


if NOT DEFINED BUILD_TAG set BUILD_TAG=%SEMVER%

pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers

echo ^<?xml version=^"1.0^" encoding=^"utf-8^"?^> > dokanver.xml
echo ^<Include^> >> dokanver.xml
echo ^<?define DokanUpgradeCodeX64=^"%DokanUpgradeCodeX64%^" ?^> >> dokanver.xml
echo ^<?define DokanUpgradeCodeX86=^"%DokanUpgradeCodeX86%^" ?^> >> dokanver.xml
echo ^<?define OldDokanUpgradeCodeX64=^"%OldDokanUpgradeCodeX64%^" ?^> >> dokanver.xml
echo ^<?define OldDokanUpgradeCodeX86=^"%OldDokanUpgradeCodeX86%^" ?^> >> dokanver.xml
echo ^<?define VCMinRequired=^"%VCMinRequired%^" ?^> >> dokanver.xml
echo ^<?define DOKAN_PATH=^"%DOKAN_PATH%^" ?^> >> dokanver.xml
echo ^<?define KEYBASE_WINVER=^"%KEYBASE_WINVER%^" ?^> >> dokanver.xml
echo ^</Include^>  >> dokanver.xml

msbuild WIX_Installers.sln  /p:Configuration=Debug /p:Platform=x86 /t:Build
popd
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

:: Here we rely on the previous steps checking out and building release.exe
set ReleaseBin=%GOPATH%\src\github.com\keybase\release\release.exe

if not EXIST %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG% mkdir %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%
pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%

move %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\KeybaseBundle\bin\Debug\*.exe %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%
for /f %%i in ('dir /od /b *.exe') do set KEYBASE_INSTALLER_NAME=%%i


