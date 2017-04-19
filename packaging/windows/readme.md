##Building on Windows  
#Building and testing the client  
- Install [Git](https://git-scm.com/download/win)  
- Defaults are fine except these recommendations:  
-- "Use Git from the Windows Command Prompt"  
-- Checkout as-is, commit Unix-style line endings  
-- Use Windows' default console window (especially on Windows 10)  
- Install [Go](https://golang.org/dl/) 1.5.3 (soon to switch to 1.6)  
- Open a command console and make a directory for cloning the repo, e.g.:  
`cd ~`  
`mkdir -p work/src/github.com/keybase`  
`cd work/src/github.com/keybase`  
`git clone https://github.com/keybase/client.git`  
- set GOPATH, e.g. `set GOPATH=~\work`  
- set GO15VENDOREXPERIMENT=1 (not needed as of Go 1.6)  
- `cd %GOPATH%\github.com\keybase\client\go\keybase`  
- Find and set the address of your local server, e.g. set KEYBASE_SERVER_URI=http://172.16.199.5:3000 or use ci1.keybase.io  
- Note that when changing environment variables in a console, the service must be restarted for them to take effect  
- `go build` (or test or whatever)  

#To build the gui
- [Node](https://nodejs.org/en/)  
- [Python 2.7](https://www.python.org/ftp/python/2.7.11/python-2.7.11.msi)  
Switch to Node 5.7.0:  
- [NVM for Windows](https://github.com/coreybutler/nvm-windows/releases/download/1.1.0/nvm-setup.zip)  
Issue the commands "nvm install 5.7.0" and "nvm use 5.7.0"  
- [VisualStudio 2015](https://www.visualstudio.com/en-us/products/visual-studio-community-vs.aspx) 
  - Install the following options: <img width="343" alt="options" src="https://cloud.githubusercontent.com/assets/594035/16749512/a2249536-477f-11e6-92fe-59a4a82a90c9.PNG">
- Update npm. In an elevated command prompt (right-click cmd icon and select "Run As Administrator"), issue these commands, and select 3.8.1:
    `npm install -g npm-windows-upgrade`  
    `npm-windows-upgrade`  
- Open a new command window to capture the environment changes and enter:
npm i  
npm run package -- --arch ia32 --platform win32 --appVersion [version]  

#Windows VMs
available [here](https://dev.windows.com/en-us/microsoft-edge/tools/vms/windows/)
