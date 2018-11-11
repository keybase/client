package chat

import (
	"encoding/hex"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
)

type Syncer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	isConnected bool
	offlinables []types.Offlinable

	notificationLock  sync.Mutex
	lastLoadedLock    sync.Mutex
	clock             clockwork.Clock
	sendDelay         time.Duration
	shutdownCh        chan struct{}
	fullReloadCh      chan gregor1.UID
	flushCh           chan struct{}
	notificationQueue map[string][]chat1.ConversationStaleUpdate
	fullReload        map[string]bool
	lastLoadedConv    chat1.ConversationID
}

func NewSyncer(g *globals.Context) *Syncer {
	s := &Syncer{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g.GetLog(), "Syncer", false),
		isConnected:       false,
		clock:             clockwork.NewRealClock(),
		shutdownCh:        make(chan struct{}),
		fullReloadCh:      make(chan gregor1.UID),
		flushCh:           make(chan struct{}),
		notificationQueue: make(map[string][]chat1.ConversationStaleUpdate),
		fullReload:        make(map[string]bool),
		sendDelay:         time.Millisecond * 1000,
	}

	go s.sendNotificationLoop()
	go s.monitorAppState()
	return s
}

func (s *Syncer) SetClock(clock clockwork.Clock) {
	s.clock = clock
}

func (s *Syncer) Shutdown() {
	s.Debug(context.Background(), "shutting down")
	close(s.shutdownCh)
}

func (s *Syncer) monitorAppState() {
	ctx := context.Background()
	s.Debug(ctx, "monitorAppState: starting up")
	state := keybase1.AppState_FOREGROUND
	for {
		state = <-s.G().AppState.NextUpdate(&state)
		switch state {
		case keybase1.AppState_FOREGROUND:
			s.Debug(ctx, "monitorAppState: foregrounded, flushing")
			s.flushCh <- struct{}{}
		}
	}
}

func (s *Syncer) dedupUpdates(updates []chat1.ConversationStaleUpdate) (res []chat1.ConversationStaleUpdate) {
	m := make(map[string]chat1.ConversationStaleUpdate)
	for _, update := range updates {
		if existing, ok := m[update.ConvID.String()]; ok {
			switch existing.UpdateType {
			case chat1.StaleUpdateType_CLEAR:
				// do nothing, existing is already clearing
			case chat1.StaleUpdateType_NEWACTIVITY:
				m[update.ConvID.String()] = update
			}
		} else {
			m[update.ConvID.String()] = update
		}
	}
	for _, update := range m {
		res = append(res, update)
	}
	return res
}

func (s *Syncer) sendNotificationsOnce() {
	s.notificationLock.Lock()
	defer s.notificationLock.Unlock()

	state := s.G().AppState.State()
	// Only actually flush notifications if the state of the app is in the foreground. In the desktop
	// app this is always true, but on the mobile app this might not be.
	if state == keybase1.AppState_FOREGROUND {
		// Broadcast full reloads
		for uid := range s.fullReload {
			s.Debug(context.Background(), "flushing full reload: uid: %s", uid)
			b, _ := hex.DecodeString(uid)
			s.G().ActivityNotifier.InboxStale(context.Background(), gregor1.UID(b))
		}
		s.fullReload = make(map[string]bool)

		// Broadcast conversation stales
		for uid, updates := range s.notificationQueue {
			updates = s.dedupUpdates(updates)
			b, _ := hex.DecodeString(uid)
			s.Debug(context.Background(), "flushing notifications: uid: %s len: %d", uid, len(updates))
			for _, update := range updates {
				s.Debug(context.Background(), "flushing: uid: %s convID: %s type: %v", uid,
					update.ConvID, update.UpdateType)
			}
			s.G().ActivityNotifier.ThreadsStale(context.Background(), gregor1.UID(b), updates)
		}
		s.notificationQueue = make(map[string][]chat1.ConversationStaleUpdate)
	}
}

func (s *Syncer) sendNotificationLoop() {
	s.Debug(context.Background(), "starting notification loop")
	for {
		select {
		case <-s.shutdownCh:
			return
		case uid := <-s.fullReloadCh:
			s.notificationLock.Lock()
			s.fullReload[uid.String()] = true
			delete(s.notificationQueue, uid.String())
			s.notificationLock.Unlock()
			s.sendNotificationsOnce()
		case <-s.clock.After(s.sendDelay):
			s.sendNotificationsOnce()
		case <-s.flushCh:
			s.sendNotificationsOnce()
		}
	}
}

