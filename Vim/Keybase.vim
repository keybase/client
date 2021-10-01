 Build started
 git clone q -branch=master http//github.com/keybase/client.git c:\work\src\github.com\keybase\client
 git checkout qf 256e00dc4684066d9208297a1dcdbe62cf297419
 go version
 go version go1.6.2 windows/aarch86/amd64
 cd go\keybase
 go build
 cd ..
 go list ./... | find /V "vendor"   testlist.txt
     /f %%i in (testlist.txt) do (appveyor AddTest %%i -Outcome Running -Framework gotest -Filename %%i & go test -timeout 50m %%i && appveyor UpdateTest %%i -Outcome Passed -Framework gotest -Filename %%i -Duration 0) || (appveyor UpdateTest %%i -Outcome Failed -Framework gotest -Filename %%i -Duration 0 & exit /b 1)
 ok  	github.com/keybase/client/go/auth	0.219s
 ok  	github.com/keybase/client/go/client	0.078s
 ok  	github.com/keybase/client/go/engine	1928.306s
 ?   	github.com/keybase/client/go/install	[no test files]
 ?   	github.com/keybase/client/go/kbtest	[no test files]
 ok  	github.com/keybase/client/go/kex2	0.328s
 ?   	github.com/keybase/client/go/keybase	[no test files]
 ?   	github.com/keybase/client/go/launchd	[no test files]
 ?   	github.com/keybase/client/go/libcmdline	[no test files]
 ok  	github.com/keybase/client/go/libkb	18.593s
 ok  	github.com/keybase/client/go/logger	0.062s
 ?   	github.com/keybase/client/go/loopback	[no test files]
 ok  	github.com/keybase/client/go/lsof	0.047s
 ?   	github.com/keybase/client/go/minterm	[no test files]
 ?   	github.com/keybase/client/go/mounter	[no test files]
 ?   	github.com/keybase/client/go/pinentry	[no test files]
 ok  	github.com/keybase/client/go/protocol	0.047s
 ?   	github.com/keybase/client/go/qrcode	[no test files]
 ok  	github.com/keybase/client/go/service	51.308s
 ?   	github.com/keybase/client/go/spotty	[no test files]
 ok  	github.com/keybase/client/go/systests	45.588s
 ?   	github.com/keybase/client/go/tools/naclkey	[no test files]
 ?   	github.com/keybase/client/go/tools/runquiet	[no test files]
 ?   	github.com/keybase/client/go/tools/tfilt	[no test files]
 ?   	github.com/keybase/client/go/tools/winresource	[no test files]
 ?   	github.com/keybase/client/go/tools/zip	[no test files]
 Build success
