// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/time/rate"
)

const (
	folderBranchPollingInterval           = time.Second
	maxPurgeableSubscriptionManagerClient = 3
)

// userPath is always the full path including the /keybase prefix, but may
// not be canonical or cleaned. The goal is to track whatever the user of this
// type is dealing with without needing them to know if a path is canonicalized
// at any time.
// Examples:
//
//	"/keybase/public/karlthefog@twitter/dir
//	"/keybase/team/keybase/dir/../file"
type userPath string

// cleanInTlfPath is clean path rooted at a TLF, and it's what we get
// from Node.GetPathPlaintextSansTlf().
// Examples, considering TLF /keybase/private/user1,user2:
//
//	"/foo/bar" (representing /keybase/private/user1,user2/foo/bar)
//	"/"        (representing /keybase/private/user1,user2)
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

func debounce(do func(), limit rate.Limit) *debouncedNotify {
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
	return &debouncedNotify{
		notify:   getChSender(ch, limit == rate.Inf),
		shutdown: shutdown,
	}
}

type pathSubscriptionRef struct {
	folderBranch data.FolderBranch
	path         cleanInTlfPath
}

type pathSubscription struct {
	subscriptionIDs map[SubscriptionID]keybase1.PathSubscriptionTopic
	// Keep track of different paths from input since GUI doesn't have a
	// concept of "cleaned path" yet and when we notify about changes we need
	// to use the original path that came in with the SubscribePath calls.
	pathsToNotify   map[string]struct{}
	limit           rate.Limit
	debouncedNotify *debouncedNotify
}

type nonPathSubscription struct {
	subscriptionIDs map[SubscriptionID]bool
	limit           rate.Limit
	debouncedNotify *debouncedNotify
}

// subscriptionManager manages subscriptions. There are two types of
// subscriptions: path and non-path. Path subscriptions are for changes related
// to a specific path, such as file content change, dir children change, and
// timestamp change. Non-path subscriptions are for general changes that are
// not specific to a path, such as journal flushing, online status change, etc.
// We store a debouncedNotify struct for each subscription, which includes a
// notify function that might be debounced if caller asked so.
//
// This is per client. For example, if we have multiple GUI instances, each of
// them get their own client ID and their subscriptions won't affect each
// other.
//
// lock is never held while calling into a folder: folders call back into the
// subscription manager (LocalChange, BatchChanges) while holding their own
// locks.
type subscriptionManager struct {
	clientID SubscriptionManagerClientID
	config   Config
	log      logger.Logger
	notifier SubscriptionNotifier

	onlineStatusTracker *onlineStatusTracker
	lock                sync.RWMutex
	// TODO HOTPOT-416: add another layer here to reference by topics, and
	// actually check topics in LocalChange and BatchChanges.
	pathSubscriptions               map[pathSubscriptionRef]*pathSubscription
	pathSubscriptionIDToRef         map[SubscriptionID]pathSubscriptionRef
	nonPathSubscriptions            map[keybase1.SubscriptionTopic]*nonPathSubscription
	nonPathSubscriptionIDToTopic    map[SubscriptionID]keybase1.SubscriptionTopic
	subscriptionIDs                 map[SubscriptionID]bool
	subscriptionCountByFolderBranch map[data.FolderBranch]int
	// Path subscriptions still looking up, or polling for, their
	// folderBranch, keyed to the SubscribePath call that reserved them. Only
	// that call (or its poller) completes the subscription, and only while
	// it still holds the entry; Unsubscribe and Shutdown drop it.
	pendingPathSubscriptions map[SubscriptionID]*subscribePathRequest
	shutDown                 bool

	// registrationLock serializes syncRegistration, and guards registered.
	registrationLock sync.Mutex
	registered       map[data.FolderBranch]bool
}

func (sm *subscriptionManager) notifyOnlineStatus() {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	if sm.nonPathSubscriptions[keybase1.SubscriptionTopic_ONLINE_STATUS] == nil {
		return
	}
	if nps, ok := sm.nonPathSubscriptions[keybase1.SubscriptionTopic_ONLINE_STATUS]; ok {
		nps.debouncedNotify.notify()
	}
}

