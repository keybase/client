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

SignTool.exe sign /a /tr http://timestamp.digicert.com %PathName%
::IF %ERRORLEVEL% NEQ 0 (
::  EXIT /B 1
::)

if NOT DEFINED BUILD_TAG set BUILD_TAG=%SEMVER%


set TargetDir=%GOPATH%\src\github.com\keybase\client\packaging\windows\%SEMVER%
set TargetName=keybase_setup_%SEMVER%.%GOARCH%
set TargetExt=.msi
set TargetFileName=%TargetName%%TargetExt%
set TargetPath=%TArgetDir%\%TargetFilename%
pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\Keybase_CLI_Installer\
:: Requires WIX, DevEnvDir, etc.	
"%WIX%bin\candle.exe" -dSolutionDir=%GOPATH%\src\github.com\keybase\client\packaging\windows\Keybase_CLI_Installer\ -dSolutionExt=.sln -dSolutionFileName=Keybase_CLI_Installer.sln -dSolutionName=Keybase_CLI_Installer -dSolutionPath=%GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\Keybase_CLI_Installer.sln -dConfiguration=Release -dOutDir=bin\Release\ -dPlatform=x86 -dProjectDir=%GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\Keybase_CLI_Installer\ -dProjectExt=.wixproj -dProjectFileName=Keybase_CLI_Installer.wixproj -dProjectName=Keybase_CLI_Installer -dProjectPath=%GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\Keybase_CLI_Installer\Keybase_CLI_Installer.wixproj    -out obj\Release\ -arch x86 KeybaseCLI.wxs
IF %ERRORLEVEL% NEQ 0 (
  popd
  EXIT /B 1
)

"%WIX%bin\Light.exe" -out %TargetPath% -pdbout %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\Keybase_CLI_Installer\bin\Release\Keybase_CLI_Installer.wixpdb -cultures:null -sice:ICE20 -contentsfile obj\Release\Keybase_CLI_Installer.wixproj.BindContentsFileListnull.txt -outputsfile obj\Release\Keybase_CLI_Installer.wixproj.BindOutputsFileListnull.txt -builtoutputsfile obj\Release\Keybase_CLI_Installer.wixproj.BindBuiltOutputsFileListnull.txt -wixprojectfile %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers\Keybase_CLI_Installer\Keybase_CLI_Installer.wixproj obj\Release\KeybaseCLI.wixobj
IF %ERRORLEVEL% NEQ 0 (
  popd
  EXIT /B 1
)
popd

SignTool.exe sign /a /tr http://timestamp.digicert.com %TargetPath%
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
  
:: Publish to servers (requires bash)l
::ssh-agent bash
::ssh-add [path/to/your/key]
::ssh -A steve@gw1.keybase.io
::ssh -A keybase@dist.keybase.io
::
::to pull without establishing credentials or userId:
::git pull https://zanderz@github.com/keybase/server-ops.git