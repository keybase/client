// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/favorites"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	gomock "go.uber.org/mock/gomock"
)

func waitForCall(t *testing.T, timeout time.Duration) (
	waiter func(), done func(args ...any),
) {
	ch := make(chan struct{})
	return func() {
			select {
			case <-time.After(timeout):
				require.FailNow(t, "waiting on lastMockDone timeout")
			case <-ch:
			}
		}, func(args ...any) {
			ch <- struct{}{}
		}
}

const testSubscriptionManagerClientID SubscriptionManagerClientID = "test"

func initSubscriptionManagerTest(t *testing.T) (config Config,
	sm SubscriptionManager, notifier *MockSubscriptionNotifier,
	finish func(),
) {
	ctl := gomock.NewController(t)
	config = MakeTestConfigOrBust(t, "jdoe")
	notifier = NewMockSubscriptionNotifier(ctl)
	sm = config.SubscriptionManager(
		testSubscriptionManagerClientID, false, notifier)
	return config, sm, notifier, func() {
		if t.Failed() {
			// A failed test may leave a goroutine blocked in a gate.
			return
		}
		err := config.Shutdown(context.Background())
		require.NoError(t, err)
		ctl.Finish()
	}
}

type sliceMatcherNoOrder struct {
	x any
}

func (e sliceMatcherNoOrder) Matches(x any) bool {
	vExpected := reflect.ValueOf(e.x)
	vGot := reflect.ValueOf(x)
	if vExpected.Kind() != reflect.Slice || vGot.Kind() != reflect.Slice {
		return false
	}
	if vExpected.Len() != vGot.Len() {
		return false
	}
outer: // O(n^2) (to avoid more complicated reflect) but it's usually small.
	for i := 0; i < vExpected.Len(); i++ {
		for j := 0; j < vGot.Len(); j++ {
			if reflect.DeepEqual(vExpected.Index(i).Interface(), vGot.Index(j).Interface()) {
				continue outer
			}
		}
		return false
	}
	return true
}

func (e sliceMatcherNoOrder) String() string {
	return fmt.Sprintf("is %v (but order doesn't matter)", e.x)
}

