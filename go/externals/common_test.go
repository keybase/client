package externals

import (
	"github.com/keybase/client/go/libkb"
	"testing"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	ret := libkb.SetupTest(tb, name, depth+1)
	ret.G.SetServices(GetServices())
	return ret
}
