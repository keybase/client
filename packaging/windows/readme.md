##Signing and Building  
#Tools/requirements  
- [InnoScript](http://www.jrsoftware.org/isdl.php#stable)  
- SignTool.exe from the [Microsoft SDK](https://www.microsoft.com/en-us/download/details.aspx?id=8279) on the path somewhere (Any SDK will do, they all have SignTool.exe).  
- Hardware token from DigiCert and [SafeNet Authentication Client software](https://www.digicert.com/code-signing/safenet-client-installation.htm)  
- server repo, for favicon.ico

# Steps
1. CD to github.com\keybase\client\go\keybase
1. set GOARCH=386⋅
2. `go generate`
3. `go build -tags production`
4. CD to github.com\keybase\client\packaging\windows
5. Prepare signing password, per digicert in the keys repo
6. `doinstaller [full path to keybase.exe]`, e.g. `doinstaller c:\work\src\github.com\keybase\client\go\keybase\keybase.exe`
- Answer password prompts
