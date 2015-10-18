package systests

import (
	"github.com/keybase/client/go/libkb"
	"path/filepath"
	"testing"
)

func setupTest(t *testing.T, nm string) *libkb.TestContext {
	tc := libkb.SetupTest(t, nm)
	tc.SetSocketFile(filepath.Join(tc.Tp.Home, libkb.SocketFile))
	if err := tc.G.ConfigureSocketInfo(); err != nil {
		t.Fatal(err)
	}
	return &tc
}

func cloneContext(prev *libkb.TestContext) *libkb.TestContext {
	ret := prev.Clone()
	if err := ret.G.ConfigureSocketInfo(); err != nil {
		ret.T.Fatal(err)
	}
	return &ret
}
