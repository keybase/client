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
	}{
		{
			name:   "first fix since the watch started, in the background",
			state:  keybase1.MobileAppState_BACKGROUND,
			next:   origin,
			record: true,
		},
		{
			name:   "any move in the foreground",
			state:  keybase1.MobileAppState_FOREGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   north(origin, 1),
			record: true,
		},
		{
			name:   "short move in the background",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   north(origin, 10),
			record: false,
		},
		{
			name:   "short move while background work runs",
			state:  keybase1.MobileAppState_BACKGROUNDACTIVE,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   north(origin, 10),
			record: false,
		},
		{
			name:   "short move while on screen but not active",
			state:  keybase1.MobileAppState_INACTIVE,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   north(origin, 10),
			record: false,
		},
		{
			name:   "long move in the background",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   north(origin, 100),
			record: true,
		},
		{
			name:   "just past the distance",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   north(origin, 65.1),
			record: true,
		},
		{
			name:   "just short of the distance",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   north(origin, 64.9),
			record: false,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			record, after := shouldRecordFix(c.state, c.last, c.next)
			require.Equal(t, c.record, record)
			want := c.last
			if c.record {
				want.lastRecorded = at(c.next)
			}
			require.Equal(t, want, after)
		})
	}
}

// recordedAt feeds fixes to a fresh throttle in the background and returns the
// indexes of the ones it records.
func recordedAt(fixes []chat1.Coordinate) (recorded []int) {
	var throttle fixThrottle
	for i, fix := range fixes {
		var record bool
		record, throttle = shouldRecordFix(keybase1.MobileAppState_BACKGROUND, throttle, fix)
		if record {
			recorded = append(recorded, i)
		}
	}
	return recorded
}

func TestShouldRecordFixIgnoresJitter(t *testing.T) {
	origin := chat1.Coordinate{Lat: 37.7749, Lon: -122.4194, Accuracy: 100}
	fixes := []chat1.Coordinate{origin}
	for i := 0; i < 20; i++ {
		fixes = append(fixes, north(origin, 40), north(origin, -40))
	}
	require.Equal(t, []int{0}, recordedAt(fixes))
}

func TestShouldRecordFixSlowDrift(t *testing.T) {
	origin := chat1.Coordinate{Lat: 37.7749, Lon: -122.4194, Accuracy: 10}
	var fixes []chat1.Coordinate
	for i := 0; i <= 14; i++ {
		fixes = append(fixes, north(origin, float64(10*i)))
	}
	// 70m from origin at fix 7, then 70m from that at fix 14.
	require.Equal(t, []int{0, 7, 14}, recordedAt(fixes))
}