func newSubscriptionManager(clientID SubscriptionManagerClientID, config Config, notifier SubscriptionNotifier) *subscriptionManager {
	sm := &subscriptionManager{
		pathSubscriptions:               make(map[pathSubscriptionRef]*pathSubscription),
		pathSubscriptionIDToRef:         make(map[SubscriptionID]pathSubscriptionRef),
		nonPathSubscriptions:            make(map[keybase1.SubscriptionTopic]*nonPathSubscription),
		nonPathSubscriptionIDToTopic:    make(map[SubscriptionID]keybase1.SubscriptionTopic),
		clientID:                        clientID,
		config:                          config,
		log:                             config.MakeLogger("SubMan"),
		notifier:                        notifier,
		subscriptionIDs:                 make(map[SubscriptionID]bool),
		subscriptionCountByFolderBranch: make(map[data.FolderBranch]int),
		pendingPathSubscriptions:        make(map[SubscriptionID]*subscribePathRequest),
		registered:                      make(map[data.FolderBranch]bool),
	}
	sm.onlineStatusTracker = newOnlineStatusTracker(config, sm.notifyOnlineStatus)
	return sm
}

func (sm *subscriptionManager) Shutdown(ctx context.Context) {
	sm.onlineStatusTracker.shutdown()
	fbs := sm.shutdownSubscriptions(ctx)
	for _, fb := range fbs {
		sm.syncRegistration(fb)
	}
}

func (sm *subscriptionManager) shutdownSubscriptions(
	ctx context.Context,
) (fbs []data.FolderBranch) {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	pathSids := make([]SubscriptionID, 0, len(sm.pathSubscriptionIDToRef))
	nonPathSids := make([]SubscriptionID, 0, len(sm.nonPathSubscriptionIDToTopic))
	for sid := range sm.pathSubscriptionIDToRef {
		pathSids = append(pathSids, sid)
	}
	for sid := range sm.nonPathSubscriptionIDToTopic {
		nonPathSids = append(nonPathSids, sid)
	}
	for _, sid := range pathSids {
		if fb, ok := sm.unsubscribePathLocked(ctx, sid); ok {
			fbs = append(fbs, fb)
		}
	}
	for _, sid := range nonPathSids {
		sm.unsubscribeNonPathLocked(ctx, sid)
	}
	for sid := range sm.pendingPathSubscriptions {
		_ = sm.dropPendingLocked(sid)
	}
	sm.shutDown = true
	return fbs
}

func (sm *subscriptionManager) OnlineStatusTracker() OnlineStatusTracker {
	return sm.onlineStatusTracker
}

func (sm *subscriptionManager) checkSubscriptionIDLocked(sid SubscriptionID) (setter func(), err error) {
	if sm.shutDown {
		return nil, errors.New("subscription manager is shut down")
	}
	if sm.subscriptionIDs[sid] || sm.pendingPathSubscriptions[sid] != nil {
		return nil, errors.Errorf("duplicate subscription ID %q", sid)
	}
	return func() {
		sm.subscriptionIDs[sid] = true
	}, nil
}

// syncRegistration registers for, or unregisters from, fb's changes to match
// whether fb has any subscriptions. Call it without holding lock, after every
// change to fb's subscription count; the last call sees the final count.
func (sm *subscriptionManager) syncRegistration(fb data.FolderBranch) {
	sm.registrationLock.Lock()
	defer sm.registrationLock.Unlock()
	sm.lock.RLock()
	want := sm.subscriptionCountByFolderBranch[fb] > 0
	sm.lock.RUnlock()
	if want == sm.registered[fb] {
		return
	}
	if want {
		_ = sm.config.Notifier().RegisterForChanges(
			[]data.FolderBranch{fb}, sm)
		sm.registered[fb] = true
		return
	}
	_ = sm.config.Notifier().UnregisterFromChanges(
		[]data.FolderBranch{fb}, sm)
	delete(sm.registered, fb)
}

func (sm *subscriptionManager) preparePathNotification(
	ref pathSubscriptionRef) (sids []SubscriptionID,
	paths []string, topics []keybase1.PathSubscriptionTopic,
) {
	sm.lock.RLock()
	defer sm.lock.RUnlock()

	ps, ok := sm.pathSubscriptions[ref]
	if !ok {
		return
	}
	sids = make([]SubscriptionID, 0, len(ps.subscriptionIDs))
	topicsMap := make(map[keybase1.PathSubscriptionTopic]struct{})
	for sid, topic := range ps.subscriptionIDs {
		sids = append(sids, sid)
		topicsMap[topic] = struct{}{}
	}
	topics = make([]keybase1.PathSubscriptionTopic, 0, len(topicsMap))
	for topic := range topicsMap {
		topics = append(topics, topic)
	}
	paths = make([]string, 0, len(ps.pathsToNotify))
	for path := range ps.pathsToNotify {
		paths = append(paths, path)
	}
	return sids, paths, topics
}

