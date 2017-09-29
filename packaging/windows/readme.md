# Building on Windows  
## Building the client  
- Install [Git](https://git-scm.com/download/win)  
- Defaults are fine except these recommendations:  
-- "Use Git from the Windows Command Prompt"  
-- Checkout as-is, commit Unix-style line endings  
-- Use Windows' default console window (especially on Windows 10)  
- Install [Go](https://golang.org/dl/) 1.9  
- Open a command console and make a directory for cloning the repo, e.g.:  
`cd c:\`  
`mkdir work`  
`cd work`  
`mkdir src`  
`cd src`  
`mkdir github.com`  
`cd github.com`  
`mkdir keybase`  
`cd keybase`  
`git clone https://github.com/keybase/client.git`  
- set GOPATH, e.g. `set GOPATH=c:\work`  
- `cd %GOPATH%\github.com\keybase\client\go\keybase`  
- `go build`

# To build the gui
- [yarn](https://yarnpkg.com/lang/en/docs/install/)
- [VisualStudio 2015](https://my.visualstudio.com/downloads?q=visual%20studio%20enterprise%202015)   
- Open a new command window to capture the environment changes and enter:
- `cd %GOPATH%\github.com\keybase\client\shared`  
- `yarn install`
- `yarn run package -- --arch ia32 --platform win32 --appVersion [version]`

# Windows VMs
available [here](https://dev.windows.com/en-us/microsoft-edge/tools/vms/windows/)