func (s *Syncer) getUpdates(convs []chat1.Conversation) (res []chat1.ConversationStaleUpdate) {
	for _, conv := range convs {
		res = append(res, chat1.ConversationStaleUpdate{
			ConvID:     conv.GetConvID(),
			UpdateType: chat1.StaleUpdateType_NEWACTIVITY,
		})
	}
	return res
}

func (s *Syncer) SendChatStaleNotifications(ctx context.Context, uid gregor1.UID,
	updates []chat1.ConversationStaleUpdate, immediate bool) {
	if len(updates) == 0 {
		s.Debug(ctx, "sending inbox stale message")
		s.fullReloadCh <- uid
	} else {
		s.Debug(ctx, "sending thread stale messages: len: %d", len(updates))
		for _, update := range updates {
			s.Debug(ctx, "sending thread stale message: convID: %s type: %v", update.ConvID,
				update.UpdateType)
		}
		s.notificationLock.Lock()
		if !s.fullReload[uid.String()] {
			s.notificationQueue[uid.String()] = append(s.notificationQueue[uid.String()], updates...)
		}
		s.notificationLock.Unlock()
		if immediate {
			s.flushCh <- struct{}{}
		}
	}
}

func (s *Syncer) isServerInboxClear(ctx context.Context, inbox *storage.Inbox, srvVers int) bool {
	if _, err := s.G().ServerCacheVersions.MatchInbox(ctx, srvVers); err != nil {
		s.Debug(ctx, "isServerInboxClear: inbox server version match error: %s", err.Error())
		return true
	}

	return false
}

func (s *Syncer) IsConnected(ctx context.Context) bool {
	s.Lock()
	defer s.Unlock()
	return s.isConnected
}

func (s *Syncer) Connected(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) (err error) {
	ctx = CtxAddLogTags(ctx, s.G().GetEnv())
	s.Lock()
	defer s.Unlock()
	defer s.Trace(ctx, func() error { return err }, "Connected")()

	s.isConnected = true

	// Let the Offlinables know that we are back online
	for _, o := range s.offlinables {
		o.Connected(ctx)
	}

	// Run sync against the server
	s.sync(ctx, cli, uid, syncRes)

	return nil
}

func (s *Syncer) Disconnected(ctx context.Context) {
	s.Lock()
	defer s.Unlock()
	defer s.Trace(ctx, func() error { return nil }, "Disconnected")()

	s.isConnected = false

	// Let the Offlinables know of connection state change
	for _, o := range s.offlinables {
		o.Disconnected(ctx)
	}
}

func (s *Syncer) Sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) (err error) {
	s.Lock()
	defer s.Unlock()
	defer s.Trace(ctx, func() error { return err }, "Sync")()
	return s.sync(ctx, cli, uid, syncRes)
}

func (s *Syncer) shouldDoFullReloadFromIncremental(ctx context.Context, syncRes storage.InboxSyncRes,
	convs []chat1.Conversation) bool {
	if syncRes.TeamTypeChanged {
		s.Debug(ctx, "shouldDoFullReloadFromIncremental: team type changed")
		return true
	}
	for _, conv := range convs {
		switch conv.Metadata.Existence {
		case chat1.ConversationExistence_ACTIVE:
		default:
			s.Debug(ctx, "shouldDoFullReloadFromIncremental: deleted conversation: %s", conv.GetConvID())
			return true
		}
		switch conv.ReaderInfo.Status {
		case chat1.ConversationMemberStatus_LEFT, chat1.ConversationMemberStatus_REMOVED:
			s.Debug(ctx, "shouldDoFullReloadFromIncremental: join or leave conv")
			return true
		}
	}
	return false
}

func (s *Syncer) handleMembersTypeChanged(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID) {
	// Clear caches from members type changed convos
	for _, convID := range convIDs {
		s.Debug(ctx, "handleMembersTypeChanged: clearing message cache: %s", convID)
		s.G().ConvSource.Clear(ctx, convID, uid)
	}
}

func (s *Syncer) handleFilteredConvs(ctx context.Context, uid gregor1.UID, syncConvs []chat1.Conversation,
	filteredConvs []types.RemoteConversation) {
	fmap := make(map[string]bool)
	for _, fconv := range filteredConvs {
		fmap[fconv.Conv.GetConvID().String()] = true
	}
	// If any sync convs are not in the filtered list, let's blow away their local storage
	for _, sconv := range syncConvs {
		if !fmap[sconv.GetConvID().String()] {
			s.Debug(ctx, "handleFilteredConvs: conv filtered from inbox, removing cache: convID: %s memberStatus: %v existence: %v",
				sconv.GetConvID(), sconv.ReaderInfo.Status, sconv.Metadata.Existence)
			s.G().ConvSource.Clear(ctx, sconv.GetConvID(), uid)
		}
	}
}

