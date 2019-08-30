// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"path"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"golang.org/x/time/rate"
)

// userPath is always the full path including the /keybase prefix, but may
// not be canonical or cleaned. The goal is to track whatever the user of this
// type is dealing with without needing them to know if a path is canonicalized
// at any time.
// Examples:
//   "/keybase/public/karlthefog@twitter/dir
//   "/keybase/team/keybase/dir/../file"
type userPath string

// cleanInTlfPath is clean path rooted at a TLF, and it's what we get
// from Node.GetPathPlaintextSansTlf().
// Examples, considering TLF /keybase/private/user1,user2:
//   "/foo/bar" (representing /keybase/private/user1,user2/foo/bar)
//   "/"        (representing /keybase/private/user1,user2)
type cleanInTlfPath string

func getCleanInTlfPath(p *parsedPath) cleanInTlfPath {
	return cleanInTlfPath(path.Clean(p.rawInTlfPath))
}

func getParentPath(p cleanInTlfPath) (parent cleanInTlfPath, ok bool) {
	lastSlashIndex := strings.LastIndex(string(p), "/")
	if lastSlashIndex <= 0 {
		return "", false
	}
	return p[:lastSlashIndex], true
}

type debouncedNotify struct {
	notify   func()
	shutdown func()
}

func getChSender(ch chan<- struct{}, blocking bool) func() {
	if blocking {
		return func() {
			ch <- struct{}{}
		}
	}
	return func() {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

func debounce(do func(), limit rate.Limit) debouncedNotify {
	ctx, shutdown := context.WithCancel(context.Background())
	ch := make(chan struct{}, 1)
	limiter := rate.NewLimiter(limit, 1)
	go func() {
		for {
			err := limiter.Wait(ctx)
			if err != nil {
				return
			}
			select {
			case <-ch:
				go do()
			case <-ctx.Done():
				return
			}
		}
	}()
	return debouncedNotify{
		notify:   getChSender(ch, limit == rate.Inf),
		shutdown: shutdown,
	}
}

type pathSubscriptionRef struct {
	folderBranch data.FolderBranch
	path         cleanInTlfPath
}

// subscriptionManager manages subscriptions. There are two types of
// subscriptions: path and non-path. Path subscriptions are for changes related
// to a specific path, such as file content change, dir children change, and
// timestamp change. Non-path subscriptions are for general changes that are
// not specific to a path, such as journal flushing, online status change, etc.
// We store a debouncedNotify struct for each subscription, which includes a
// notify function that might be debounced if caller asked so.
type subscriptionManager struct {
	config Config

	shutdownOnlineStatusWatcher func()
	lock                        sync.RWMutex
	// TODO HOTPOT-416: add another layer here to reference by topics, and
	// actually check topics in LocalChange and BatchChanges.
	pathSubscriptions               map[pathSubscriptionRef]map[SubscriptionID]debouncedNotify
	pathSubscriptionIDToRef         map[SubscriptionID]pathSubscriptionRef
	nonPathSubscriptions            map[keybase1.SubscriptionTopic]map[SubscriptionID]debouncedNotify
	nonPathSubscriptionIDToTopic    map[SubscriptionID]keybase1.SubscriptionTopic
	subscriptionIDs                 map[SubscriptionID]bool
	subscriptionCountByFolderBranch map[data.FolderBranch]int
}

type subscriber struct {
	sm       *subscriptionManager
	notifier SubscriptionNotifier
}

func (sm *subscriptionManager) notifyOnlineStatus() {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	if sm.nonPathSubscriptions[keybase1.SubscriptionTopic_ONLINE_STATUS] == nil {
		return
	}
	for _, notifier := range sm.nonPathSubscriptions[keybase1.SubscriptionTopic_ONLINE_STATUS] {
		notifier.notify()
	}
}

func (sm *subscriptionManager) watchOnlineStatus() func() {
	ctx, shutdown := context.WithCancel(context.Background())
	go func() {
		for sm.config.KBFSOps() == nil {
			time.Sleep(100 * time.Millisecond)
		}
		for {
			_, invalidateChan := sm.config.KBFSOps().StatusOfServices()
			select {
			case <-invalidateChan:
				sm.notifyOnlineStatus()
			case <-ctx.Done():
				return
			}
		}
	}()
	return shutdown
}

func newSubscriptionManager(config Config) (SubscriptionManager, SubscriptionManagerPublisher) {
	sm := &subscriptionManager{
		pathSubscriptions:               make(map[pathSubscriptionRef]map[SubscriptionID]debouncedNotify),
		pathSubscriptionIDToRef:         make(map[SubscriptionID]pathSubscriptionRef),
		nonPathSubscriptions:            make(map[keybase1.SubscriptionTopic]map[SubscriptionID]debouncedNotify),
		nonPathSubscriptionIDToTopic:    make(map[SubscriptionID]keybase1.SubscriptionTopic),
		config:                          config,
		subscriptionIDs:                 make(map[SubscriptionID]bool),
		subscriptionCountByFolderBranch: make(map[data.FolderBranch]int),
	}
	sm.shutdownOnlineStatusWatcher = sm.watchOnlineStatus()
	return sm, sm
}

func (sm *subscriptionManager) Shutdown(ctx context.Context) {
	sm.shutdownOnlineStatusWatcher()
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

func (sm *subscriptionManager) checkSubscriptionIDLocked(sid SubscriptionID) (setter func(), err error) {
	if sm.subscriptionIDs[sid] {
		return nil, errors.Errorf("duplicate subscription ID %q", sid)
	}
	return func() {
		sm.subscriptionIDs[sid] = true
	}, nil
}

func (sm *subscriptionManager) registerForChangesLocked(fb data.FolderBranch) {
	if sm.subscriptionCountByFolderBranch[fb] == 0 {
		_ = sm.config.Notifier().RegisterForChanges(
			[]data.FolderBranch{fb}, sm)
	}
	sm.subscriptionCountByFolderBranch[fb]++
}

func (sm *subscriptionManager) unregisterForChangesLocked(fb data.FolderBranch) {
	if sm.subscriptionCountByFolderBranch[fb] == 1 {
		_ = sm.config.Notifier().UnregisterFromChanges(
			[]data.FolderBranch{fb}, sm)
		delete(sm.subscriptionCountByFolderBranch, fb)
		return
	}
	sm.subscriptionCountByFolderBranch[fb]--
}

func (sm *subscriptionManager) subscribePath(ctx context.Context,
	sid SubscriptionID, path string, topic keybase1.PathSubscriptionTopic,
	deduplicateInterval *time.Duration, notifier SubscriptionNotifier) error {
	parsedPath, err := parsePath(userPath(path))
	if err != nil {
		return err
	}
	fb, err := parsedPath.getFolderBranch(ctx, sm.config)
	if err != nil {
		return err
	}
	if fb == (data.FolderBranch{}) {
		// ignore non-existent TLF.
		// TODO: deal with this case HOTPOTP-501
		return nil
	}
	nitp := getCleanInTlfPath(parsedPath)

	ref := pathSubscriptionRef{
		folderBranch: fb,
		path:         nitp,
	}

	sm.lock.Lock()
	defer sm.lock.Unlock()
	subscriptionIDSetter, err := sm.checkSubscriptionIDLocked(sid)
	if err != nil {
		return err
	}
	sm.registerForChangesLocked(ref.folderBranch)
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
	subscriptionIDSetter()
	return nil
}

func (sm *subscriptionManager) subscribeNonPath(
	ctx context.Context, sid SubscriptionID, topic keybase1.SubscriptionTopic,
	deduplicateInterval *time.Duration, notifier SubscriptionNotifier) error {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	subscriptionIDSetter, err := sm.checkSubscriptionIDLocked(sid)
	if err != nil {
		return err
	}
	if sm.nonPathSubscriptions[topic] == nil {
		sm.nonPathSubscriptions[topic] = make(map[SubscriptionID]debouncedNotify)
	}
	limit := rate.Inf
	if deduplicateInterval != nil {
		limit = rate.Every(*deduplicateInterval)
	}
	sm.nonPathSubscriptions[topic][sid] = debounce(func() {
		notifier.OnNonPathChange(sid, topic)
	}, limit)
	sm.nonPathSubscriptionIDToTopic[sid] = topic
	subscriptionIDSetter()
	return nil
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
		delete(sm.pathSubscriptions[ref], subscriptionID)
	}
	if len(sm.pathSubscriptions[ref]) == 0 {
		sm.unregisterForChangesLocked(ref.folderBranch)
		delete(sm.pathSubscriptions, ref)
	}
	delete(sm.subscriptionIDs, subscriptionID)
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
		delete(sm.nonPathSubscriptions[topic], subscriptionID)
	}
	// We are not deleting empty topics here because there are very few topics
	// here, and they very likely need to be used soon, so I figured I'd just
	// leave it there. The path subscriptions are different as they are
	// referenced by path.

	delete(sm.subscriptionIDs, subscriptionID)
}

func (sm *subscriptionManager) notifyRef(ref pathSubscriptionRef) {
	if sm.pathSubscriptions[ref] == nil {
		return
	}
	for _, notifier := range sm.pathSubscriptions[ref] {
		// We are notify()-ing while holding a lock, but it's fine since the
		// other side of the channel consumes it pretty fast, either by
		// dropping deduplicated ones, or by doing the actual send in a
		// separate goroutine.
		notifier.notify()
	}
}

func (sm *subscriptionManager) nodeChangeLocked(node Node) {
	path, ok := node.GetPathPlaintextSansTlf()
	if !ok {
		return
	}
	cleanPath := cleanInTlfPath(path)

	sm.notifyRef(pathSubscriptionRef{
		folderBranch: node.GetFolderBranch(),
		path:         cleanPath,
	})

	// Do this for parent as well, so if "children" is subscribed on parent
	// path, we'd trigger a notification too.
	if parent, ok := getParentPath(cleanPath); ok {
		sm.notifyRef(pathSubscriptionRef{
			folderBranch: node.GetFolderBranch(),
			path:         parent,
		})
	}
}

// SubscribePath implements the Subscriber interface.
func (s subscriber) SubscribePath(ctx context.Context, sid SubscriptionID,
	path string, topic keybase1.PathSubscriptionTopic,
	deduplicateInterval *time.Duration) error {
	return s.sm.subscribePath(ctx,
		sid, path, topic, deduplicateInterval, s.notifier)
}

// SubscribeNonPath implements the Subscriber interface.
func (s subscriber) SubscribeNonPath(ctx context.Context, sid SubscriptionID,
	topic keybase1.SubscriptionTopic,
	deduplicateInterval *time.Duration) error {
	return s.sm.subscribeNonPath(ctx,
		sid, topic, deduplicateInterval, s.notifier)
}

// Unsubscribe implements the Subscriber interface.
func (s subscriber) Unsubscribe(ctx context.Context, sid SubscriptionID) {
	s.sm.unsubscribePath(ctx, sid)
	s.sm.unsubscribeNonPath(ctx, sid)
}

var _ SubscriptionManagerPublisher = (*subscriptionManager)(nil)

// FavoritesChanged implements the SubscriptionManagerPublisher interface.
func (sm *subscriptionManager) FavoritesChanged() {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	if sm.nonPathSubscriptions[keybase1.SubscriptionTopic_FAVORITES] == nil {
		return
	}
	for _, notifier := range sm.nonPathSubscriptions[keybase1.SubscriptionTopic_FAVORITES] {
		notifier.notify()
	}
}

// JournalStatusChanged implements the SubscriptionManagerPublisher interface.
func (sm *subscriptionManager) JournalStatusChanged() {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
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
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	// TODO HOTPOT-416: check topics
	sm.nodeChangeLocked(node)
}

// BatchChanges implements the Observer interface.
func (sm *subscriptionManager) BatchChanges(ctx context.Context,
	changes []NodeChange, allAffectedNodeIDs []NodeID) {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	// TODO HOTPOT-416: check topics
	for _, change := range changes {
		sm.nodeChangeLocked(change.Node)
	}
}

// TlfHandleChange implements the Observer interface.
func (sm *subscriptionManager) TlfHandleChange(ctx context.Context,
	newHandle *tlfhandle.Handle) {
}
