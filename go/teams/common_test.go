package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	ret := libkb.SetupTest(tb, name, depth+1)
	NewTeamLoaderAndInstall(ret.G)
	return ret
}

func GetForTestByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	return Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})
}
