package libkbfs

import (
	"strconv"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"golang.org/x/time/rate"
)

// SubscriptionID identifies a subscription.
type SubscriptionID string

// SubscriptionNotifier defines a group of methods for notifying about changes
// on subscribed topics.
type SubscriptionNotifier interface {
	OnPathChange(subscriptionID SubscriptionID, path string, topic keybase1.PathSubscriptionTopic)
	OnChange(subscriptionID SubscriptionID, topic keybase1.SubscriptionTopic)
}

// Subscriber defines a type that can be used to subscribe to different topic.
type Subscriber interface {
	SubscribePath(
		ctx context.Context, path string, topic keybase1.PathSubscriptionTopic,
		deduplicateInterval *time.Duration) (SubscriptionID, error)
	SubscribeNonPath(ctx context.Context, topic keybase1.SubscriptionTopic,
		deduplicateInterval *time.Duration) (SubscriptionID, error)
	Unsubscribe(context.Context, SubscriptionID)
}

// SubscriptionManager manages subscriptions. Use the Subscriber interface to
// subscribe and unsubscribe. Multiple subscribers can be used with the same
// SubscriptionManager.
type SubscriptionManager interface {
	Subscriber(SubscriptionNotifier) Subscriber
	Shutdown(ctx context.Context)
}

// SubscriptionManagerPublisher associates with one SubscriptionManager, and is
// used to publish changes to subscribers mangaged by it.
type SubscriptionManagerPublisher interface {
	FavoritesChanged()
	JournalStatusChanged()
}

// userPath is always the full path including the /keybase prefix, but may
// not be canonical or normalized. For examplef, it can be
// . The goal is to track
// whatever the user of this type is dealing with without needing them to
// know if a path is canonicalized at any time.
// Examples:
//   "/keybase/public/karlthefog@twitter/dir
//   "/keybase/team/keybase/dir/../file"
type userPath string

// normalizedInTlfPath is normalized path rooted at a TLF, and it's what we get
// from Node.GetPathPlaintextSansTlf().
// Examples, considering TLF /keybase/private/user1,user2:
//   "/foo/bar" (representing /keybsae/private/user1,user2/foo/bar)
//   "/"        (representing /keybsae/private/user1,user2)
type normalizedInTlfPath string

type debouncedNotify struct {
	notify   func()
	shutdown func()
}

func debounce(do func(), limit rate.Limit) debouncedNotify {
	ctx, shutdown := context.WithCancel(context.Background())
	ch := make(chan struct{})
	limiter := rate.NewLimiter(limit, 1)
	go func() {
		for {
			limiter.Wait(ctx)
			select {
			case <-ch:
				go do()
			case <-ctx.Done():
				return
			}
		}
	}()
	return debouncedNotify{
		notify: func() {
			select {
			case ch <- struct{}{}:
			default:
			}
		},
		shutdown: shutdown,
	}
}

type pathSubscriptionRef struct {
	folderBranch data.FolderBranch
	path         normalizedInTlfPath
}

type subscriptionManager struct {
	config Config

	lock                         sync.RWMutex
	pathSubscriptions            map[pathSubscriptionRef]map[SubscriptionID]debouncedNotify
	pathSubscriptionIDToRef      map[SubscriptionID]pathSubscriptionRef
	nonPathSubscriptions         map[keybase1.SubscriptionTopic]map[SubscriptionID]debouncedNotify
	nonPathSubscriptionIDToTopic map[SubscriptionID]keybase1.SubscriptionTopic
}

type subscriber struct {
	sm       *subscriptionManager
	notifier SubscriptionNotifier
}

func newSubscriptionManager(config Config) (SubscriptionManager, SubscriptionManagerPublisher) {
	sm := &subscriptionManager{
		pathSubscriptions:            make(map[pathSubscriptionRef]map[SubscriptionID]debouncedNotify),
		pathSubscriptionIDToRef:      make(map[SubscriptionID]pathSubscriptionRef),
		nonPathSubscriptions:         make(map[keybase1.SubscriptionTopic]map[SubscriptionID]debouncedNotify),
		nonPathSubscriptionIDToTopic: make(map[SubscriptionID]keybase1.SubscriptionTopic),
		config:                       config,
	}
	return sm, sm
}