func (s *Syncer) getShouldUnboxSyncConvMap(ctx context.Context, convs []chat1.Conversation,
	topicNameChanged []chat1.ConversationID) (m map[string]bool) {
	m = make(map[string]bool)
	for _, t := range topicNameChanged {
		m[t.String()] = true
	}
	for _, conv := range convs {
		if m[conv.GetConvID().String()] {
			continue
		}
		switch conv.GetMembersType() {
		case chat1.ConversationMembersType_TEAM:
			// include if this is a simple team, or the topic name has changed
			if conv.GetTopicType() != chat1.TopicType_CHAT ||
				conv.Metadata.TeamType != chat1.TeamType_COMPLEX ||
				conv.GetConvID().Eq(s.GetSelectedConversation()) {
				m[conv.GetConvID().String()] = true
			}
		default:
			m[conv.GetConvID().String()] = true
		}
	}
	return m
}

func (s *Syncer) notifyIncrementalSync(ctx context.Context, uid gregor1.UID,
	allConvs []chat1.Conversation, shouldUnboxMap map[string]bool) {
	if len(allConvs) == 0 {
		s.Debug(ctx, "notifyIncrementalSync: no conversations given, sending a current result")
		s.G().ActivityNotifier.InboxSynced(ctx, uid, chat1.TopicType_NONE,
			chat1.NewChatSyncResultWithCurrent())
		return
	}
	m := make(map[chat1.TopicType][]chat1.ChatSyncIncrementalConv)
	for _, c := range allConvs {
		m[c.GetTopicType()] = append(m[c.GetTopicType()], chat1.ChatSyncIncrementalConv{
			Conv: utils.PresentRemoteConversation(types.RemoteConversation{
				Conv: c,
			}),
			ShouldUnbox: shouldUnboxMap[c.GetConvID().String()],
		})
	}
	for _, topicType := range chat1.TopicTypeMap {
		if topicType == chat1.TopicType_NONE {
			continue
		}
		convs := m[topicType]
		s.G().ActivityNotifier.InboxSynced(ctx, uid, topicType,
			chat1.NewChatSyncResultWithIncremental(chat1.ChatSyncIncrementalInfo{
				Items: convs,
			}))
	}
}

