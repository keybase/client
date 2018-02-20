package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestMerkleClientHistorical(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testMerkleClientHistorical(t, sigVersion)
	})
}

func _testMerkleClientHistorical(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	q := libkb.NewHTTPArgs()
	q.Add("uid", libkb.UIDArg(fu.UID()))
	mc := tc.G.MerkleClient
	leaf, err := mc.LookupUser(context.TODO(), q, nil)
	root := mc.LastRoot()

	require.NoError(t, err)
	require.NotNil(t, leaf)
	require.NotNil(t, root)

	for i := 0; i < 5; i++ {
		trackAlice(tc, fu, sigVersion)
		untrackAlice(tc, fu, sigVersion)
	}
	leaf2, err := mc.LookupLeafAtHashMeta(context.TODO(), fu.UID().AsUserOrTeam(), root.HashMeta())
	require.NoError(t, err)
	require.NotNil(t, leaf2)
	require.True(t, leaf.Public().Eq(*leaf2.Public))

}