func (sm *subscriptionManager) Shutdown(ctx context.Context) {
	pathSids := make([]SubscriptionID, 0, len(sm.pathSubscriptionIDToRef))
	nonPathSids := make([]SubscriptionID, 0, len(sm.nonPathSubscriptionIDToTopic))
	for sid := range sm.pathSubscriptionIDToRef {
		pathSids = append(pathSids, sid)
	}
	for sid := range sm.nonPathSubscriptionIDToTopic {
		nonPathSids = append(nonPathSids, sid)
	}
	for _, sid := range pathSids {
		sm.unsubscribePath(ctx, sid)
	}
	for _, sid := range nonPathSids {
		sm.unsubscribeNonPath(ctx, sid)
	}
}

func (sm *subscriptionManager) Subscriber(notifier SubscriptionNotifier) Subscriber {
	return subscriber{sm: sm, notifier: notifier}
}

func makeSubscriptionID() SubscriptionID {
	return SubscriptionID(strconv.FormatInt(time.Now().UnixNano(), 16))
}

func (sm *subscriptionManager) subscribePath(ctx context.Context,
	path string, topic keybase1.PathSubscriptionTopic,
	deduplicateInterval *time.Duration, notifier SubscriptionNotifier) (SubscriptionID, error) {
	parsedPath, err := parsePath(userPath(path))
	if err != nil {
		return "", err
	}
	fb, err := parsedPath.getFolderBranch(ctx, sm.config)
	if err != nil {
		return "", err
	}
	nitp := parsedPath.getNormalizedInTlfPath()
	sid := makeSubscriptionID()

	ref := pathSubscriptionRef{
		folderBranch: fb,
		path:         nitp,
	}

	sm.lock.Lock()
	defer sm.lock.Unlock()
	sm.config.Notifier().RegisterForChanges(
		[]data.FolderBranch{ref.folderBranch}, sm)
	if sm.pathSubscriptions[ref] == nil {
		sm.pathSubscriptions[ref] = make(map[SubscriptionID]debouncedNotify)
	}
	limit := rate.Inf
	if deduplicateInterval != nil {
		limit = rate.Every(*deduplicateInterval)
	}
	sm.pathSubscriptions[ref][sid] = debounce(func() {
		notifier.OnPathChange(sid, path, topic)
	}, limit)
	sm.pathSubscriptionIDToRef[sid] = ref
	return sid, nil
}

func (sm *subscriptionManager) subscribeNonPath(ctx context.Context,
	topic keybase1.SubscriptionTopic, deduplicateInterval *time.Duration,
	notifier SubscriptionNotifier) (SubscriptionID, error) {
	sid := makeSubscriptionID()

	sm.lock.Lock()
	defer sm.lock.Unlock()
	if sm.nonPathSubscriptions[topic] == nil {
		sm.nonPathSubscriptions[topic] = make(map[SubscriptionID]debouncedNotify)
	}
	limit := rate.Inf
	if deduplicateInterval != nil {
		limit = rate.Every(*deduplicateInterval)
	}
	sm.nonPathSubscriptions[topic][sid] = debounce(func() {
		notifier.OnChange(sid, topic)
	}, limit)
	sm.nonPathSubscriptionIDToTopic[sid] = topic
	return sid, nil
}

