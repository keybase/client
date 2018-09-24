pushd %GOPATH%\src\github.com\keybase\client\packaging\windows\WIXInstallers
msbuild WIX_Installers.sln  /p:Configuration=Release /p:Platform=x64 /t:Build
popd