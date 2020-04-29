// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	gomock "github.com/golang/mock/gomock"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/favorites"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/tlf"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func waitForCall(t *testing.T, timeout time.Duration) (
	waiter func(), done func(args ...interface{})) {
	ch := make(chan struct{})
	return func() {
			select {
			case <-time.After(timeout):
				t.Fatalf("waiting on lastMockDone timeout")
			case <-ch:
			}
		}, func(args ...interface{}) {
			ch <- struct{}{}
		}
}

const testSubscriptionManagerClientID SubscriptionManagerClientID = "test"

func initSubscriptionManagerTest(t *testing.T) (config Config,
	sm SubscriptionManager, notifier *MockSubscriptionNotifier,
	finish func()) {
	ctl := gomock.NewController(t)
	config = MakeTestConfigOrBust(t, "jdoe")
	notifier = NewMockSubscriptionNotifier(ctl)
	sm = config.SubscriptionManager(
		testSubscriptionManagerClientID, false, notifier)
	return config, sm, notifier, func() {
		err := config.Shutdown(context.Background())
		require.NoError(t, err)
		ctl.Finish()
	}
}

type sliceMatcherNoOrder struct {
	x interface{}
}

func (e sliceMatcherNoOrder) Matches(x interface{}) bool {
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

	ctx, cancelFn := context.WithCancel(context.Background())
	defer cancelFn()
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
		}}).Do(func(args ...interface{}) { done0(args...); done1(args...) })
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
		[]keybase1.PathSubscriptionTopic{keybase1.PathSubscriptionTopic_STAT}).Do(done2)
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
		[]keybase1.PathSubscriptionTopic{keybase1.PathSubscriptionTopic_STAT}).Do(done3)
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
		[]SubscriptionID{sid1}, keybase1.SubscriptionTopic_FAVORITES).Do(done1)
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

	ctx, cancelFn := context.WithCancel(context.Background())
	defer cancelFn()
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
		[]keybase1.PathSubscriptionTopic{keybase1.PathSubscriptionTopic_CHILDREN}).AnyTimes().Do(done0)

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
