package maps

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

// nilCtxFactory satisfies types.ContextFactory with no-op finders: the trackers
// under test never unbox a real message, so nothing calls into them, but
// updateMapUnfurl unconditionally wires them into the context via
// globals.ChatCtx before it does anything else.
type nilCtxFactory struct{}

func (nilCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (nilCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

var watchBugsTestConvID = chat1.ConversationID("conv")
var watchBugsTestUID = gregor1.UID([]byte{0, 1})

// newLiveLocationBugsTestTracker wires a LiveLocationTracker to a fake
// UIRouter/chat UI and a mock chat helper (whose GetMessage always returns
// an invalid message, so any unfurl attempt fails fast without a real chat
// server) and registers cleanup that stops every tracker started against it.
// It also owns tc's teardown: t.Cleanup runs last-registered-first, so
// registering tc.Cleanup before the tracker-stop cleanup tears the test
// context down only after every tracker has exited, instead of under them.
// Start must be called so goTrackerLocked will actually launch trackers
// (it no-ops when !l.started).
func newLiveLocationBugsTestTracker(t *testing.T, tc libkb.TestContext, chatUI libkb.ChatUI) *LiveLocationTracker {
	t.Cleanup(tc.Cleanup)
	tc.G.ChatHelper = kbtest.NewMockChatHelper()
	tc.G.SetUIRouter(kbtest.NewMockUIRouter(chatUI))
	g := globals.NewContext(tc.G, &globals.ChatContext{CtxFactory: nilCtxFactory{}})
	l := NewLiveLocationTracker(g)
	l.Start(context.Background(), watchBugsTestUID)
	t.Cleanup(func() {
		l.StopAllTracking(context.Background())
		select {
		case <-l.Stop(context.Background()):
		case <-time.After(10 * time.Second):
			t.Error("trackers did not stop during cleanup")
		}
	})
	return l
}

// failingWatchChatUI always fails to start a watch, counting attempts.
type failingWatchChatUI struct {
	utils.NullChatUI
	attempts atomic.Int32
}

func (u *failingWatchChatUI) ChatWatchPosition(context.Context, chat1.ConversationID,
	chat1.UIWatchPositionPerm,
) (chat1.LocationWatchID, error) {
	u.attempts.Add(1)
	return 0, errors.New("no UI yet")
}

// fakeWatchChatUI always succeeds immediately.
type fakeWatchChatUI struct {
	utils.NullChatUI
	sync.Mutex
	nextID  chat1.LocationWatchID
	watches int
}

func (u *fakeWatchChatUI) ChatWatchPosition(context.Context, chat1.ConversationID,
	chat1.UIWatchPositionPerm,
) (chat1.LocationWatchID, error) {
	u.Lock()
	defer u.Unlock()
	u.nextID++
	u.watches++
	return u.nextID, nil
}

func (u *fakeWatchChatUI) ChatClearWatch(context.Context, chat1.LocationWatchID) error {
	return nil
}

func (u *fakeWatchChatUI) Watches() int {
	u.Lock()
	defer u.Unlock()
	return u.watches
}

// TestStartWatchGivesUp: startWatch must give up and return an error after
// enough failed attempts (regression: the retry loop used to increment
// maxWatchAttempts instead of watchAttempts, so it never gave up).
func TestStartWatchGivesUp(t *testing.T) {
	tc := libkb.SetupTest(t, "StartWatchGivesUp", 0)
	ui := &failingWatchChatUI{}
	l := newLiveLocationBugsTestTracker(t, tc, ui)

	track := newLocationTrack(watchBugsTestConvID, 1, time.Now().Add(time.Hour), false, 10, false)
	done := make(chan error, 1)
	go func() {
		_, err := l.startWatch(context.Background(), track)
		done <- err
	}()
	select {
	case err := <-done:
		require.Error(t, err, "startWatch should give up and return an error")
	case <-time.After(30 * time.Second):
		t.Fatal("startWatch never gave up")
	}
}

// TestFailedWatchLeavesNoTracker: a tracker whose watch never succeeds must
// eventually remove itself and leave ActivelyTracking false (regression:
// startWatch used to retry forever, and even after giving up tracker()
// returned before removing the entry from l.trackers).
func TestFailedWatchLeavesNoTracker(t *testing.T) {
	tc := libkb.SetupTest(t, "FailedWatchLeavesNoTracker", 0)
	ui := &failingWatchChatUI{}
	l := newLiveLocationBugsTestTracker(t, tc, ui)

	l.StartTracking(context.Background(), watchBugsTestConvID, 1, time.Now().Add(time.Hour))
	require.Eventually(t, func() bool {
		return ui.attempts.Load() > 0
	}, 10*time.Second, time.Millisecond, "watch was never attempted")

	require.Eventually(t, func() bool {
		l.Lock()
		empty := len(l.trackers) == 0
		l.Unlock()
		return empty && !l.ActivelyTracking(context.Background())
	}, 30*time.Second, 50*time.Millisecond, "tracker never gave up and removed itself")
}

// TestLastCoordRace: tracker()'s prime-from-lastCoord path must take
// l.Lock() (regression: that read used to be unlocked while LocationUpdate
// wrote under the lock). Run under -race.
func TestLastCoordRace(t *testing.T) {
	if !raceEnabled {
		t.Skip("race detector required; run `go test -race`")
	}
	tc := libkb.SetupTest(t, "LastCoordRace", 0)
	ui := &fakeWatchChatUI{}
	l := newLiveLocationBugsTestTracker(t, tc, ui)

	stop := make(chan struct{})
	updatesDone := make(chan struct{})
	go func() {
		defer close(updatesDone)
		i := 0.0
		for {
			select {
			case <-stop:
				return
			default:
				i++
				l.LocationUpdate(context.Background(), chat1.Coordinate{Lat: i, Lon: i})
			}
		}
	}()

	deadline := time.Now().Add(200 * time.Millisecond)
	msgID := chat1.MessageID(0)
	for time.Now().Before(deadline) && msgID < 500 {
		msgID++
		l.StartTracking(context.Background(), watchBugsTestConvID, msgID, time.Now().Add(time.Hour))
	}
	close(stop)
	<-updatesDone
}

// TestStopDuringStartTracking races a fresh StartTracking against a Stop
// call. Stop snapshots l.trackers under the lock and tells only those to
// stop, but it then waits on l.eg, a single errgroup shared for the
// tracker's whole lifetime -- not just the trackers it just told to stop.
// If a concurrent StartTracking could join that errgroup after Stop's
// snapshot without being stopped, Stop's channel would hang until that
// tracker's endTime. goTrackerLocked refusing work when !l.started closes
// that hole; this test keeps the race honest. Looping makes the bad
// ordering land within a few iterations; the per-iteration 5s cap catches
// a hang. Each Stop clears started, so we Start again before the next
// iteration's StartTracking.
func TestStopDuringStartTracking(t *testing.T) {
	tc := libkb.SetupTest(t, "StopDuringStartTracking", 0)
	ui := &fakeWatchChatUI{}
	l := newLiveLocationBugsTestTracker(t, tc, ui)

	for i := 0; i < 200; i++ {
		firstID := chat1.MessageID(2*i + 1)
		secondID := chat1.MessageID(2*i + 2)
		watchesBefore := ui.Watches()
		l.StartTracking(context.Background(), watchBugsTestConvID, firstID, time.Now().Add(time.Hour))
		require.Eventually(t, func() bool { return ui.Watches() > watchesBefore }, 2*time.Second, time.Millisecond,
			"first tracker's watch never started")

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			l.StartTracking(context.Background(), watchBugsTestConvID, secondID, time.Now().Add(time.Hour))
		}()
		stopped := l.Stop(context.Background())
		wg.Wait()

		select {
		case <-stopped:
		case <-time.After(5 * time.Second):
			t.Fatalf("Stop's channel did not close within 5s (iteration %d)", i)
		}
		l.Start(context.Background(), watchBugsTestUID)
	}
}
