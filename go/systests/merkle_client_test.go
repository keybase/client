package systests

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestMerkleClientLookups(t *testing.T) {
	tc := libkb.SetupTest(t, "merkle", 0)
	defer tc.Cleanup()

	mc := tc.G.GetMerkleClient()

	root, err := mc.FetchRootFromServer(libkb.NewMetaContextForTest(tc), 0)
	require.NoError(t, err)
	require.NotNil(t, root)

	tc2 := libkb.SetupTest(t, "merkle", 0)
	defer tc2.Cleanup()
	u, err := kbtest.CreateAndSignupFakeUser("mer", tc2.G)
	require.NoError(t, err)

	q := libkb.NewHTTPArgs()
	q.Add("uid", libkb.UIDArg(u.GetUID()))

	// Within tc, root is still the one from before the user u was created, so a call without polling should result in a user with no sigchain tail
	mul, err := mc.LookupUser(libkb.NewMetaContextForTest(tc), q, nil, libkb.MerkleOpts{NoServerPolling: true})
	require.NoError(t, err)
	require.Nil(t, mul.Public())
	// Also the merkle root should not have been updated
	require.Equal(t, *root.Seqno(), *mc.LastRoot(libkb.NewMetaContextForTest(tc)).Seqno())

	// If we poll, we should receive a user which actually has a sigchain, and the root should be updated in the process
	mul, err = mc.LookupUser(libkb.NewMetaContextForTest(tc), q, nil, libkb.MerkleOpts{NoServerPolling: false})
	require.NoError(t, err)
	require.NotNil(t, mul.Public())
	// Also the merkle root should have been updated
	newRoot := mc.LastRoot(libkb.NewMetaContextForTest(tc))
	require.True(t, *root.Seqno() < *newRoot.Seqno())

	// Now, let's generate an unrelated merkle tree change to check that polling does not update the root when it's not needed
	err = tc2.Logout()
	require.NoError(t, err)
	_, err = kbtest.CreateAndSignupFakeUser("mer", tc2.G)
	require.NoError(t, err)
	// this user creation should have caused the root of the merkle tree to advance
	require.True(t, *newRoot.Seqno() < *tc2.G.GetMerkleClient().LastRoot(libkb.NewMetaContextForTest(tc2)).Seqno())

	mul, err = mc.LookupUser(libkb.NewMetaContextForTest(tc), q, nil, libkb.MerkleOpts{NoServerPolling: false})
	require.NoError(t, err)
	require.NotNil(t, mul.Public())
	require.Equal(t, *newRoot.Seqno(), *mc.LastRoot(libkb.NewMetaContextForTest(tc)).Seqno())
}
