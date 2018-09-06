package git

import (
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/teams"
)

// Copied from the teams tests.
func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	tc = libkb.SetupTest(tb, name, depth+1)
	InstallInsecureTriplesec(tc.G)
	tc.G.SetServices(externals.NewExternalServices(tc.G))
	tc.G.ChatHelper = kbtest.NewMockChatHelper()
	teams.ServiceInit(tc.G)
	return tc
}
