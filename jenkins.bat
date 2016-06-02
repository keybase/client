choco install -y golang --version 1.6
choco install -y gpg4win-vanilla --version 2.3.1
set PATH=%PATH%;C:\tools\go\bin;"C:\Program Files (x86)\GNU\GnuPG"
set GOROOT=C:\tools\go
set GOPATH=C:\Jenkins\workspace\client\work
set KEYBASE_SERVER_URI=https://ci1.keybase.io
cd C:\Jenkins\workspace\client\work\src\github.com\keybase\client\go\keybase
go build
cd ..
go list ./... | find /V "vendor" > testlist.txt
for /f %%i in (testlist.txt) do (go test -timeout 30m %%i || exit /B 1)