func TestSubscriptionManagerSubscribePath(t *testing.T) {
	config, sm, notifier, finish := initSubscriptionManagerTest(t)
	defer finish()

	ctx := t.Context()
	ctx, err := libcontext.NewContextWithCancellationDelayer(
		libcontext.NewContextReplayable(
			ctx, func(c context.Context) context.Context {
				return ctx
			}))
	require.NoError(t, err)

	waiter0, done0 := waitForCall(t, 4*time.Second)
	waiter1, done1 := waitForCall(t, 4*time.Second)
	waiter2, done2 := waitForCall(t, 4*time.Second)
	waiter3, done3 := waitForCall(t, 4*time.Second)

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	sid1, sid2 := SubscriptionID("sid1"), SubscriptionID("sid2")

	t.Logf("Subscribe to CHILDREN at TLF root using sid1, and create a file. We should get a notification.")
	err = sm.SubscribePath(ctx, sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(testSubscriptionManagerClientID,
		[]SubscriptionID{sid1}, "/keybase/private/jdoe",
		[]keybase1.PathSubscriptionTopic{keybase1.PathSubscriptionTopic_CHILDREN})
	fileNode, _, err := config.KBFSOps().CreateFile(ctx, rootNode, rootNode.ChildName("file"), false, NoExcl)
	require.NoError(t, err)
	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Logf("Try to subscribe using sid1 again, and it should fail")
	err = sm.SubscribePath(ctx, sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT, nil)
	require.Error(t, err)

	t.Logf("Subscribe to STAT at TLF root using sid2, and create a dir. We should get a notification for STAT, and a notificiation for CHILDREN.")
	err = sm.SubscribePath(ctx, sid2, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(testSubscriptionManagerClientID,
		sliceMatcherNoOrder{[]SubscriptionID{sid1, sid2}},
		"/keybase/private/jdoe",
		sliceMatcherNoOrder{[]keybase1.PathSubscriptionTopic{
			keybase1.PathSubscriptionTopic_STAT,
			keybase1.PathSubscriptionTopic_CHILDREN,
		}}).Do(func(
		clientID SubscriptionManagerClientID, subscriptionIDs []SubscriptionID,
		path string, topics []keybase1.PathSubscriptionTopic,
	) {
		done0()
		done1()
	})
	_, _, err = config.KBFSOps().CreateDir(
		ctx, rootNode, rootNode.ChildName("dir1"))
	require.NoError(t, err)
	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// These waits are needed to avoid races.
	t.Logf("Waiting for last notifications (done0 and done1) before unsubscribing.")
	waiter0()
	waiter1()

	t.Logf("Unsubscribe sid1, and make another dir. We should only get a notification for STAT.")
	sm.Unsubscribe(ctx, sid1)
	notifier.EXPECT().OnPathChange(testSubscriptionManagerClientID,
		[]SubscriptionID{sid2}, "/keybase/private/jdoe",
		[]keybase1.PathSubscriptionTopic{keybase1.PathSubscriptionTopic_STAT}).Do(func(
		clientID SubscriptionManagerClientID, subscriptionIDs []SubscriptionID,
		path string, topics []keybase1.PathSubscriptionTopic,
	) {
		done2()
	})

	_, _, err = config.KBFSOps().CreateDir(
		ctx, rootNode, rootNode.ChildName("dir2"))
	require.NoError(t, err)
	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Logf("Waiting for last notification (done2) before unsubscribing.")
	waiter2()

	t.Logf("Unsubscribe sid2 as well. Then subscribe to STAT on the file using sid1 (which we unsubscribed earlier), and write to it. We should get STAT notification.")
	sm.Unsubscribe(ctx, sid2)
	err = sm.SubscribePath(ctx, sid1, "/keybase/private/jdoe/dir1/../file", keybase1.PathSubscriptionTopic_STAT, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(testSubscriptionManagerClientID,
		[]SubscriptionID{sid1}, "/keybase/private/jdoe/dir1/../file",
		[]keybase1.PathSubscriptionTopic{keybase1.PathSubscriptionTopic_STAT}).Do(func(
		clientID SubscriptionManagerClientID, subscriptionIDs []SubscriptionID,
		path string, topics []keybase1.PathSubscriptionTopic,
	) {
		done3()
	})
	err = config.KBFSOps().Write(ctx, fileNode, []byte("hello"), 0)
	require.NoError(t, err)
	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Logf("Waiting for last notification (done3) before finishing the test.")
	waiter3()
}

func TestSubscriptionManagerFavoritesChange(t *testing.T) {
	config, sm, notifier, finish := initSubscriptionManagerTest(t)
	defer finish()
	ctx := context.Background()

	waiter1, done1 := waitForCall(t, 4*time.Second)

	sid1 := SubscriptionID("sid1")
	err := sm.SubscribeNonPath(ctx, sid1, keybase1.SubscriptionTopic_FAVORITES, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnNonPathChange(
		testSubscriptionManagerClientID,
		[]SubscriptionID{sid1}, keybase1.SubscriptionTopic_FAVORITES).Do(
		func(
			clientID SubscriptionManagerClientID, subscriptionIDs []SubscriptionID,
			topic keybase1.SubscriptionTopic,
		) {
			done1()
		})
	err = config.KBFSOps().AddFavorite(ctx,
		favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		favorites.Data{},
	)
	require.NoError(t, err)

	t.Logf("Waiting for last notification (done1) before finishing the test.")
	waiter1()
}

func TestSubscriptionManagerSubscribePathNoFolderBranch(t *testing.T) {
	config, sm, notifier, finish := initSubscriptionManagerTest(t)
	defer finish()

	ctx := t.Context()
	ctx, err := libcontext.NewContextWithCancellationDelayer(
		libcontext.NewContextReplayable(
			ctx, func(c context.Context) context.Context {
				return ctx
			}))
	require.NoError(t, err)

	waiter0, done0 := waitForCall(t, 4*time.Second)

	t.Logf("Subscribe to CHILDREN at TLF root using sid1, before we have a folderBranch. Then create a file. We should get a notification.")
	sid1 := SubscriptionID("sid1")

	err = sm.SubscribePath(ctx, sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(testSubscriptionManagerClientID,
		[]SubscriptionID{sid1}, "/keybase/private/jdoe",
		[]keybase1.PathSubscriptionTopic{keybase1.PathSubscriptionTopic_CHILDREN}).AnyTimes().Do(
		func(
			clientID SubscriptionManagerClientID, subscriptionIDs []SubscriptionID,
			path string, topics []keybase1.PathSubscriptionTopic,
		) {
			done0()
		})

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	_, _, err = config.KBFSOps().CreateFile(
		ctx, rootNode, rootNode.ChildName("file"), false, NoExcl)
	require.NoError(t, err)
	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	waiter0()
}

// gatedRootNodeOps holds a found root node until release is closed, standing
// in for a folder whose head lock is held by an in-progress write. Lookups
// that find nothing pass straight through.
type gatedRootNodeOps struct {
	KBFSOps
	enteredOnce sync.Once
	entered     chan struct{}
	release     chan struct{}
}

func (o *gatedRootNodeOps) GetRootNode(
	ctx context.Context, h *tlfhandle.Handle, branch data.BranchName) (
	Node, data.EntryInfo, error,
) {
	node, ei, err := o.KBFSOps.GetRootNode(ctx, h, branch)
	if node == nil {
		return node, ei, err
	}
	o.enteredOnce.Do(func() { close(o.entered) })
	<-o.release
	return node, ei, err
}

// gatedObserver blocks in BatchChanges once armed, holding the folder's
// observer-list lock the way a notification in progress does.
type gatedObserver struct {
	entered chan struct{}
	release chan struct{}
}

func (o *gatedObserver) LocalChange(context.Context, Node, WriteRange) {}
func (o *gatedObserver) BatchChanges(context.Context, []NodeChange, []NodeID) {
	close(o.entered)
	<-o.release
}
func (o *gatedObserver) TlfHandleChange(context.Context, *tlfhandle.Handle) {}

func recvWithin[T any](t *testing.T, ch <-chan T, what string) T {
	select {
	case v := <-ch:
		return v
	case <-time.After(5 * time.Second):
		require.FailNow(t, what+" timed out")
	}
	var zero T
	return zero
}

func runWithin(t *testing.T, timeout time.Duration, what string, f func()) {
	done := make(chan struct{})
	go func() {
		f()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(timeout):
		require.FailNow(t, what+" deadlocked")
	}
}

func TestSubscriptionManagerNotifyDuringSubscribeLookup(t *testing.T) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	_, _, err = config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)

	realOps := config.KBFSOps()
	gated := &gatedRootNodeOps{
		KBFSOps: realOps,
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	config.(*ConfigLocal).SetKBFSOps(gated)
	defer config.(*ConfigLocal).SetKBFSOps(realOps)

	subscribed := make(chan error, 1)
	go func() {
		subscribed <- sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
			keybase1.PathSubscriptionTopic_CHILDREN, nil)
	}()
	recvWithin(t, gated.entered, "root node lookup")

	// The folder can't finish the lookup until its own change notification
	// returns, so that notification must not wait on the subscribe.
	runWithin(t, 5*time.Second, "change notification", func() {
		sm.BatchChanges(ctx, nil, nil)
	})
	close(gated.release)
	require.NoError(t, recvWithin(t, subscribed, "subscribe"))
}

// testStopDuringSubscribeLookup stops a subscription while SubscribePath is
// still looking up its folderBranch, and checks it leaves nothing behind.
func testStopDuringSubscribeLookup(
	t *testing.T, stop func(context.Context, *subscriptionManager),
) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	fb := rootNode.GetFolderBranch()
	fbo := config.KBFSOps().(*KBFSOpsStandard).getOpsNoAdd(ctx, fb)

	realOps := config.KBFSOps()
	gated := &gatedRootNodeOps{
		KBFSOps: realOps,
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	config.(*ConfigLocal).SetKBFSOps(gated)

	subscribed := make(chan error, 1)
	go func() {
		subscribed <- sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
			keybase1.PathSubscriptionTopic_CHILDREN, nil)
	}()
	recvWithin(t, gated.entered, "root node lookup")
	stopped := make(chan struct{})
	go func() {
		stop(ctx, sm)
		close(stopped)
	}()
	close(gated.release)
	require.NoError(t, recvWithin(t, subscribed, "subscribe"))
	recvWithin(t, stopped, "stop")
	config.(*ConfigLocal).SetKBFSOps(realOps)

	sm.lock.RLock()
	refs := len(sm.pathSubscriptionIDToRef)
	sids := len(sm.subscriptionIDs)
	count := sm.subscriptionCountByFolderBranch[fb]
	sm.lock.RUnlock()
	require.Zero(t, refs)
	require.Zero(t, sids)
	require.Zero(t, count)
	require.False(t, smRegisteredOn(fbo, sm))

	err = sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
}

func TestSubscriptionManagerUnsubscribeDuringSubscribeLookup(t *testing.T) {
	testStopDuringSubscribeLookup(t,
		func(ctx context.Context, sm *subscriptionManager) {
			sm.Unsubscribe(ctx, "sid1")
		})
}

func TestSubscriptionManagerShutdownDuringSubscribeLookup(t *testing.T) {
	testStopDuringSubscribeLookup(t,
		func(ctx context.Context, sm *subscriptionManager) {
			sm.Shutdown(ctx)
		})
}

func TestSubscriptionManagerUnsubscribeDuringNotification(t *testing.T) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	fb := rootNode.GetFolderBranch()
	fbo := config.KBFSOps().(*KBFSOpsStandard).getOpsNoAdd(ctx, fb)

	obs := &gatedObserver{
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	require.NoError(t, fbo.RegisterForChanges(obs))
	err = sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)

	notified := make(chan struct{})
	go func() {
		fbo.observers.batchChanges(ctx, nil, nil)
		close(notified)
	}()
	recvWithin(t, obs.entered, "notification")

	unsubscribed := make(chan struct{})
	go func() {
		sm.Unsubscribe(ctx, "sid1")
		close(unsubscribed)
	}()
	// Wait for the unsubscribe to queue on the folder's observer lock: a
	// waiting writer makes TryRLock fail.
	runWithin(t, 5*time.Second, "unsubscribe reaching the folder", func() {
		for fbo.observers.lock.TryRLock() {
			fbo.observers.lock.RUnlock()
			time.Sleep(time.Millisecond)
		}
	})
	close(obs.release)

	runWithin(t, 5*time.Second, "notification and unsubscribe", func() {
		<-notified
		<-unsubscribed
	})
	require.NoError(t, fbo.UnregisterFromChanges(obs))
	require.False(t, smRegisteredOn(fbo, sm))
}

func TestSubscriptionManagerUnregistersAfterLastSubscription(t *testing.T) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	fbo := config.KBFSOps().(*KBFSOpsStandard).getOpsNoAdd(
		ctx, rootNode.GetFolderBranch())
	registered := func() bool { return smRegisteredOn(fbo, sm) }

	for _, sid := range []SubscriptionID{"sid1", "sid2"} {
		err = sm.SubscribePath(ctx, sid, "/keybase/private/jdoe",
			keybase1.PathSubscriptionTopic_CHILDREN, nil)
		require.NoError(t, err)
	}
	require.True(t, registered())
	sm.Unsubscribe(ctx, "sid1")
	require.True(t, registered())
	sm.Unsubscribe(ctx, "sid2")
	require.False(t, registered())
}

