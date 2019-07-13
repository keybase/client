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

func delayedFinish(ctl *gomock.Controller, timeout time.Duration) (
	finish func(), done func(args ...interface{})) {
	ch := make(chan struct{})
	return func() {
			select {
			case <-time.After(timeout):
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
	finish, lastMockDone = delayedFinish(ctl, time.Second)
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

	sid1, err := subscriber.SubscribePath(ctx, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN)
	config.KBFSOps().CreateDir(ctx, rootNode, rootNode.ChildName("dir"))

	sid2, err := subscriber.SubscribePath(ctx, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT, nil)
	require.NoError(t, err)
	notifier.EXPECT().OnPathChange(sid2, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT)
	notifier.EXPECT().OnPathChange(sid1, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_CHILDREN)
	config.KBFSOps().CreateDir(ctx, rootNode, rootNode.ChildName("dir2"))

	subscriber.Unsubscribe(ctx, sid1)
	notifier.EXPECT().OnPathChange(sid2, "/keybase/private/jdoe",
		keybase1.PathSubscriptionTopic_STAT).Do(lastMockDone)
	config.KBFSOps().CreateDir(ctx, rootNode, rootNode.ChildName("dir3"))
}

func TestSubscriptionManagerFavoritesChange(t *testing.T) {
	config, subscriber, notifier, finish, lastMockDone := initSubscriptionMagagerTest(t)
	defer finish()
	ctx := context.Background()

	sid, err := subscriber.SubscribeNonPath(ctx, keybase1.SubscriptionTopic_FAVORITES, nil)
	notifier.EXPECT().OnChange(
		sid, keybase1.SubscriptionTopic_FAVORITES).Do(lastMockDone)
	err = config.KBFSOps().AddFavorite(ctx,
		favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		favorites.Data{},
	)
	require.NoError(t, err)
}