func (s *Syncer) sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) (err error) {
	if !s.isConnected {
		s.Debug(ctx, "Sync: aborting because currently offline")
		return OfflineError{}
	}
	// Grab current on disk version
	ibox := storage.NewInbox(s.G())
	vers, err := ibox.Version(ctx, uid)
	if err != nil {
		s.Debug(ctx, "Sync: failed to get current inbox version (using 0): %s", err.Error())
		vers = chat1.InboxVers(0)
	}
	srvVers, err := ibox.ServerVersion(ctx, uid)
	if err != nil {
		s.Debug(ctx, "Sync: failed to get current inbox server version (using 0): %s", err.Error())
		srvVers = 0
	}
	s.Debug(ctx, "Sync: current inbox version: %v server version: %d", vers, srvVers)

	if syncRes == nil {
		// Run the sync call on the server to see how current our local copy is
		syncRes = new(chat1.SyncChatRes)
		if *syncRes, err = cli.SyncChat(ctx, vers); err != nil {
			s.Debug(ctx, "Sync: failed to sync inbox: %s", err.Error())
			return err
		}
	} else {
		s.Debug(ctx, "Sync: skipping sync call, data provided")
	}

	// Set new server versions
	if err = s.G().ServerCacheVersions.Set(ctx, syncRes.CacheVers); err != nil {
		s.Debug(ctx, "Sync: failed to set new server versions: %s", err.Error())
	}

	// Process what the server has told us to do with the local inbox copy
	rtyp, err := syncRes.InboxRes.Typ()
	if err != nil {
		s.Debug(ctx, "Sync: strange type from SyncInbox: %s", err.Error())
		return err
	}
	// Check if the server has cleared the inbox
	if s.isServerInboxClear(ctx, ibox, srvVers) {
		rtyp = chat1.SyncInboxResType_CLEAR
	}

	switch rtyp {
	case chat1.SyncInboxResType_CLEAR:
		s.Debug(ctx, "Sync: version out of date, clearing inbox: %v", vers)
		if err = ibox.Clear(ctx, uid); err != nil {
			s.Debug(ctx, "Sync: failed to clear inbox: %s", err.Error())
		}
		// Send notifications for a full clear
		s.G().ActivityNotifier.InboxSynced(ctx, uid, chat1.TopicType_NONE,
			chat1.NewChatSyncResultWithClear())
	case chat1.SyncInboxResType_CURRENT:
		s.Debug(ctx, "Sync: version is current, standing pat: %v", vers)
		s.G().ActivityNotifier.InboxSynced(ctx, uid, chat1.TopicType_NONE,
			chat1.NewChatSyncResultWithCurrent())
	case chat1.SyncInboxResType_INCREMENTAL:
		incr := syncRes.InboxRes.Incremental()
		s.Debug(ctx, "Sync: version out of date, but can incrementally sync: old vers: %v vers: %v convs: %d",
			vers, incr.Vers, len(incr.Convs))

		var iboxSyncRes storage.InboxSyncRes
		expunges := make(map[string]chat1.Expunge)
		if iboxSyncRes, err = ibox.Sync(ctx, uid, incr.Vers, incr.Convs); err != nil {
			s.Debug(ctx, "Sync: failed to sync conversations to inbox: %s", err.Error())

			// Send notifications for a full clear
			s.G().ActivityNotifier.InboxSynced(ctx, uid, chat1.TopicType_NONE,
				chat1.NewChatSyncResultWithClear())
		} else {
			s.handleMembersTypeChanged(ctx, uid, iboxSyncRes.MembersTypeChanged)
			s.handleFilteredConvs(ctx, uid, incr.Convs, iboxSyncRes.FilteredConvs)
			for _, expunge := range iboxSyncRes.Expunges {
				expunges[expunge.ConvID.String()] = expunge.Expunge
			}
			if s.shouldDoFullReloadFromIncremental(ctx, iboxSyncRes, incr.Convs) {
				// If we get word we should full clear the inbox (like if the user left a conversation),
				// then just reload everything
				s.G().ActivityNotifier.InboxSynced(ctx, uid, chat1.TopicType_NONE,
					chat1.NewChatSyncResultWithClear())
			} else {
				// Send notifications for a successful partial sync
				shouldUnboxMap := s.getShouldUnboxSyncConvMap(ctx, incr.Convs, iboxSyncRes.TopicNameChanged)
				s.notifyIncrementalSync(ctx, uid, incr.Convs, shouldUnboxMap)
			}
		}

		// Dispatch background jobs
		for _, rc := range iboxSyncRes.FilteredConvs {
			conv := rc.Conv
			if delMsg, err := conv.GetMaxMessage(chat1.MessageType_DELETE); err == nil {
				// Any conversation with a delete in it needs to be checked for expunge
				if s.G().ConvSource.ClearFromDelete(ctx, uid, conv.GetConvID(), delMsg.GetMessageID()) {
					// This returning true means we scheduled a background job already
					continue
				}
			}
			if expunge, ok := expunges[conv.GetConvID().String()]; ok {
				// Run expunges on the background loader
				s.Debug(ctx, "Sync: queueing expunge background loader job: convID: %s", conv.GetConvID())
				job := types.NewConvLoaderJob(conv.GetConvID(), nil /* query */, &chat1.Pagination{Num: 50},
					types.ConvLoaderPriorityHighest,
					func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
						s.Debug(ctx, "Sync: executing expunge from a sync run: convID: %s", conv.GetConvID())
						err := s.G().ConvSource.Expunge(ctx, conv.GetConvID(), uid, expunge)
						if err != nil {
							s.Debug(ctx, "Sync: failed to expunge: %v", err)
						}
					})
				if err := s.G().ConvLoader.Queue(ctx, job); err != nil {
					s.Debug(ctx, "Sync: failed to queue conversation load: %s", err)
				}
			} else {
				// Everything else just queue up here
				job := types.NewConvLoaderJob(conv.GetConvID(), nil /* query */, &chat1.Pagination{Num: 50},
					types.ConvLoaderPriorityHigh, newConvLoaderPagebackHook(s.G(), 0, 5))
				if err := s.G().ConvLoader.Queue(ctx, job); err != nil {
					s.Debug(ctx, "Sync: failed to queue conversation load: %s", err)
				}
			}
		}
	}

	return nil
}

func (s *Syncer) RegisterOfflinable(offlinable types.Offlinable) {
	s.Lock()
	defer s.Unlock()
	s.offlinables = append(s.offlinables, offlinable)
}

func (s *Syncer) GetSelectedConversation() chat1.ConversationID {
	s.lastLoadedLock.Lock()
	defer s.lastLoadedLock.Unlock()
	return s.lastLoadedConv
}

func (s *Syncer) SelectConversation(ctx context.Context, convID chat1.ConversationID) {
	s.lastLoadedLock.Lock()
	defer s.lastLoadedLock.Unlock()
	s.Debug(ctx, "SelectConversation: setting last loaded conv to: %s", convID)
	s.lastLoadedConv = convID
}
