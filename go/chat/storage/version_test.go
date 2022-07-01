package storage

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestServerVersionSync(t *testing.T) {
	tc := setupCommonTest(t, "version")
	defer tc.Cleanup()

	err := tc.Context().ServerCacheVersions.Set(context.TODO(), chat1.ServerCacheVers{
		InboxVers:  10,
		BodiesVers: 5,
	})
	require.NoError(t, err)

	res, err := tc.Context().ServerCacheVersions.Fetch(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 10, res.InboxVers)
	require.Equal(t, 5, res.BodiesVers)

	err = tc.Context().ServerCacheVersions.Set(context.TODO(), chat1.ServerCacheVers{
		InboxVers:  10,
		BodiesVers: 5,
	})
	require.NoError(t, err)

	vers, err := tc.Context().ServerCacheVersions.MatchInbox(context.TODO(), 10)
	require.NoError(t, err)
	require.Equal(t, 10, vers)

	vers, err = tc.Context().ServerCacheVersions.MatchBodies(context.TODO(), 5)
	require.NoError(t, err)
	require.Equal(t, 5, vers)

	_, err = tc.Context().ServerCacheVersions.MatchInbox(context.TODO(), 11)
	require.Error(t, err)
	require.IsType(t, VersionMismatchError{}, err)
}
