pushd %GOPATH%\src\github.com\keybase\client\go\keybase

for /f %%i in ('winresource.exe -cv') do set KEYBASE_VERSION=%%i

popd

echo on
pushd  %GOPATH%\src\github.com\keybase\client\shared
echo Calling yarn run modules
:: yarn sometimes exits this console
cmd /C yarn install --pure-lockfile --ignore-engines --ignore-optional
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)

cmd /C yarn run package --arch x64 --platform win32 --appVersion %KEYBASE_VERSION% --icon %GOPATH%\src\github.com\keybase\client\media\icons\Keybase.ico
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
popd

:: wix (specifically heat) has a bad time with marking folders for deletion on uninstall if any
:: of the folders in our distribution only contain folders (i.e. no non-folder files). so step into
:: every folder in our distribution recursively, and create an empty file wherever necessary.
echo off
pushd %GOPATH%\src\github.com\keybase\client\shared\desktop\release\win32-x64\Keybase-win32-x64

:: this is necessary to use variables inside a for loop
SETLOCAL ENABLEDELAYEDEXPANSION

for /R %%G in (.) do (
  pushd %%G
  set countOfNonDirectoryFiles=0
  for %%x in (*) do set /a countOfNonDirectoryFiles+=1
  if !countOfNonDirectoryFiles!==0 (
    :: create an empty file in this directory
    copy NUL EmptyFile.txt
    echo created an empty file at %%G
  )
  popd %%G
)

SETLOCAL DISABLEDELAYEDEXPANSION
popd
