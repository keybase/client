
set GOPATH=C:\work
call "C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\Tools\vsvars32.bat"
set PATH=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\bin;%PATH%
set CC=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\bin\gcc
set CPATH=C:\mingw-w64\x86_64-8.1.0-posix-seh-rt_v6-rev0\mingw64\include
set KEYBASE_WINBUILD=0

cd %GOPATH%\src\github.com\keybase\client\packaging\windows
.\build_prerelease.cmd
cd %GOPATH%\src\github.com\keybase\client\packaging\windows
.\buildui.cmd
cd %GOPATH%\src\github.com\keybase\client\packaging\windows
.\doinstaller_wix.cmd debug

