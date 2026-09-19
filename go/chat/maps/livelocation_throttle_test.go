package maps

import (
	"math"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// north returns c moved due north by meters, which is exact under the
// spherical distance the throttle measures.
func north(c chat1.Coordinate, meters float64) chat1.Coordinate {
	c.Lat += meters / earthRadiusMeters * 180 / math.Pi
	return c
}

func TestShouldRecordFix(t *testing.T) {
	origin := chat1.Coordinate{Lat: 37.7749, Lon: -122.4194, Accuracy: 10}
	at := func(c chat1.Coordinate) *chat1.Coordinate { return &c }

	cases := []struct {
		name   string
		state  keybase1.MobileAppState
		last   fixThrottle
		next   chat1.Coordinate
		record bool
		after  fixThrottle
	}{
		{
			name:   "first fix since the watch started, in the background",
			state:  keybase1.MobileAppState_BACKGROUND,
			next:   origin,
			record: true,
			after:  fixThrottle{prev: at(origin)},
		},
		{
			name:   "any move in the foreground",
			state:  keybase1.MobileAppState_FOREGROUND,
			last:   fixThrottle{prev: at(origin), pendingDistance: 3},
			next:   north(origin, 1),
			record: true,
			after:  fixThrottle{prev: at(north(origin, 1))},
		},
		{
			name:   "short move in the background",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{prev: at(origin)},
			next:   north(origin, 10),
			record: false,
			after:  fixThrottle{prev: at(north(origin, 10)), pendingDistance: 10},
		},
		{
			name:   "short move while background work runs",
			state:  keybase1.MobileAppState_BACKGROUNDACTIVE,
			last:   fixThrottle{prev: at(origin)},
			next:   north(origin, 10),
			record: false,
			after:  fixThrottle{prev: at(north(origin, 10)), pendingDistance: 10},
		},
		{
			name:   "short move while on screen but not active",
			state:  keybase1.MobileAppState_INACTIVE,
			last:   fixThrottle{prev: at(origin)},
			next:   north(origin, 10),
			record: false,
			after:  fixThrottle{prev: at(north(origin, 10)), pendingDistance: 10},
		},
		{
			name:   "long move in the background",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{prev: at(origin)},
			next:   north(origin, 100),
			record: true,
			after:  fixThrottle{prev: at(north(origin, 100))},
		},
		{
			name:   "unrecorded moves add up to the distance",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{prev: at(origin), pendingDistance: 60},
			next:   north(origin, 10),
			record: true,
			after:  fixThrottle{prev: at(north(origin, 10))},
		},
		{
			name:   "the distance is along the path, not from the last recorded fix",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{prev: at(north(origin, 40)), pendingDistance: 40},
			next:   origin,
			record: true,
			after:  fixThrottle{prev: at(origin)},
		},
		{
			name:   "exactly the distance",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{prev: at(origin), pendingDistance: 65},
			next:   origin,
			record: true,
			after:  fixThrottle{prev: at(origin)},
		},
		{
			name:   "just short of the distance",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{prev: at(origin), pendingDistance: 64.9},
			next:   origin,
			record: false,
			after:  fixThrottle{prev: at(origin), pendingDistance: 64.9},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			record, after := shouldRecordFix(c.state, c.last, c.next)
			require.Equal(t, c.record, record)
			require.Equal(t, c.after.prev, after.prev)
			require.InDelta(t, c.after.pendingDistance, after.pendingDistance, 1e-6)
		})
	}
}