func (sm *subscriptionManager) makePathSubscriptionDebouncedNotify(
	ref pathSubscriptionRef, limit rate.Limit,
) *debouncedNotify {
	return debounce(func() {
		sids, paths, topics := sm.preparePathNotification(ref)

		for _, path := range paths {
			sm.notifier.OnPathChange(sm.clientID, sids, path, topics)
		}
	}, limit)
}

func (sm *subscriptionManager) prepareNonPathNotification(
	topic keybase1.SubscriptionTopic,
) (sids []SubscriptionID) {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	nps, ok := sm.nonPathSubscriptions[topic]
	if !ok {
		return
	}
	sids = make([]SubscriptionID, 0, len(nps.subscriptionIDs))
	for sid := range nps.subscriptionIDs {
		sids = append(sids, sid)
	}
	return sids
}

func (sm *subscriptionManager) makeNonPathSubscriptionDebouncedNotify(
	topic keybase1.SubscriptionTopic, limit rate.Limit,
) *debouncedNotify {
	return debounce(func() {
		sids := sm.prepareNonPathNotification(topic)
		sm.notifier.OnNonPathChange(sm.clientID, sids, topic)
	}, limit)
}

type subscribePathRequest struct {
	sid                 SubscriptionID
	path                string // original, uncleaned path from GUI
	topic               keybase1.PathSubscriptionTopic
	deduplicateInterval *time.Duration
	// Set while a poller waits for the folderBranch.
	cancelPoll context.CancelFunc
}

func (sm *subscriptionManager) subscribePathWithFolderBranchLocked(
	req subscribePathRequest,
	parsedPath *parsedPath, fb data.FolderBranch,
) error {
	nitp := getCleanInTlfPath(parsedPath)
	ref := pathSubscriptionRef{
		folderBranch: fb,
		path:         nitp,
	}

	subscriptionIDSetter, err := sm.checkSubscriptionIDLocked(req.sid)
	if err != nil {
		return err
	}
	sm.subscriptionCountByFolderBranch[ref.folderBranch]++

	limit := rate.Inf
	if req.deduplicateInterval != nil {
		limit = rate.Every(*req.deduplicateInterval)
	}
	ps, ok := sm.pathSubscriptions[ref]
	if !ok {
		ps = &pathSubscription{
			subscriptionIDs: make(map[SubscriptionID]keybase1.PathSubscriptionTopic),
			limit:           limit,
			debouncedNotify: sm.makePathSubscriptionDebouncedNotify(ref, limit),
			pathsToNotify:   make(map[string]struct{}),
		}
		sm.pathSubscriptions[ref] = ps
	} else if ps.limit < limit {
		// New limit is higher than what we have. Update it to match.
		ps.limit = limit
		ps.debouncedNotify.shutdown()
		ps.debouncedNotify = sm.makePathSubscriptionDebouncedNotify(ref, limit)
	}
	ps.subscriptionIDs[req.sid] = req.topic
	ps.pathsToNotify[req.path] = struct{}{}

	sm.pathSubscriptionIDToRef[req.sid] = ref
	subscriptionIDSetter()
	return nil
}

func (sm *subscriptionManager) releasePendingLocked(req *subscribePathRequest) {
	if req.cancelPoll != nil {
		req.cancelPoll()
	}
	delete(sm.pendingPathSubscriptions, req.sid)
}

// takePendingLocked releases req's reservation if req still holds it.
func (sm *subscriptionManager) takePendingLocked(
	req *subscribePathRequest,
) (held bool) {
	if sm.pendingPathSubscriptions[req.sid] != req {
		return false
	}
	sm.releasePendingLocked(req)
	return true
}

func (sm *subscriptionManager) dropPendingLocked(
	sid SubscriptionID,
) (dropped bool) {
	req, ok := sm.pendingPathSubscriptions[sid]
	if !ok {
		return false
	}
	sm.releasePendingLocked(req)
	return true
}

