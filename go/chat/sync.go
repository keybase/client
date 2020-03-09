package chat

import (
	"encoding/hex"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
)

type Syncer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	isConnected bool
	offlinables []types.Offlinable

	notificationLock    sync.Mutex
	lastLoadedLock      sync.Mutex
	clock               clockwork.Clock
	sendDelay           time.Duration
	shutdownCh          chan struct{}
	fullReloadCh        chan gregor1.UID
	flushCh             chan struct{}
	notificationQueue   map[string][]chat1.ConversationStaleUpdate
	fullReload          map[string]bool
	lastLoadedConv      chat1.ConversationID
	maxLimitedConvLoads int
	maxConvLoads        int
}

func NewSyncer(g *globals.Context) *Syncer {
	s := &Syncer{
		Contextified:        globals.NewContextified(g),
		DebugLabeler:        utils.NewDebugLabeler(g.ExternalG(), "Syncer", false),
		isConnected:         false,
		clock:               clockwork.NewRealClock(),
		shutdownCh:          make(chan struct{}),
		fullReloadCh:        make(chan gregor1.UID),
		flushCh:             make(chan struct{}),
		notificationQueue:   make(map[string][]chat1.ConversationStaleUpdate),
		fullReload:          make(map[string]bool),
		sendDelay:           time.Millisecond * 1000,
		maxLimitedConvLoads: 3,
		maxConvLoads:        10,
	}
	go s.sendNotificationLoop()
	return s
}

func (s *Syncer) SetClock(clock clockwork.Clock) {
	s.clock = clock
}

func (s *Syncer) Shutdown() {
	s.Debug(context.Background(), "shutting down")
	close(s.shutdownCh)
}