func (sm *subscriptionManager) unsubscribePath(
	ctx context.Context, subscriptionID SubscriptionID) {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	ref, ok := sm.pathSubscriptionIDToRef[subscriptionID]
	if !ok {
		return
	}
	delete(sm.pathSubscriptionIDToRef, subscriptionID)
	if (sm.pathSubscriptions[ref]) == nil {
		return
	}
	if notifier, ok := sm.pathSubscriptions[ref][subscriptionID]; ok {
		notifier.shutdown()
	}
	delete(sm.pathSubscriptions[ref], subscriptionID)
	if len(sm.pathSubscriptions[ref]) == 0 {
		sm.config.Notifier().UnregisterFromChanges(
			[]data.FolderBranch{ref.folderBranch}, sm)
		delete(sm.pathSubscriptions, ref)
	}
}
func (sm *subscriptionManager) unsubscribeNonPath(
	ctx context.Context, subscriptionID SubscriptionID) {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	topic, ok := sm.nonPathSubscriptionIDToTopic[subscriptionID]
	if !ok {
		return
	}
	delete(sm.nonPathSubscriptionIDToTopic, subscriptionID)
	if sm.nonPathSubscriptions[topic] == nil {
		return
	}
	if notifier, ok := sm.nonPathSubscriptions[topic][subscriptionID]; ok {
		notifier.shutdown()
	}
	delete(sm.nonPathSubscriptions[topic], subscriptionID)
}

func (sm *subscriptionManager) nodeChange(node Node) {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	path, ok := node.GetPathPlaintextSansTlf()
	if !ok {
		return
	}
	ref := pathSubscriptionRef{
		folderBranch: node.GetFolderBranch(),
		path:         normalizedInTlfPath(path),
	}
	if sm.pathSubscriptions[ref] == nil {
		return
	}
	for _, notifier := range sm.pathSubscriptions[ref] {
		notifier.notify()
	}
}

// SubscribePath implements the Subscriber interface.
func (s subscriber) SubscribePath(
	ctx context.Context, path string, topic keybase1.PathSubscriptionTopic,
	deduplicateInterval *time.Duration) (SubscriptionID, error) {
	return s.sm.subscribePath(ctx, path, topic, deduplicateInterval, s.notifier)
}

// SubscribeNonPath implements the Subscriber interface.
func (s subscriber) SubscribeNonPath(ctx context.Context, topic keybase1.SubscriptionTopic,
	deduplicateInterval *time.Duration) (SubscriptionID, error) {
	return s.sm.subscribeNonPath(ctx, topic, deduplicateInterval, s.notifier)
}

// Unsubscribe implements the Subscriber interface.
func (s subscriber) Unsubscribe(ctx context.Context, sid SubscriptionID) {
	s.sm.unsubscribePath(ctx, sid)
	s.sm.unsubscribeNonPath(ctx, sid)
}

var _ SubscriptionManagerPublisher = (*subscriptionManager)(nil)

// FavoritesChanged implements the SubscriptionManagerPublisher interface.
func (sm *subscriptionManager) FavoritesChanged() {
	if sm.nonPathSubscriptions[keybase1.SubscriptionTopic_FAVORITES] == nil {
		return
	}
	for _, notifier := range sm.nonPathSubscriptions[keybase1.SubscriptionTopic_FAVORITES] {
		notifier.notify()
	}
}

// JournalStatusChanged implements the SubscriptionManagerPublisher interface.
func (sm *subscriptionManager) JournalStatusChanged() {
	if sm.nonPathSubscriptions[keybase1.SubscriptionTopic_JOURNAL_STATUS] == nil {
		return
	}
	for _, notifier := range sm.nonPathSubscriptions[keybase1.SubscriptionTopic_JOURNAL_STATUS] {
		notifier.notify()
	}
}

var _ Observer = (*subscriptionManager)(nil)

// LocalChange implements the Observer interface.
func (sm *subscriptionManager) LocalChange(ctx context.Context,
	node Node, write WriteRange) {
	sm.nodeChange(node)
}

// BatchChanges implements the Observer interface.
func (sm *subscriptionManager) BatchChanges(ctx context.Context,
	changes []NodeChange, allAffectedNodeIDs []NodeID) {
	for _, change := range changes {
		sm.nodeChange(change.Node)
	}
}

// TlfHandleChange implements the Observer interface.
func (sm *subscriptionManager) TlfHandleChange(ctx context.Context,
	newHandle *tlfhandle.Handle) {
}