func (sm *subscriptionManager) pollOnFolderBranchForSubscribePathRequest(
	ctx context.Context, req *subscribePathRequest, parsedPath *parsedPath,
) {
	ticker := time.NewTicker(folderBranchPollingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			fb, err := parsedPath.getFolderBranch(ctx, sm.config)
			if err != nil {
				sm.lock.Lock()
				_ = sm.takePendingLocked(req)
				sm.lock.Unlock()
				return
			}

			if fb == (data.FolderBranch{}) {
				continue
			}

			// We have a folderBranch now! Go ahead and complete the
			// subscription, and send a notification too.
			if !sm.completePolledSubscription(ctx, req, parsedPath, fb) {
				return
			}
			sm.syncRegistration(fb)
			sm.notifier.OnPathChange(
				sm.clientID, []SubscriptionID{req.sid},
				req.path, []keybase1.PathSubscriptionTopic{req.topic})
			return
		case <-ctx.Done():
			// Cancelled by whoever released the reservation.
			return
		}
	}
}

func (sm *subscriptionManager) completePolledSubscription(
	ctx context.Context, req *subscribePathRequest, parsedPath *parsedPath,
	fb data.FolderBranch,
) (subscribed bool) {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	if !sm.takePendingLocked(req) {
		return false
	}
	err := sm.subscribePathWithFolderBranchLocked(*req, parsedPath, fb)
	if err != nil {
		sm.log.CErrorf(ctx,
			"subscribePathWithFolderBranchLocked sid=%s err=%v", req.sid, err)
		return false
	}
	return true
}

// SubscribePath implements the SubscriptionManager interface.
func (sm *subscriptionManager) SubscribePath(ctx context.Context,
	sid SubscriptionID, path string, topic keybase1.PathSubscriptionTopic,
	deduplicateInterval *time.Duration,
) error {
	parsedPath, err := parsePath(userPath(path))
	if err != nil {
		return err
	}

	req := &subscribePathRequest{
		sid:                 sid,
		path:                path,
		topic:               topic,
		deduplicateInterval: deduplicateInterval,
	}
	if err := sm.reservePathSubscription(req); err != nil {
		return err
	}
	// Looked up without lock: the folder may be holding its own locks while
	// it waits on lock to deliver a change.
	fb, err := parsedPath.getFolderBranch(ctx, sm.config)
	err = sm.finishPathSubscription(req, parsedPath, fb, err)
	if err == nil && fb != (data.FolderBranch{}) {
		sm.syncRegistration(fb)
	}
	return err
}

func (sm *subscriptionManager) reservePathSubscription(
	req *subscribePathRequest,
) error {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	if _, err := sm.checkSubscriptionIDLocked(req.sid); err != nil {
		return err
	}
	sm.pendingPathSubscriptions[req.sid] = req
	return nil
}

func (sm *subscriptionManager) finishPathSubscription(
	req *subscribePathRequest, parsedPath *parsedPath,
	fb data.FolderBranch, lookupErr error,
) error {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	if sm.pendingPathSubscriptions[req.sid] != req {
		// Unsubscribed, or shut down, during the lookup.
		return nil
	}
	if lookupErr != nil {
		sm.releasePendingLocked(req)
		return lookupErr
	}
	if fb != (data.FolderBranch{}) {
		sm.releasePendingLocked(req)
		return sm.subscribePathWithFolderBranchLocked(*req, parsedPath, fb)
	}
	// No folderBranch yet: keep the reservation and poll for it.
	ctx, cancel := context.WithCancel(context.Background())
	req.cancelPoll = cancel
	go sm.pollOnFolderBranchForSubscribePathRequest(ctx, req, parsedPath)
	return nil
}

// SubscribeNonPath implements the SubscriptionManager interface.
func (sm *subscriptionManager) SubscribeNonPath(
	ctx context.Context, sid SubscriptionID, topic keybase1.SubscriptionTopic,
	deduplicateInterval *time.Duration,
) error {
	sm.lock.Lock()
	defer sm.lock.Unlock()
	subscriptionIDSetter, err := sm.checkSubscriptionIDLocked(sid)
	if err != nil {
		return err
	}

	limit := rate.Inf
	if deduplicateInterval != nil {
		limit = rate.Every(*deduplicateInterval)
	}
	nps, ok := sm.nonPathSubscriptions[topic]
	if !ok {
		nps = &nonPathSubscription{
			subscriptionIDs: make(map[SubscriptionID]bool),
			limit:           limit,
			debouncedNotify: sm.makeNonPathSubscriptionDebouncedNotify(topic, limit),
		}
		sm.nonPathSubscriptions[topic] = nps
	} else if nps.limit < limit {
		// New limit is higher than what we have. Update it to match.
		nps.limit = limit
		nps.debouncedNotify.shutdown()
		nps.debouncedNotify = sm.makeNonPathSubscriptionDebouncedNotify(topic, limit)
	}
	nps.subscriptionIDs[sid] = true

	sm.nonPathSubscriptionIDToTopic[sid] = topic
	subscriptionIDSetter()
	return nil
}

