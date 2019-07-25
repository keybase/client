// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	gomock "github.com/golang/mock/gomock"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/favorites"
	"github.com/keybase/client/go/kbfs/tlf"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func delayedFinish(t *testing.T, ctl *gomock.Controller, timeout time.Duration) (
	finish func(), done func(args ...interface{})) {
	ch := make(chan struct{})
	return func() {
			select {
			case <-time.After(timeout):
				t.Fatalf("waiting on lastMockDone timeout")
			case <-ch:
			}
			ctl.Finish()
		}, func(args ...interface{}) {
			ch <- struct{}{}
		}
}

func initSubscriptionMagagerTest(t *testing.T) (config Config,
	subscriber Subscriber, notifier *MockSubscriptionNotifier,
	finish func(), lastMockDone func(args ...interface{})) {
	ctl := gomock.NewController(t)
	finish, lastMockDone = delayedFinish(t, ctl, time.Second)
	config = MakeTestConfigOrBust(t, "jdoe")
	notifier = NewMockSubscriptionNotifier(ctl)
	subscriber = config.SubscriptionManager().Subscriber(notifier)
	return config, subscriber, notifier, finish, lastMockDone
}

func TestSubscriptionManagerSubscribePath(t *testing.T) {
	config, subscriber, notifier, finish, lastMockDone := initSubscriptionMagagerTest(t)
	defer finish()
	ctx := context.Background()

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	require.NoError(t, err)

	sid1, sid2 := SubscriptionID("sid1"), SubscriptionID("sid2")

	t.Logf("Subscribe to CHILDREN at TLF root using sid1, and create a file. We should get a notification.")
	err = subscriber.SubscribePath(ctx, sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN)
	fileNode, _, err := config.KBFSOps().CreateFile(ctx, rootNode, rootNode.ChildName("file"), false, NoExcl)
	require.NoError(t, err)

	t.Logf("Try to subscribe using sid1 again, and it should fail")
	err = subscriber.SubscribePath(ctx, sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT, nil)
	require.Error(t, err)

	t.Logf("Subscribe to STAT at TLF root using sid2, and create a dir. We should get a notification for STAT, and a notificiation for CHILDREN.")
	err = subscriber.SubscribePath(ctx, sid2, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN)
	notifier.EXPECT().OnPathChange(sid2, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT)
	config.KBFSOps().CreateDir(ctx, rootNode, rootNode.ChildName("dir1"))

	t.Logf("Unsubscribe sid1, and make another dir. We should only get a notification for STAT.")
	subscriber.Unsubscribe(ctx, sid1)
	notifier.EXPECT().OnPathChange(sid2, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT)
	config.KBFSOps().CreateDir(ctx, rootNode, rootNode.ChildName("dir2"))

	t.Logf("Unsubscribe sid2 as well. Then subscribe to STAT on the file using sid1 (which we unsubscribed earlier), and write to it. We should get STAT notification.")
	subscriber.Unsubscribe(ctx, sid2)
	err = subscriber.SubscribePath(ctx, sid1, "/keybase/private/jdoe/dir1/../file", keybase1.PathSubscriptionTopic_STAT, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(sid1, "/keybase/private/jdoe/dir1/../file",
		keybase1.PathSubscriptionTopic_STAT).Do(lastMockDone)
	config.KBFSOps().Write(ctx, fileNode, []byte("hello"), 0)
}

func TestSubscriptionManagerFavoritesChange(t *testing.T) {
	config, subscriber, notifier, finish, lastMockDone := initSubscriptionMagagerTest(t)
	defer finish()
	ctx := context.Background()

	sid1 := SubscriptionID("sid1")
	err := subscriber.SubscribeNonPath(ctx, sid1, keybase1.SubscriptionTopic_FAVORITES, nil)
	notifier.EXPECT().OnNonPathChange(
		sid1, keybase1.SubscriptionTopic_FAVORITES).Do(lastMockDone)
	err = config.KBFSOps().AddFavorite(ctx,
		favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		favorites.Data{},
	)
	require.NoError(t, err)
}