func smRegisteredOn(fbo *folderBranchOps, sm *subscriptionManager) bool {
	fbo.observers.lock.RLock()
	defer fbo.observers.lock.RUnlock()
	for _, o := range fbo.observers.observers {
		if o == Observer(sm) {
			return true
		}
	}
	return false
}

func testStopDuringPoll(t *testing.T, stop func(context.Context, *subscriptionManager)) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	// Installed first, so the first lookup that finds the root is gated.
	realOps := config.KBFSOps()
	gated := &gatedRootNodeOps{
		KBFSOps: realOps,
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	config.(*ConfigLocal).SetKBFSOps(gated)
	defer config.(*ConfigLocal).SetKBFSOps(realOps)

	// No root node yet, so this leaves a poller waiting for one.
	err := sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	err = sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT, nil)
	require.Error(t, err, "a polling sid is still in use")

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := realOps.GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	fbo := realOps.(*KBFSOpsStandard).getOpsNoAdd(
		ctx, rootNode.GetFolderBranch())

	// The poller is now looking up the root it will find.
	recvWithin(t, gated.entered, "poller lookup")
	stop(ctx, sm)
	sm.lock.RLock()
	pollers := len(sm.folderBranchPollerCancelers)
	sm.lock.RUnlock()
	require.Zero(t, pollers, "the poller is cancelled")
	close(gated.release)

	// The mock notifier fails the test on any OnPathChange.
	require.Never(t, func() bool {
		sm.lock.RLock()
		refs := len(sm.pathSubscriptionIDToRef)
		sm.lock.RUnlock()
		return refs != 0 || smRegisteredOn(fbo, sm)
	}, 300*time.Millisecond, 10*time.Millisecond)
}

