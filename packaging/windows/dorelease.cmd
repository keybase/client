if NOT DEFINED ClientRevision set ClientRevision=master
if NOT DEFINED KBFSRevision set KBFSRevision=master
if NOT DEFINED UpdaterRevision set UpdaterRevision=master
if NOT DEFINED ReleaseRevision set ReleaseRevision=master

set GOARCH=amd64

set OUTPUT=echo
if DEFINED SlackBot set OUTPUT=go run %GOPATH%/src/github.com/keybase/slackbot/send/main.go -i=1

:: sanity check that the passphrase is set right
go run %GOPATH%\src\github.com\keybase\client\go\tools\ssss\main.go %0
IF %ERRORLEVEL% NEQ 0 (
  echo Saltpack key not set right, can't build
  EXIT /B 1
)

if NOT DEFINED DevEnvDir call "%ProgramFiles(x86)%\\Microsoft Visual Studio 14.0\\vc\\bin\\vcvars32.bat"

:: don't bother with ci or checking out source, etc. for smoke2 build
IF [%UpdateChannel%] == [Smoke2] goto:done_ci

:: NOTE: We depend on the bot or caller to checkout client first
call:checkout_keybase go-updater, %UpdaterRevision% || goto:build_error || EXIT /B 1
call:checkout_keybase release, %ReleaseRevision% || goto:build_error || EXIT /B 1

::wait for CI
if [%UpdateChannel%] == [SmokeCI] call:check_ci  || EXIT /B 1

:done_ci

for /F delims^=^"^ tokens^=2 %%x in ('findstr /C:"Version = " %GOPATH%\src\github.com\keybase\client\go\libkb\version.go') do set LIBKB_VER=%%x

:: release
pushd %GOPATH%\src\github.com\keybase\release
del release.exe
go build
IF %ERRORLEVEL% NEQ 0 (
  goto:build_error || EXIT /B 1
)
for /f %%i in ('release winbuildnumber --version=%LIBKB_VER%') do set BUILD_NUMBER=%%i
echo %BUILD_NUMBER%
popd

if NOT DEFINED BUILD_NUMBER (
  echo bad build number
  goto:build_error || EXIT /B 1
)
:: ensure it's numeric
SET "badbuildnumber="&for /f "delims=0123456789" %%i in ("%BUILD_NUMBER%") do set badbuildnumber=%%i
if defined badbuildnumber (
  echo bad build number
  goto:build_error || EXIT /B 1
)

call %GOPATH%\src\github.com\keybase\client\packaging\windows\build_prerelease.cmd || goto:build_error || EXIT /B 1

call %GOPATH%\src\github.com\keybase\client\packaging\windows\buildui.cmd || goto:build_error || EXIT /B 1

::Build Installer
call %GOPATH%\src\github.com\keybase\client\packaging\windows\doinstaller_wix.cmd || goto:build_error || EXIT /B 1

::Publish to S3
echo "Uploading %BUILD_TAG%"
s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\Keybase_%BUILD_TAG%.%GOARCH%.msi prerelease.keybase.io/windows  || goto:build_error || EXIT /B 1

if %UpdateChannel% NEQ "None" (
    :: Test channel json
    s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\update-windows-prod-test-v2.json prerelease.keybase.io || goto:build_error || EXIT /B 1
    echo "Creating index files"
    %GOPATH%\src\github.com\keybase\release\release index-html --bucket-name=prerelease.keybase.io --prefixes="windows/" --upload="windows/index.html"
) else (
    echo "No update channel"
)


::Invoke SmokeB build
if [%UpdateChannel%] NEQ [Smoke] (
    if [%UpdateChannel%] NEQ [SmokeCI] (
        echo "Not a smoke build"
        goto :no_smokea
    )
)

:: Smoke A json
s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\*.json prerelease.keybase.io/windows-support || goto:build_error || EXIT /B 1

set PrevUpdateChannel=%UpdateChannel%
set UpdateChannel=Smoke2
set smokeASemVer=%KEYBASE_VERSION%
::SlackBot?

::build again
call %GOPATH%\src\github.com\keybase\client\packaging\windows\dorelease.cmd || EXIT /B 1

:: and we're done here

EXIT /B 0

:no_smokea

setlocal ENABLEDELAYEDEXPANSION

set BUILD_TAG_ENCODED=!BUILD_TAG:+=%%2B!

::Publish smoke updater jsons to S3
if [%UpdateChannel%] NEQ [Smoke2] (
    echo "Non Smoke2 build"
    %OUTPUT% "Successfully built Windows with client: %KEYBASE_VERSION%"
    %OUTPUT% "https://prerelease.keybase.io/windows/Keybase_%BUILD_TAG_ENCODED%.%GOARCH%.msi"
    goto :no_smokeb
)
::Smoke B json
s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\*.json prerelease.keybase.io/windows-support  || goto:build_error || EXIT /B 1
set smokeBSemVer=%KEYBASE_VERSION%
%GOPATH%\src\github.com\keybase\release\release announce-build --build-a="%SmokeASemVer%" --build-b="%smokeBSemVer%" --platform="windows" || goto:build_error || EXIT /B 1
set BUILD_TAG_ENCODED=!SmokeASemVer:+=%%2B!
%OUTPUT% "Successfully built Windows: --build-a=%SmokeASemVer% --build-b=%smokeBSemVer%
%OUTPUT% "https://prerelease.keybase.io/windows/Keybase_%BUILD_TAG_ENCODED%.%GOARCH%.msi"
:no_smokeb

echo %ERRORLEVEL%

goto:eof

:checkout_keybase 

if EXIST %GOPATH%\src\github.com\keybase\%~1 goto:repoexists
pushd %GOPATH%\src\github.com\keybase
git clone https://github.com/keybase/%~1.git
popd
:repoexists 

pushd %GOPATH%\src\github.com\keybase\%~1
git checkout master || EXIT /B 1
git pull || EXIT /B 1
git checkout %~2 || EXIT /B 1
for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set currentCommit=%%i
if NOT [%currentCommit%] == [HEAD] (
    git pull || EXIT /B 1
)
popd
EXIT /B 0

goto:eof

:build_error 
%OUTPUT% "Error building Windows"
EXIT /B 1

:check_ci 
for /f %%i in ('git -C %GOPATH%\src\github.com\keybase\client rev-parse --short^=8 HEAD') do set clientCommit=%%i
echo [%clientCommit%]
:: need GITHUB_TOKEN
pushd %GOPATH%\src\github.com\keybase\release
go build || goto:build_error || EXIT /B 1
release wait-ci --repo="client" --commit="%clientCommit%" --context="continuous-integration/jenkins/branch" --context="ci/circleci"  || goto:ci_error
popd
EXIT /B 0

:ci_error 
%OUTPUT% "CI Failure building Windows"
EXIT /B 1
