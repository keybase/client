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

func withAccuracy(c chat1.Coordinate, accuracy float64) chat1.Coordinate {
	c.Accuracy = accuracy
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
			name:   "long move with a coarse fix",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   withAccuracy(north(origin, 100), 100),
			record: false,
		},
		{
			name:   "move past both accuracies",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   withAccuracy(north(origin, 111), 100),
			record: true,
		},
		{
			name:   "coarse fixes, just short of the cap",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(withAccuracy(origin, 3000))},
			next:   withAccuracy(north(origin, 199.9), 3000),
			record: false,
		},
		{
			name:   "coarse fixes, just past the cap",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(withAccuracy(origin, 3000))},
			next:   withAccuracy(north(origin, 200.1), 3000),
			record: true,
		},
		{
			name:   "accuracies summing to just under the cap",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(withAccuracy(origin, 90))},
			next:   withAccuracy(north(origin, 189), 100),
			record: false,
		},
		{
			name:   "accuracies summing to just under the cap, moved past them",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(withAccuracy(origin, 90))},
			next:   withAccuracy(north(origin, 190.1), 100),
			record: true,
		},
		{
			name:   "short move with unknown accuracy",
			state:  keybase1.MobileAppState_BACKGROUND,
			last:   fixThrottle{lastRecorded: at(origin)},
			next:   withAccuracy(north(origin, 10), 0),
			record: false,
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

func TestShouldRecordFixIgnoresJitterAroundOutlierAnchor(t *testing.T) {
	center := chat1.Coordinate{Lat: 37.7749, Lon: -122.4194}
	fixes := []chat1.Coordinate{withAccuracy(north(center, 40), 100)}
	for i := 0; i < 20; i++ {
		fixes = append(fixes,
			withAccuracy(north(center, -40), 65),
			withAccuracy(north(center, 40), 100))
	}
	require.Equal(t, []int{0}, recordedAt(fixes))
}

func TestShouldRecordFixReplacesCoarseAnchor(t *testing.T) {
	center := chat1.Coordinate{Lat: 37.7749, Lon: -122.4194, Accuracy: 10}
	coarse := north(center, 300)
	coarse.Accuracy = 1000
	fixes := []chat1.Coordinate{coarse, center, north(center, 20), north(center, -20), north(center, 70)}
	// The locked-on fix replaces the coarse one, jitter around it is ignored,
	// and a real move from it is recorded.
	require.Equal(t, []int{0, 1, 4}, recordedAt(fixes))
}

func TestShouldRecordFixCoarseFixesStillRecordMoves(t *testing.T) {
	// Approximate Location reports every fix kilometres wide, so the fixes
	// alone can never tell a move from jitter; a steady drive still records.
	origin := chat1.Coordinate{Lat: 37.7749, Lon: -122.4194, Accuracy: 3000}
	var fixes []chat1.Coordinate
	for i := 0; i <= 4; i++ {
		fixes = append(fixes, north(origin, float64(250*i)))
	}
	require.Equal(t, []int{0, 1, 2, 3, 4}, recordedAt(fixes))
}
