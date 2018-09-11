package externals

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pvlsource"
)

func NewGlobalContextInit() *libkb.GlobalContext {
	ret := libkb.NewGlobalContext().Init()
	ret.SetServices(GetServices())
	pvlsource.NewPvlSourceAndInstall(ret)
	return ret
}
