package maps

import (
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type locationTrack struct {
	sync.Mutex
	stopCh   chan struct{}
	updateCh chan chat1.Coordinate

	convID             chat1.ConversationID
	msgID              chat1.MessageID
	endTime            time.Time
	allCoords          []chat1.Coordinate
	getCurrentPosition bool
	maxCoords          int
}

func (t *locationTrack) GetCoords() (res []chat1.Coordinate) {
	t.Lock()
	defer t.Unlock()
	res = make([]chat1.Coordinate, len(t.allCoords))
	copy(res, t.allCoords)
	return res
}

func (t *locationTrack) capLocked(maxCoords int) {
	if len(t.allCoords) < maxCoords || len(t.allCoords) == 0 {
		return
	}
	newCoords := make([]chat1.Coordinate, maxCoords+1)
	copy(newCoords, t.allCoords[len(t.allCoords)-maxCoords:len(t.allCoords)])
	newCoords = append([]chat1.Coordinate{t.allCoords[0]}, newCoords...)
	t.allCoords = newCoords
}

func (t *locationTrack) Drain(coord chat1.Coordinate) {
	t.Lock()
	defer t.Unlock()
	defer t.capLocked(t.maxCoords)
	if !coord.IsZero() {
		t.allCoords = append(t.allCoords, coord)
	}
	for {
		select {
		case coord := <-t.updateCh:
			t.allCoords = append(t.allCoords, coord)
		default:
			return
		}
	}
}

func (t *locationTrack) SetCoords(coords []chat1.Coordinate) {
	t.Lock()
	defer t.Unlock()
	t.allCoords = coords
	t.capLocked(t.maxCoords)
}

func (t *locationTrack) Key() types.LiveLocationKey {
	key := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%d", t.convID, t.msgID)))
	return types.LiveLocationKey(key)
}

func (t *locationTrack) ToDisk() diskLocationTrack {
	return diskLocationTrack{
		ConvID:             t.convID,
		MsgID:              t.msgID,
		EndTime:            gregor1.ToTime(t.endTime),
		Coords:             t.GetCoords(),
		GetCurrentPosition: t.getCurrentPosition,
		MaxCoords:          t.maxCoords,
	}
}

func newLocationTrack(convID chat1.ConversationID, msgID chat1.MessageID,
	endTime time.Time, getCurrentPosition bool, maxCoords int) *locationTrack {
	return &locationTrack{
		stopCh:             make(chan struct{}),
		updateCh:           make(chan chat1.Coordinate, 50),
		convID:             convID,
		msgID:              msgID,
		endTime:            endTime,
		getCurrentPosition: getCurrentPosition,
		maxCoords:          maxCoords,
	}
}

func newLocationTrackFromDisk(d diskLocationTrack) *locationTrack {
	t := newLocationTrack(d.ConvID, d.MsgID, gregor1.FromTime(d.EndTime), d.GetCurrentPosition, d.MaxCoords)
	t.allCoords = d.Coords
	return t
}
