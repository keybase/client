package externals

import (
	"github.com/keybase/client/go/libkb"
)

func NewGlobalContextInit() *libkb.GlobalContext {
	ret := libkb.NewGlobalContext().Init()
	ret.SetServices(GetServices())
	return ret
}
