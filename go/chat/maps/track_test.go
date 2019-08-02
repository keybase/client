package maps

import (
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestLocationTrackMaxCoords(t *testing.T) {
	convID := chat1.ConversationID([]byte{0, 0, 1})
	msgID := chat1.MessageID(5)
	endTime := time.Now().Add(time.Hour)
	tr := newLocationTrack(convID, msgID, endTime, false, 2, false)
	firstCoord := chat1.Coordinate{Lat: 0, Lon: 1}
	tr.updateCh <- chat1.Coordinate{Lat: 40.678, Lon: -73.98}
	tr.updateCh <- chat1.Coordinate{Lat: 40.678, Lon: -73.99}
	secondCoord := chat1.Coordinate{Lat: 50.678, Lon: -63.98}
	tr.updateCh <- secondCoord
	latestCoord := chat1.Coordinate{Lat: 30.678, Lon: -93.98}
	tr.updateCh <- latestCoord
	tr.Drain(firstCoord)
	coords := tr.GetCoords()
	require.Equal(t, []chat1.Coordinate{firstCoord, secondCoord, latestCoord}, coords)
}
