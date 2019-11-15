package libkb

import (
	"encoding/hex"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	clockwork "github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

type id3FakeUIRouter struct {
	ui id3FakeUI
}

func (i *id3FakeUIRouter) SetUI(ConnectionID, UIKind)         {}
func (i *id3FakeUIRouter) GetIdentifyUI() (IdentifyUI, error) { return nil, nil }
func (i *id3FakeUIRouter) GetIdentifyUICtx(ctx context.Context) (int, IdentifyUI, error) {
	return 0, nil, nil
}
func (i *id3FakeUIRouter) GetSecretUI(sessionID int) (SecretUI, error)               { return nil, nil }
func (i *id3FakeUIRouter) GetRekeyUI() (keybase1.RekeyUIInterface, int, error)       { return nil, 0, nil }
func (i *id3FakeUIRouter) GetRekeyUINoSessionID() (keybase1.RekeyUIInterface, error) { return nil, nil }
func (i *id3FakeUIRouter) GetHomeUI() (keybase1.HomeUIInterface, error)              { return nil, nil }
func (i *id3FakeUIRouter) GetChatUI() (ChatUI, error)                                { return nil, nil }
func (i *id3FakeUIRouter) GetIdentify3UIAdapter(MetaContext) (IdentifyUI, error) {
	return nil, nil
}
func (i *id3FakeUIRouter) DumpUIs() map[UIKind]ConnectionID {
	return nil
}
func (i *id3FakeUIRouter) Shutdown() {}

func (i *id3FakeUIRouter) GetIdentify3UI(MetaContext) (keybase1.Identify3UiInterface, error) {
	return &i.ui, nil
}

type id3FakeUI struct {
	timeOuts []keybase1.Identify3GUIID
}

func (i *id3FakeUI) assertAndCleanState(t *testing.T, expected []keybase1.Identify3GUIID) {
	require.Equal(t, len(expected), len(i.timeOuts))
	for j, v := range expected {
		require.Equal(t, v, i.timeOuts[j])
	}
	i.timeOuts = nil
}

func (i *id3FakeUI) Identify3ShowTracker(context.Context, keybase1.Identify3ShowTrackerArg) error {
	return nil
}
func (i *id3FakeUI) Identify3UpdateRow(context.Context, keybase1.Identify3Row) error {
	return nil
}
func (i *id3FakeUI) Identify3UpdateUserCard(context.Context, keybase1.Identify3UpdateUserCardArg) error {
	return nil
}
func (i *id3FakeUI) Identify3UserReset(_ context.Context, id keybase1.Identify3GUIID) error {
	return nil
}
func (i *id3FakeUI) Identify3TrackerTimedOut(_ context.Context, id keybase1.Identify3GUIID) error {
	i.timeOuts = append(i.timeOuts, id)
	return nil
}
func (i *id3FakeUI) Identify3Result(context.Context, keybase1.Identify3ResultArg) error { return nil }

func TestIdentify3State(t *testing.T) {
	tc := SetupTest(t, "TestIdentify3State()", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)
	uiRouter := id3FakeUIRouter{}
	tc.G.UIRouter = &uiRouter
	err := tc.G.Identify3State.Shutdown(NewMetaContextForTest(tc))
	require.NoError(t, err)

	id3state, testCompletionCh := NewIdentify3StateForTest(tc.G)
	tc.G.Identify3State = id3state

	mkID := func(i int) keybase1.Identify3GUIID {
		var buf [1]byte
		buf[0] = byte(i)
		return keybase1.Identify3GUIID(hex.EncodeToString(buf[:]))
	}
	mkSession := func(i int) *Identify3Session {
		return &Identify3Session{
			created: fakeClock.Now(),
			id:      mkID(i),
		}
	}

	assertState := func(cache, queue []int) {
		id3state.Lock()
		require.Equal(t, len(cache), len(id3state.cache))
		for _, v := range cache {
			_, found := id3state.cache[mkID(v)]
			require.True(t, found)
		}
		require.Equal(t, len(queue), len(id3state.expirationQueue))
		for i, v := range queue {
			require.Equal(t, mkID(v), id3state.expirationQueue[i].id)
		}
		id3state.Unlock()
	}

	advance := func(d time.Duration) {
		id3state.bgThreadTimeMu.Lock()
		fakeClock.Advance(d)
		now := fakeClock.Now()
		id3state.bgThreadTimeMu.Unlock()
		for {
			completedThough := <-testCompletionCh
			if !completedThough.Before(now) {
				break
			}
		}
	}

	inc := id3state.expireTime / 10000
	epsilon := inc / 2

	// put in 3 items all inc time apart.
	err = id3state.Put(mkSession(1))
	require.NoError(t, err)
	fakeClock.Advance(inc)
	err = id3state.Put(mkSession(2))
	require.NoError(t, err)
	fakeClock.Advance(inc)
	err = id3state.Put(mkSession(3))
	require.NoError(t, err)

	// make sure that all 3 items hit the cache, and in the right order.
	set := []int{1, 2, 3}
	assertState(set, set)

	// After advancing a little bit more than necessary expiration time, we should
	// see a situation where item 1 is going from both the cache and the queue,
	// and that it shows up as expired in the UI.
	advance(id3state.expireTime - inc - epsilon)
	set = []int{2, 3}
	assertState(set, set)
	uiRouter.ui.assertAndCleanState(t, []keybase1.Identify3GUIID{mkID(1)})

	// When we remove an item explicitly, it's removed from the cache, but not
	// the queue, so check this expectation.
	id3state.Remove(mkID(3))
	assertState([]int{2}, []int{2, 3})

	// Now item 2 is about to expire, which will leave just 3 sitting around in
	// the queue.
	advance(inc)
	assertState([]int{}, []int{3})
	uiRouter.ui.assertAndCleanState(t, []keybase1.Identify3GUIID{mkID(2)})

	// Because 3 was removed prior to its expiration, it shouldn't trigger a UI
	// event.
	advance(inc)
	assertState([]int{}, []int{})
	uiRouter.ui.assertAndCleanState(t, []keybase1.Identify3GUIID{})
}

func TestIdentify3StateShutdown(t *testing.T) {
	tc := SetupTest(t, "TestIdentify3State()", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)
	// throwaway the existing Identify3State on tc.G
	err := tc.G.Identify3State.Shutdown(NewMetaContextForTest(tc))
	require.NoError(t, err)

	// make a new "test" one
	id3state, testCompletionCh := NewIdentify3StateForTest(tc.G)
	tc.G.Identify3State = id3state

	advance := func(d time.Duration) {
		id3state.bgThreadTimeMu.Lock()
		defer id3state.bgThreadTimeMu.Unlock()
		fakeClock.Advance(d)
	}

	// advance the clock and empty the test channel
	advance(1*time.Hour + 1*time.Second)
	for len(testCompletionCh) > 0 {
		<-testCompletionCh
	}
	require.Equal(t, 0, len(testCompletionCh), "test channel is empty")

	// shut down Identify3State through the global shutdown
	err = tc.G.Shutdown(NewMetaContextForTest(tc))
	require.NoError(t, err)
	if len(testCompletionCh) == 1 {
		// it's possible there's something in the channel
		// from the moment of shutdown, and this doesn't matter
		// so just throw it away.
		<-testCompletionCh
	}

	// but now, the testCompletionCh should be empty even if we
	// advance the fake clock and the real clock a few times
	for i := 0; i < 3; i++ {
		advance(1*time.Hour + 1*time.Second)
		<-time.After(1 * time.Second)
		advance(1*time.Hour + 1*time.Second)
		require.Equal(t, 0, len(testCompletionCh), "Identity3State may not have actually shut down")
	}
}
