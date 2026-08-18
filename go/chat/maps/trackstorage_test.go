package maps

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/libkb"
)

func TestTrackStorage(t *testing.T) {
	tc := libkb.SetupTest(t, "TestTrackStorage", 1)
	defer tc.Cleanup()
	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	ts := newTrackStorage(&globals.Context{GlobalContext: tc.G, ChatContext: nil})
	trackers := []*locationTrack{
		{
			convID:  chat1.ConversationID([]byte{0, 0, 1}),
			msgID:   5,
			endTime: time.Now().Add(time.Hour),
			allCoords: []chat1.Coordinate{
				{
					Lat: -41.8983,
					Lon: 79.882,
				},
			},
		},
	}
	require.NoError(t, ts.Save(context.TODO(), trackers))
	res, err := ts.Restore(context.TODO())
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Len(t, res[0].allCoords, len(trackers[0].allCoords))
	require.InDelta(t, trackers[0].allCoords[0].Lat, res[0].allCoords[0].Lat, 0)
}
