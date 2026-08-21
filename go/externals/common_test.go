package externals

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pvl"
	"github.com/stretchr/testify/require"
)

func setupTest(tb libkb.TestingTB, name string, depth int) libkb.TestContext {
	tc := libkb.SetupTest(tb, name, depth)
	g := tc.G
	g.SetProofServices(NewProofServices(g))
	err := g.ConfigureMerkleClient()
	require.NoError(tb, err)
	pvl.NewPvlSourceAndInstall(g)
	NewParamProofStoreAndInstall(g)
	return tc
}