// unsubscribePathLocked returns the folderBranch whose subscription count it
// lowered, if any; the caller must syncRegistration it after unlocking.
func (sm *subscriptionManager) unsubscribePathLocked(
	ctx context.Context, subscriptionID SubscriptionID,
) (fb data.FolderBranch, countChanged bool) {
	// First check if this is a subscription we don't yet have a folderBranch
	// for.
	if sm.dropPendingLocked(subscriptionID) {
		return data.FolderBranch{}, false
	}

	ref, ok := sm.pathSubscriptionIDToRef[subscriptionID]
	if !ok {
		return data.FolderBranch{}, false
	}
	delete(sm.pathSubscriptionIDToRef, subscriptionID)

	ps, ok := sm.pathSubscriptions[ref]
	if !ok {
		return data.FolderBranch{}, false
	}
	delete(ps.subscriptionIDs, subscriptionID)
	if len(ps.subscriptionIDs) == 0 {
		ps.debouncedNotify.shutdown()
		delete(sm.pathSubscriptions, ref)
	}
	fb = ref.folderBranch
	if sm.subscriptionCountByFolderBranch[fb] <= 1 {
		delete(sm.subscriptionCountByFolderBranch, fb)
	} else {
		sm.subscriptionCountByFolderBranch[fb]--
	}

	delete(sm.subscriptionIDs, subscriptionID)
	return fb, true
}

func (sm *subscriptionManager) unsubscribeNonPathLocked(
	ctx context.Context, subscriptionID SubscriptionID,
) {
	topic, ok := sm.nonPathSubscriptionIDToTopic[subscriptionID]
	if !ok {
		return
	}
	delete(sm.nonPathSubscriptionIDToTopic, subscriptionID)

	nps, ok := sm.nonPathSubscriptions[topic]
	if !ok {
		return
	}
	delete(nps.subscriptionIDs, subscriptionID)
	if len(nps.subscriptionIDs) == 0 {
		nps.debouncedNotify.shutdown()
		delete(sm.nonPathSubscriptions, topic)
	}

	delete(sm.subscriptionIDs, subscriptionID)
}

// Unsubscribe implements the SubscriptionManager interface.
func (sm *subscriptionManager) Unsubscribe(ctx context.Context, sid SubscriptionID) {
	sm.lock.Lock()
	fb, countChanged := sm.unsubscribePathLocked(ctx, sid)
	sm.unsubscribeNonPathLocked(ctx, sid)
	sm.lock.Unlock()
	if countChanged {
		sm.syncRegistration(fb)
	}
}

func (sm *subscriptionManager) notifyRefLocked(ref pathSubscriptionRef) {
	ps, ok := sm.pathSubscriptions[ref]
	if !ok {
		return
	}
	// We are notify()-ing while holding a lock, but it's fine since the
	// other side of the channel consumes it pretty fast, either by
	// dropping deduplicated ones, or by doing the actual send in a
	// separate goroutine.
	//
	// We are not differentiating topics here yet. TODO: do it.
	ps.debouncedNotify.notify()
}

func (sm *subscriptionManager) nodeChangeLocked(node Node) {
	path, ok := node.GetPathPlaintextSansTlf()
	if !ok {
		return
	}
	cleanPath := cleanInTlfPath(path)

	sm.notifyRefLocked(pathSubscriptionRef{
		folderBranch: node.GetFolderBranch(),
		path:         cleanPath,
	})

	// Do this for parent as well, so if "children" is subscribed on parent
	// path, we'd trigger a notification too.
	if parent, ok := getParentPath(cleanPath); ok {
		sm.notifyRefLocked(pathSubscriptionRef{
			folderBranch: node.GetFolderBranch(),
			path:         parent,
		})
	}
}

var _ SubscriptionManagerPublisher = (*subscriptionManager)(nil)