func TestSubscriptionManagerUnsubscribeDuringPoll(t *testing.T) {
	testStopDuringPoll(t, func(ctx context.Context, sm *subscriptionManager) {
		sm.Unsubscribe(ctx, "sid1")
	})
}

func TestSubscriptionManagerShutdownDuringPoll(t *testing.T) {
	testStopDuringPoll(t, func(ctx context.Context, sm *subscriptionManager) {
		sm.Shutdown(ctx)
	})
}

// The client may be slow to take a notification; that mustn't hold up
// subscribing and unsubscribing.
func TestSubscriptionManagerSlowPollNotification(t *testing.T) {
	config, smi, notifier, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	entered := make(chan struct{})
	release := make(chan struct{})
	notifier.EXPECT().OnPathChange(testSubscriptionManagerClientID,
		[]SubscriptionID{"sid1"}, "/keybase/private/jdoe", gomock.Any()).
		Do(func(SubscriptionManagerClientID, []SubscriptionID, string,
			[]keybase1.PathSubscriptionTopic,
		) {
			close(entered)
			<-release
		})

	// No root node yet, so this leaves a poller waiting for one.
	err := sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	_, _, err = config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	recvWithin(t, entered, "poll notification")

	runWithin(t, 5*time.Second, "subscribe and unsubscribe", func() {
		err := sm.SubscribePath(ctx, "sid2", "/keybase/private/jdoe",
			keybase1.PathSubscriptionTopic_STAT, nil)
		require.NoError(t, err)
		sm.Unsubscribe(ctx, "sid2")
	})
	close(release)
}

