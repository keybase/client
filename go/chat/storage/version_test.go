package storage

import (
	"context"
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestServerVersionSync(t *testing.T) {
	tc := externals.SetupTest(t, "version", 2)
	tc.G.ServerCacheVersions = NewServerVersions(tc.G)

	err := tc.G.ServerCacheVersions.Set(context.TODO(), chat1.ServerCacheVers{
		InboxVers:  10,
		BodiesVers: 5,
	})
	require.NoError(t, err)

	res, err := tc.G.ServerCacheVersions.Fetch(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 10, res.InboxVers)
	require.Equal(t, 5, res.BodiesVers)

	err = tc.G.ServerCacheVersions.Set(context.TODO(), chat1.ServerCacheVers{
		InboxVers:  10,
		BodiesVers: 5,
	})
	require.NoError(t, err)

	vers, err := tc.G.ServerCacheVersions.MatchInbox(context.TODO(), 10)
	require.NoError(t, err)
	require.Equal(t, 10, vers)

	vers, err = tc.G.ServerCacheVersions.MatchBodies(context.TODO(), 5)
	require.NoError(t, err)
	require.Equal(t, 5, vers)

	vers, err = tc.G.ServerCacheVersions.MatchInbox(context.TODO(), 11)
	require.Error(t, err)
	require.IsType(t, VersionMismatchError{}, err)
}