// PublishChange implements the SubscriptionManagerPublisher interface.
func (sm *subscriptionManager) PublishChange(topic keybase1.SubscriptionTopic) {
	sm.lock.RLock()
	defer sm.lock.RUnlock()

	// When sync status changes, trigger notification for all paths so they
	// reload to get new prefetch status. This is unfortunate but it's
	// non-trivial to actually build notification around individuall path's
	// prefetch status. Since GUI doesnt' have that many path notifications,
	// this should be fine.
	//
	// TODO: Build it.
	if topic == keybase1.SubscriptionTopic_OVERALL_SYNC_STATUS {
		for _, ps := range sm.pathSubscriptions {
			ps.debouncedNotify.notify()
		}
	}

	if nps, ok := sm.nonPathSubscriptions[topic]; ok {
		nps.debouncedNotify.notify()
	}
}

var _ Observer = (*subscriptionManager)(nil)

// LocalChange implements the Observer interface.
func (sm *subscriptionManager) LocalChange(ctx context.Context,
	node Node, write WriteRange,
) {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	// TODO HOTPOT-416: check topics
	sm.nodeChangeLocked(node)
}

// BatchChanges implements the Observer interface.
func (sm *subscriptionManager) BatchChanges(ctx context.Context,
	changes []NodeChange, allAffectedNodeIDs []NodeID,
) {
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

type subscriptionManagerManager struct {
	lock                   sync.RWMutex
	config                 Config
	subscriptionManagers   map[SubscriptionManagerClientID]*subscriptionManager
	purgeableClientIDsFIFO []SubscriptionManagerClientID
}

func newSubscriptionManagerManager(config Config) *subscriptionManagerManager {
	return &subscriptionManagerManager{
		config:                 config,
		subscriptionManagers:   make(map[SubscriptionManagerClientID]*subscriptionManager),
		purgeableClientIDsFIFO: nil,
	}
}

// Shutdown, like the purge in get, shuts managers down after releasing lock:
// a manager's Shutdown calls into folders, which may be waiting on lock in
// PublishChange.
func (smm *subscriptionManagerManager) Shutdown(ctx context.Context) {
	smm.lock.Lock()
	toShutdown := smm.subscriptionManagers
	smm.subscriptionManagers = make(map[SubscriptionManagerClientID]*subscriptionManager)
	smm.purgeableClientIDsFIFO = nil
	smm.lock.Unlock()

	for _, sm := range toShutdown {
		sm.Shutdown(ctx)
	}
}

func (smm *subscriptionManagerManager) get(
	clientID SubscriptionManagerClientID, purgeable bool,
	notifier SubscriptionNotifier,
) *subscriptionManager {
	smm.lock.RLock()
	sm, ok := smm.subscriptionManagers[clientID]
	smm.lock.RUnlock()

	if ok {
		return sm
	}

	var toPurge *subscriptionManager
	defer func() {
		if toPurge != nil {
			toPurge.Shutdown(context.Background())
		}
	}()
	smm.lock.Lock()
	defer smm.lock.Unlock()

	// Check again under the lock in case we've already created one. This is
	// important since if we create it twice we'd end up with having the same
	// clientID appearing twice in purgeableClientIDsFIFO and when we purge the
	// second one we'd have a panic.
	sm, ok = smm.subscriptionManagers[clientID]
	if ok {
		return sm
	}

	if purgeable {
		if len(smm.purgeableClientIDsFIFO) == maxPurgeableSubscriptionManagerClient {
			purgeID := smm.purgeableClientIDsFIFO[0]
			toPurge = smm.subscriptionManagers[purgeID]
			delete(smm.subscriptionManagers, purgeID)
			smm.purgeableClientIDsFIFO = smm.purgeableClientIDsFIFO[1:]
		}
		smm.purgeableClientIDsFIFO = append(smm.purgeableClientIDsFIFO, clientID)
	}

	sm = newSubscriptionManager(clientID, smm.config, notifier)
	smm.subscriptionManagers[clientID] = sm

	return sm
}

// PublishChange implements the SubscriptionManagerPublisher interface.
func (smm *subscriptionManagerManager) PublishChange(topic keybase1.SubscriptionTopic) {
	smm.lock.RLock()
	defer smm.lock.RUnlock()
	for _, sm := range smm.subscriptionManagers {
		sm.PublishChange(topic)
	}
}
