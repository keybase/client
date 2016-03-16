##Signing and Building on Windows  
#Building the client
- [Git](https://git-scm.com/download/win)
- Defaults are fine except these recommendations:  
-- "Use Git from the Windows Command Prompt"  
-- Checkout as-is, commit Unix-style line endings  
-- Use Windows' default console window (especially on Windows 10)  
- [Go](https://golang.org/dl/)
Then, of course, clone the repo and set GOPATH

#Installer Tools/requirements  
- [InnoScript](http://www.jrsoftware.org/isdl.php#stable)  
- SignTool.exe from the [Microsoft SDK](https://www.microsoft.com/en-us/download/details.aspx?id=8279) on the path somewhere (Any SDK will do, they all have SignTool.exe).  
- Hardware token from DigiCert and [SafeNet Authentication Client software](https://www.digicert.com/code-signing/safenet-client-installation.htm)  
- server repo, for favicon.ico

# Steps
1. CD to github.com\keybase\client\go\keybase
2. Set GOPATH
3. set GOARCH=386⋅
4. `go generate`
5. `go build -tags production`
6. CD to github.com\keybase\client\packaging\windows
7. Prepare signing password, per digicert in the keys repo
8. `doinstaller [full path to keybase.exe]`, e.g. `doinstaller c:\work\src\github.com\keybase\client\go\keybase\keybase.exe`
- Answer password prompts

#To build the gui
- [Node](https://nodejs.org/en/)
- [Python 2.7](https://www.python.org/ftp/python/2.7.11/python-2.7.11.msi)
Switch to Node 5.7.0:
- [NVM for Windows](https://github.com/coreybutler/nvm-windows/releases/download/1.1.0/nvm-setup.zip)
Issue the commands "nvm install 5.7.0" and "nvm use 5.7.0"
- [VisualStudio 2013](https://go.microsoft.com/fwlink/?LinkId=532495&clcid=0x409)
npm i
npm run package -- --arch ia32 --platform win32 --appVersion [version]

#Windows VMs
available [here](https://dev.windows.com/en-us/microsoft-edge/tools/vms/windows/)