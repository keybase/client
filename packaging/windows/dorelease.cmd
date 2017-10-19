if NOT DEFINED ClientRevision set ClientRevision=master
if NOT DEFINED KBFSRevision set KBFSRevision=master
if NOT DEFINED UpdaterRevision set UpdaterRevision=master
if NOT DEFINED ReleaseRevision set ReleaseRevision=master

if NOT DEFINED DOKAN_PATH set DOKAN_PATH=%GOPATH%\bin\dokan-dev\build84
echo DOKAN_PATH %DOKAN_PATH%

if NOT DEFINED DevEnvDir call "%ProgramFiles(x86)%\\Microsoft Visual Studio 14.0\\vc\\bin\\vcvars32.bat"

IF [%UpdateChannel%] == [] goto:donechecking

IF [%UpdateChannel%] == [None] goto:donechecking

:: don't bother with ci or checking out source, etc. for smoke2 build
IF [%UpdateChannel%] == [Smoke2] goto:done_ci

:: Verify driver signing
:: Check both the built .sys files and the msi package.
signtool verify /all /kp /v %DOKAN_PATH%\\x64\\Win10Release\\dokan1.sys | find "Issued to: Microsoft Windows Hardware Compatibility Publisher"
IF %ERRORLEVEL% NEQ 0 EXIT /B 1
signtool verify /all /kp /v %DOKAN_PATH%\\Win32\\Win10Release\\dokan1.sys | find "Issued to: Microsoft Windows Hardware Compatibility Publisher"
IF %ERRORLEVEL% NEQ 0 EXIT /B 1
"%ProgramFiles%\\7-Zip\\7z" e -y %DOKAN_PATH%\\dokan_wix\\bin\\x64\\release\\Dokan_x64.msi Win10_Sys
IF %ERRORLEVEL% NEQ 0 EXIT /B 1
signtool verify /all /kp /v Win10_Sys | find "Issued to: Microsoft Windows Hardware Compatibility Publisher"
IF %ERRORLEVEL% NEQ 0 EXIT /B 1
"%ProgramFiles%\\7-Zip\\7z" e -y %DOKAN_PATH%\\dokan_wix\\bin\\x86\\release\\Dokan_x86.msi Win10_Sys
IF %ERRORLEVEL% NEQ 0 EXIT /B 1
signtool verify /all /kp /v Win10_Sys | find "Issued to: Microsoft Windows Hardware Compatibility Publisher"
IF %ERRORLEVEL% NEQ 0 EXIT /B 1

:donechecking

call:checkout_keybase client, %ClientRevision% || EXIT /B 1
call:checkout_keybase kbfs, %KBFSRevision% || EXIT /B 1
call:checkout_keybase go-updater, %UpdaterRevision% || EXIT /B 1
call:checkout_keybase release, %ReleaseRevision% || EXIT /B 1

::wait for CI
if [%UpdateChannel%] == [SmokeCI] (
    for /f %%i in ('git -C %GOPATH%\src\github.com\keybase\client rev-parse --short HEAD') do set clientCommit=%%i
    for /f %%i in ('git -C %GOPATH%\src\github.com\keybase\kbfs rev-parse --short HEAD') do set kbfsCommit=%%i    
    :: need GITHUB_TOKEN
    pushd %GOPATH%\src\github.com\keybase\release
    go build || EXIT /B 1
    release wait-ci --repo="client" --commit="%clientCommit%" --context="continuous-integration/jenkins/branch" --context="ci/circleci"  || EXIT /B 1
    release wait-ci --repo="kbfs" --commit="%kbfsCommit%" --context="continuous-integration/jenkins/branch" --context="ci/circleci"  || EXIT /B 1
    popd
)

:done_ci

pushd %GOPATH%\src\github.com\keybase\client\packaging\windows
::Get + increment the global, shared build number
s3browser-con download prerelease.keybase.io prerelease.keybase.io/windows-support/buildnumber/buildnumber.txt . || EXIT /B 1
set /p BUILD_NUMBER=<windows-support\buildnumber\buildnumber.txt
set /A BUILD_NUMBER=BUILD_NUMBER+1
echo %BUILD_NUMBER% > windows-support\buildnumber\buildnumber.txt
s3browser-con upload prerelease.keybase.io windows-support\buildnumber prerelease.keybase.io/windows-support/buildnumber || EXIT /B 1
popd

call %GOPATH%\src\github.com\keybase\client\packaging\windows\build_prerelease.cmd || EXIT /B 1


::RunQuiet Utility
pushd %GOPATH%\src\github.com\keybase\client\go\tools\runquiet
del rq.hash
del old.hash
powershell -command "wget https://s3.amazonaws.com/prerelease.keybase.io/windows-support/runquiet/runquiet.hash -OutFile old.hash"
git log -1 -- runquiet.go > rq.hash
fc rq.hash old.hash
if %ERRORLEVEL% EQU 0 (
    echo "downloading keybaserq"
    powershell -command "wget https://s3.amazonaws.com/prerelease.keybase.io/windows-support/runquiet/keybaserq.exe -OutFile keybaserq.exe"
) else (
    echo "--- runquiet hashes differ, building keybaserq. Server hash: ---"
    type old.hash
    echo "--- Current hash: ---"
    type rq.hash
    call ..\..\..\packaging\windows\buildrq.bat || EXIT /B 1
)
popd

call %GOPATH%\src\github.com\keybase\client\packaging\windows\buildui.bat || EXIT /B 1

::Build Installer
call %GOPATH%\src\github.com\keybase\client\packaging\windows\doinstaller_wix.cmd || EXIT /B 1

::Publish to S3
if %UpdateChannel% NEQ "None" (
    echo "Uploading %BUILD_TAG%"
    s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\*.exe prerelease.keybase.io/windows  || EXIT /B 1
    :: Test channel json
    s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\update-windows-prod-test-v2.json prerelease.keybase.io || EXIT /B 1
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
s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\*.json prerelease.keybase.io/windows-support || EXIT /B 1

set PrevUpdateChannel=%UpdateChannel%
set UpdateChannel=Smoke2
set smokeASemVer=%KEYBASE_VERSION%
::SlackBot?

::build again
call %GOPATH%\src\github.com\keybase\client\packaging\windows\dorelease.cmd

goto :no_smokeb

:no_smokea

::Publish smoke updater jsons to S3
if [%UpdateChannel%] NEQ [Smoke2] (
    echo "Non Smoke2 build"
    goto :no_smokeb
)
::Smoke B json
s3browser-con upload prerelease.keybase.io  %GOPATH%\src\github.com\keybase\client\packaging\windows\%BUILD_TAG%\*.json prerelease.keybase.io/windows-support  || EXIT /B 1
set smokeBSemVer=%KEYBASE_VERSION%
%GOPATH%\src\github.com\keybase\release\release announce-build --build-a="%SmokeASemVer%" --build-b="%smokeBSemVer%" --platform="windows" || EXIT /B 1

:no_smokeb

echo %ERRORLEVEL%

goto:eof

:checkout_keybase

if EXIST %GOPATH%\src\github.com\keybase\%~1 goto:repoexists
pushd %GOPATH%\src\github.com\keybase
git clone git@github.com:keybase/%~1.git
popd
:repoexists

pushd %GOPATH%\src\github.com\keybase\%~1
git pull origin %~2 || EXIT /B 1
git checkout %~2 ||  EXIT /B 1
popd
EXIT /B 0

goto:eof