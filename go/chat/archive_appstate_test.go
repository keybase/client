package chat

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// setupAppStateArchive returns a registry that skips the on-disk read (inited
// is pre-set) and is seeded with one already-COMPLETE job, so Start's
// automatic resume never launches a real archive job.
func setupAppStateArchive(t *testing.T) (*ChatArchiveRegistry, libkb.TestContext) {
	tc := externalstest.SetupTest(t, "archive-appstate", 0)
	t.Cleanup(tc.Cleanup)
	g := globals.NewContext(tc.G, &globals.ChatContext{CtxFactory: appStateCtxFactory{}})
	r := NewChatArchiveRegistry(g, nil)
	// The real key needs a logged-in user.
	r.edb = encrypteddb.New(tc.G, func(g *libkb.GlobalContext) *libkb.JSONLocalDb { return g.LocalChatDb },
		func(context.Context) ([32]byte, error) { return [32]byte{}, nil })
	r.inited = true
	r.jobHistory.JobHistory["job-old"] = chat1.ArchiveChatJob{
		Request: chat1.ArchiveChatJobRequest{JobID: "job-old"},
		Status:  chat1.ArchiveChatJobStatus_COMPLETE,
	}
	return r, tc
}

func requireArchiveStopped(t *testing.T, r *ChatArchiveRegistry) {
	t.Helper()
	select {
	case <-r.Stop(context.TODO()):
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Stop did not finish")
	}
}

// A Start for one user followed by a Stop and a Start for another user must
// read that user's own job history, not the previous user's. The registry
// never actually reads from disk in this test (inited is forced true), so
// this isolates whatever Start/Stop do (or fail to do) to the in-memory
// jobHistory itself.
func TestArchiveHistoryPerUser(t *testing.T) {
	r, _ := setupAppStateArchive(t)
	r.resumeJobsDelay = time.Hour
	ctx := context.Background()
	uidA := gregor1.UID([]byte{1, 2, 3, 4})
	uidB := gregor1.UID([]byte{5, 6, 7, 8})

	r.Start(ctx, uidA)
	requireArchiveStopped(t, r)

	r.Start(ctx, uidB)
	defer requireArchiveStopped(t, r)

	res, err := r.List(ctx)
	require.NoError(t, err)
	require.Empty(t, res.Jobs, "List returned the previous user's job history for a different user")
}

// A job that registers as RUNNING through Set while the app is already
// BACKGROUND must be paused at once: canceled and recorded as
// BACKGROUND_PAUSED, the same as a job that was running when the app went to
// BACKGROUND.
func TestArchiveSetWhileBackgrounded(t *testing.T) {
	r, tc := setupAppStateArchive(t)
	ctx := context.Background()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	r.Start(ctx, uid)
	defer requireArchiveStopped(t, r)
	// Give the registry's own app-state watcher time to observe the
	// already-BACKGROUND state before the job registers.
	time.Sleep(200 * time.Millisecond)

	canceled := make(chan struct{})
	var once sync.Once
	cancel := func() { once.Do(func() { close(canceled) }) }
	jobID := chat1.ArchiveJobID("job-manual")
	job := chat1.ArchiveChatJob{
		Request: chat1.ArchiveChatJobRequest{JobID: jobID},
		Status:  chat1.ArchiveChatJobStatus_RUNNING,
	}
	// Set's return is not asserted: a fix may legitimately return a pause
	// sentinel for a job registered while backgrounded, same as it may
	// return nil. Only the pause side effects (cancel, status) matter here.
	_ = r.Set(ctx, cancel, job)

	select {
	case <-canceled:
	case <-time.After(200 * time.Millisecond):
		require.FailNow(t, "Set did not cancel a job registered while the app was BACKGROUND")
	}
	got, err := r.Get(ctx, jobID)
	require.NoError(t, err)
	require.Equal(t, chat1.ArchiveChatJobStatus_BACKGROUND_PAUSED, got.Status)
}