func (s *Syncer) dedupUpdates(updates []chat1.ConversationStaleUpdate) (res []chat1.ConversationStaleUpdate) {
	m := make(map[chat1.ConvIDStr]chat1.ConversationStaleUpdate)
	for _, update := range updates {
		if existing, ok := m[update.ConvID.ConvIDStr()]; ok {
			switch existing.UpdateType {
			case chat1.StaleUpdateType_CLEAR:
				// do nothing, existing is already clearing
			case chat1.StaleUpdateType_NEWACTIVITY:
				m[update.ConvID.ConvIDStr()] = update
			}
		} else {
			m[update.ConvID.ConvIDStr()] = update
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
	ctx = globals.CtxAddLogTags(ctx, s.G())
	defer s.Trace(ctx, func() error { return err }, "Connected")()
	s.Lock()
	s.isConnected = true
	// Let the Offlinables know that we are back online
	for _, o := range s.offlinables {
		o.Connected(ctx)
	}
	s.Unlock()

	// Run sync against the server
	return s.Sync(ctx, cli, uid, syncRes)
}

func (s *Syncer) Disconnected(ctx context.Context) {
	defer s.Trace(ctx, func() error { return nil }, "Disconnected")()
	s.Lock()
	s.isConnected = false
	// Let the Offlinables know of connection state change
	for _, o := range s.offlinables {
		o.Disconnected(ctx)
	}
	s.Unlock()
}

func (s *Syncer) handleMembersTypeChanged(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID) {
	// Clear caches from members type changed convos
	for _, convID := range convIDs {
		s.Debug(ctx, "handleMembersTypeChanged: clearing message cache: %s", convID)
		err := s.G().ConvSource.Clear(ctx, convID, uid)
		if err != nil {
			s.Debug(ctx, "handleMembersTypeChanged: erroring clearing conv: %+v", err)
		}
	}
}

func (s *Syncer) handleFilteredConvs(ctx context.Context, uid gregor1.UID, syncConvs []chat1.Conversation,
	filteredConvs []types.RemoteConversation) {
	fmap := make(map[chat1.ConvIDStr]bool)
	for _, fconv := range filteredConvs {
		fmap[fconv.Conv.GetConvID().ConvIDStr()] = true
	}
	// If any sync convs are not in the filtered list, let's blow away their local storage
	for _, sconv := range syncConvs {
		if !fmap[sconv.GetConvID().ConvIDStr()] {
			s.Debug(ctx, "handleFilteredConvs: conv filtered from inbox, removing cache: convID: %s memberStatus: %v existence: %v",
				sconv.GetConvID(), sconv.ReaderInfo.Status, sconv.Metadata.Existence)
			err := s.G().ConvSource.Clear(ctx, sconv.GetConvID(), uid)
			if err != nil {
				s.Debug(ctx, "handleFilteredCovs: erroring clearing conv: %+v", err)
			}
		}
	}
}

func (s *Syncer) maxSyncUnboxConvs() int {
	if s.G().IsMobileAppType() {
		return 8
	}
	return 100
}

func (s *Syncer) getShouldUnboxSyncConvMap(ctx context.Context, convs []chat1.Conversation,
	topicNameChanged []chat1.ConversationID) (m map[chat1.ConvIDStr]bool) {
	m = make(map[chat1.ConvIDStr]bool)
	for _, t := range topicNameChanged {
		m[t.ConvIDStr()] = true
	}
	rconvs := utils.RemoteConvs(convs)
	sort.Slice(rconvs, func(i, j int) bool {
		return utils.GetConvPriorityScore(rconvs[i]) >= utils.GetConvPriorityScore(rconvs[j])
	})
	maxConvs := s.maxSyncUnboxConvs()
	for _, conv := range rconvs {
		if len(m) >= maxConvs {
			s.Debug(ctx, "getShouldUnboxSyncConvMap: max sync convs reached, not including any others")
			break
		}
		if m[conv.ConvIDStr] {
			continue
		}
		if s.shouldUnboxSyncConv(conv.Conv) {
			m[conv.ConvIDStr] = true
		}
	}
	return m
}

func (s *Syncer) shouldUnboxSyncConv(conv chat1.Conversation) bool {
	// only chat on mobile
	if s.G().IsMobileAppType() && conv.GetTopicType() != chat1.TopicType_CHAT {
		return false
	}
	// Skips convs we don't care for.
	switch conv.Metadata.Status {
	case chat1.ConversationStatus_BLOCKED,
		chat1.ConversationStatus_IGNORED,
		chat1.ConversationStatus_REPORTED:
		return false
	}
	// Only let through ACTIVE/PREVIEW convs.
	if conv.ReaderInfo != nil {
		switch conv.ReaderInfo.Status {
		case chat1.ConversationMemberStatus_ACTIVE,
			chat1.ConversationMemberStatus_PREVIEW:
		default:
			return false
		}
	}
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		// include if this is a simple team or we are currently viewing the
		// conv.
		return conv.GetTopicType() == chat1.TopicType_KBFSFILEEDIT ||
			conv.Metadata.TeamType != chat1.TeamType_COMPLEX ||
			conv.GetConvID().Eq(s.GetSelectedConversation())
	default:
		return true
	}
}

func (s *Syncer) notifyIncrementalSync(ctx context.Context, uid gregor1.UID,
	allConvs []chat1.Conversation, shouldUnboxMap map[chat1.ConvIDStr]bool) {
	if len(allConvs) == 0 {
		s.Debug(ctx, "notifyIncrementalSync: no conversations given, sending a current result")
		s.G().ActivityNotifier.InboxSynced(ctx, uid, chat1.TopicType_NONE,
			chat1.NewChatSyncResultWithCurrent())
		return
	}
	itemsByTopicType := make(map[chat1.TopicType][]chat1.ChatSyncIncrementalConv)
	for _, c := range allConvs {
		var md *types.RemoteConversationMetadata
		rc, err := utils.GetUnverifiedConv(ctx, s.G(), uid, c.GetConvID(),
			types.InboxSourceDataSourceLocalOnly)
		if err == nil {
			md = rc.LocalMetadata
		}
		rc = utils.RemoteConv(c)
		rc.LocalMetadata = md
		itemsByTopicType[c.GetTopicType()] = append(itemsByTopicType[c.GetTopicType()],
			chat1.ChatSyncIncrementalConv{
				Conv:        utils.PresentRemoteConversation(ctx, s.G(), rc),
				ShouldUnbox: shouldUnboxMap[c.GetConvID().ConvIDStr()],
			})
	}
	for _, topicType := range chat1.TopicTypeMap {
		if topicType == chat1.TopicType_NONE {
			continue
		}
		s.G().ActivityNotifier.InboxSynced(ctx, uid, topicType,
			chat1.NewChatSyncResultWithIncremental(chat1.ChatSyncIncrementalInfo{
				Items: itemsByTopicType[topicType],
			}))
	}
}

func (s *Syncer) Sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Sync")()
	s.Lock()
	if !s.isConnected {
		defer s.Unlock()
		s.Debug(ctx, "Sync: aborting because currently offline")
		return OfflineError{}
	}
	s.Unlock()

	// Grab current on disk version
	ibox := storage.NewInbox(s.G())
	vers, err := ibox.Version(ctx, uid)
	if err != nil {
		return err
	}
	srvVers, err := ibox.ServerVersion(ctx, uid)
	if err != nil {
		return err
	}
	s.Debug(ctx, "Sync: current inbox version: %v server version: %d", vers, srvVers)

	if syncRes == nil {
		// Run the sync call on the server to see how current our local copy is
		syncRes = new(chat1.SyncChatRes)
		if *syncRes, err = cli.SyncChat(ctx, chat1.SyncChatArg{
			Vers:             vers,
			SummarizeMaxMsgs: true,
		}); err != nil {
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

		var iboxSyncRes types.InboxSyncRes
		expunges := make(map[chat1.ConvIDStr]chat1.Expunge)
		if iboxSyncRes, err = s.G().InboxSource.Sync(ctx, uid, incr.Vers, incr.Convs); err != nil {
			s.Debug(ctx, "Sync: failed to sync conversations to inbox: %s", err.Error())

			// Send notifications for a full clear
			s.G().ActivityNotifier.InboxSynced(ctx, uid, chat1.TopicType_NONE,
				chat1.NewChatSyncResultWithClear())
		} else {
			s.handleMembersTypeChanged(ctx, uid, iboxSyncRes.MembersTypeChanged)
			s.handleFilteredConvs(ctx, uid, incr.Convs, iboxSyncRes.FilteredConvs)
			for _, expunge := range iboxSyncRes.Expunges {
				expunges[expunge.ConvID.ConvIDStr()] = expunge.Expunge
			}
			// Send notifications for a successful partial sync
			shouldUnboxMap := s.getShouldUnboxSyncConvMap(ctx, incr.Convs, iboxSyncRes.TopicNameChanged)
			s.notifyIncrementalSync(ctx, uid, incr.Convs, shouldUnboxMap)
		}

		// The idea here is to limit the amount of work we do with the
		// background conversation loader on mobile. If we are on a cell
		// connection, or if we just came into the foreground, limit the number
		// of conversations we queue up for background loading.
		var queuedConvs, maxConvs int
		pageBack := 3
		num := 50
		netState := s.G().MobileNetState.State()
		state := s.G().MobileAppState.State()
		if s.G().IsMobileAppType() {
			maxConvs = s.maxConvLoads
			num = 30
			pageBack = 0
			if netState.IsLimited() || state == keybase1.MobileAppState_FOREGROUND {
				maxConvs = s.maxLimitedConvLoads
			}
		}
		// Sort big teams convs lower (and by time to tie break)
		sort.Slice(iboxSyncRes.FilteredConvs, func(i, j int) bool {
			itype := iboxSyncRes.FilteredConvs[i].GetTeamType()
			jtype := iboxSyncRes.FilteredConvs[j].GetTeamType()
			if itype == chat1.TeamType_COMPLEX && jtype != chat1.TeamType_COMPLEX {
				return false
			}
			if jtype == chat1.TeamType_COMPLEX && itype != chat1.TeamType_COMPLEX {
				return true
			}
			return utils.GetConvPriorityScore(iboxSyncRes.FilteredConvs[i]) >= utils.GetConvPriorityScore(iboxSyncRes.FilteredConvs[j])
		})

		// Dispatch background jobs
		for _, rc := range iboxSyncRes.FilteredConvs {
			conv := rc.Conv
			if expunge, ok := expunges[conv.GetConvID().ConvIDStr()]; ok {
				// Run expunges on the background loader
				s.Debug(ctx, "Sync: queueing expunge background loader job: convID: %s", conv.GetConvID())
				job := types.NewConvLoaderJob(conv.GetConvID(), &chat1.Pagination{Num: num},
					types.ConvLoaderPriorityHighest, types.ConvLoaderUnique,
					func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
						s.Debug(ctx, "Sync: executing expunge from a sync run: convID: %s", conv.GetConvID())
						err := s.G().ConvSource.Expunge(ctx, rc, uid, expunge)
						if err != nil {
							s.Debug(ctx, "Sync: failed to expunge: %v", err)
						}
					})
				if err := s.G().ConvLoader.Queue(ctx, job); err != nil {
					s.Debug(ctx, "Sync: failed to queue conversation load: %s", err)
				}
				queuedConvs++
			} else {
				// If we set maxConvs, then check it now
				if maxConvs > 0 && (queuedConvs >= maxConvs || !s.shouldUnboxSyncConv(conv)) {
					continue
				}
				s.Debug(ctx, "Sync: queueing background loader job: convID: %s", conv.GetConvID())
				// Everything else just queue up here
				job := types.NewConvLoaderJob(conv.GetConvID(), &chat1.Pagination{Num: num},
					types.ConvLoaderPriorityHigh, types.ConvLoaderGeneric,
					newConvLoaderPagebackHook(s.G(), 0, pageBack))
				if err := s.G().ConvLoader.Queue(ctx, job); err != nil {
					s.Debug(ctx, "Sync: failed to queue conversation load: %s", err)
				}
				queuedConvs++
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