func TestSubscriptionManagerDuplicateRefusedBeforeLookup(t *testing.T) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	_, _, err = config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	err = sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)

	// A lookup would block here until released.
	realOps := config.KBFSOps()
	gated := &gatedRootNodeOps{
		KBFSOps: realOps,
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	config.(*ConfigLocal).SetKBFSOps(gated)
	defer config.(*ConfigLocal).SetKBFSOps(realOps)
	runWithin(t, 5*time.Second, "duplicate subscribe", func() {
		err = sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
			keybase1.PathSubscriptionTopic_STAT, nil)
	})
	require.Error(t, err)
}

// failingRegisterNotifier fails the first RegisterForChanges.
type failingRegisterNotifier struct {
	Notifier
	failed bool
}

func (n *failingRegisterNotifier) RegisterForChanges(
	fbs []data.FolderBranch, obs Observer,
) error {
	if !n.failed {
		n.failed = true
		return errors.New("register failed")
	}
	return n.Notifier.RegisterForChanges(fbs, obs)
}

func smPathSubscriptionCount(sm *subscriptionManager) int {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	return len(sm.pathSubscriptionIDToRef) + len(sm.subscriptionIDs) +
		len(sm.subscriptionCountByFolderBranch)
}

func TestSubscriptionManagerRegisterFailureRollsBack(t *testing.T) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	fbo := config.KBFSOps().(*KBFSOpsStandard).getOpsNoAdd(
		ctx, rootNode.GetFolderBranch())
	realNotifier := config.Notifier()
	config.(*ConfigLocal).SetNotifier(
		&failingRegisterNotifier{Notifier: realNotifier})
	defer config.(*ConfigLocal).SetNotifier(realNotifier)

	err = sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.Error(t, err)
	require.Zero(t, smPathSubscriptionCount(sm))
	require.False(t, smRegisteredOn(fbo, sm))

	err = sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	require.True(t, smRegisteredOn(fbo, sm))
}

func TestSubscriptionManagerPollRegisterFailureRollsBack(t *testing.T) {
	config, smi, _, finish := initSubscriptionManagerTest(t)
	defer finish()
	sm := smi.(*subscriptionManager)
	ctx := t.Context()

	realNotifier := config.Notifier()
	config.(*ConfigLocal).SetNotifier(
		&failingRegisterNotifier{Notifier: realNotifier})
	defer config.(*ConfigLocal).SetNotifier(realNotifier)

	// No root node yet, so this leaves a poller waiting for one.
	err := sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)
	fbo := config.KBFSOps().(*KBFSOpsStandard).getOpsNoAdd(
		ctx, rootNode.GetFolderBranch())

	require.Eventually(t, func() bool {
		sm.lock.RLock()
		defer sm.lock.RUnlock()
		return len(sm.folderBranchPollerCancelers) == 0
	}, 5*time.Second, 10*time.Millisecond)
	// The mock notifier fails the test on any OnPathChange.
	sm.subscribeLock.Lock()
	n := smPathSubscriptionCount(sm)
	sm.subscribeLock.Unlock()
	require.Zero(t, n)
	require.False(t, smRegisteredOn(fbo, sm))
}
