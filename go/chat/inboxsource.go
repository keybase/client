package chat

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

func filterConvLocals(convLocals []chat1.ConversationLocal, rquery *chat1.GetInboxQuery,
	query *chat1.GetInboxLocalQuery, nameInfo *types.NameInfoUntrusted) (res []chat1.ConversationLocal, err error) {

	for _, convLocal := range convLocals {
		if rquery != nil && rquery.TlfID != nil {
			// inbox query contained a TLF name, so check to make sure that
			// the conversation from the server matches tlfInfo from kbfs
			if convLocal.Info.TLFNameExpanded() != nameInfo.CanonicalName {
				if convLocal.Error == nil {
					return nil, fmt.Errorf("server conversation TLF name mismatch: %s, expected %s",
						convLocal.Info.TLFNameExpanded(), nameInfo.CanonicalName)
				}
			}
			if convLocal.Info.Visibility != rquery.Visibility() {
				return nil, fmt.Errorf("server conversation TLF visibility mismatch: %s, expected %s",
					convLocal.Info.Visibility, rquery.Visibility())
			}
			if !nameInfo.ID.Eq(convLocal.Info.Triple.Tlfid) {
				return nil, fmt.Errorf("server conversation TLF ID mismatch: %s, expected %s",
					convLocal.Info.Triple.Tlfid, nameInfo.ID)
			}
			// tlfInfo.ID and rquery.TlfID should always match, but just in case:
			if !rquery.TlfID.Eq(convLocal.Info.Triple.Tlfid) {
				return nil, fmt.Errorf("server conversation TLF ID mismatch: %s, expected %s",
					convLocal.Info.Triple.Tlfid, rquery.TlfID)
			}

			// Note that previously, we made a call to KBFS to lookup the TLF in
			// convLocal.Info.TlfName and verify that, but the above checks accomplish
			// the same thing without an RPC call.
		}

		// server can't query on topic name, so we have to do it ourselves in the loop
		if query != nil && query.TopicName != nil && *query.TopicName != convLocal.Info.TopicName {
			continue
		}

		res = append(res, convLocal)
	}

	return res, nil
}

type baseInboxSource struct {
	globals.Contextified
	utils.DebugLabeler

	so               *sourceOfflinable
	sub              types.InboxSource
	getChatInterface func() chat1.RemoteInterface
	localizer        *localizerPipeline
}

func newBaseInboxSource(g *globals.Context, ibs types.InboxSource,
	getChatInterface func() chat1.RemoteInterface) *baseInboxSource {
	labeler := utils.NewDebugLabeler(g.GetLog(), "baseInboxSource", false)
	return &baseInboxSource{
		Contextified:     globals.NewContextified(g),
		sub:              ibs,
		DebugLabeler:     labeler,
		getChatInterface: getChatInterface,
		so:               newSourceOfflinable(g, labeler),
		localizer: newLocalizerPipeline(g,
			newBasicSupersedesTransform(g, basicSupersedesTransformOpts{})),
	}
}

func (b *baseInboxSource) notifyTlfFinalize(ctx context.Context, username string) {
	// Let the rest of the system know this user has changed
	arg := libkb.NewLoadUserArg(b.G().ExternalG()).WithName(username).WithPublicKeyOptional()
	finalizeUser, err := libkb.LoadUser(arg)
	if err != nil {
		b.Debug(ctx, "notifyTlfFinalize: failed to load finalize user, skipping user changed notification: err: %s", err.Error())
	} else {
		b.G().UserChanged(finalizeUser.GetUID())
	}
}

func (b *baseInboxSource) SetRemoteInterface(ri func() chat1.RemoteInterface) {
	b.getChatInterface = ri
}

func (b *baseInboxSource) GetInboxQueryLocalToRemote(ctx context.Context,
	lquery *chat1.GetInboxLocalQuery) (rquery *chat1.GetInboxQuery, info *types.NameInfoUntrusted, err error) {

	if lquery == nil {
		return nil, info, nil
	}

	rquery = &chat1.GetInboxQuery{}
	if lquery.Name != nil && len(lquery.Name.Name) > 0 {
		var err error
		tlfName := utils.AddUserToTLFName(b.G(), lquery.Name.Name, lquery.Visibility(),
			lquery.Name.MembersType)
		info, err = CreateNameInfoSource(ctx, b.G(), lquery.Name.MembersType).LookupIDUntrusted(ctx, tlfName,
			lquery.Visibility() == keybase1.TLFVisibility_PUBLIC)
		if err != nil {
			b.Debug(ctx, "GetInboxQueryLocalToRemote: failed: %s", err)
			return nil, info, err
		}
		rquery.TlfID = &info.ID
		rquery.MembersTypes = []chat1.ConversationMembersType{lquery.Name.MembersType}
		b.Debug(ctx, "GetInboxQueryLocalToRemote: mapped name %q to TLFID %v", tlfName, info.ID)
	}

	rquery.After = lquery.After
	rquery.Before = lquery.Before
	rquery.TlfVisibility = lquery.TlfVisibility
	rquery.TopicType = lquery.TopicType
	rquery.UnreadOnly = lquery.UnreadOnly
	rquery.ReadOnly = lquery.ReadOnly
	rquery.ComputeActiveList = lquery.ComputeActiveList
	rquery.ConvIDs = lquery.ConvIDs
	rquery.OneChatTypePerTLF = lquery.OneChatTypePerTLF
	rquery.Status = lquery.Status
	rquery.SummarizeMaxMsgs = false

	return rquery, info, nil
}

func (b *baseInboxSource) IsMember(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (bool, error) {
	ib, err := b.sub.ReadUnverified(ctx, uid, true, &chat1.GetInboxQuery{
		ConvID: &convID,
	}, nil)
	if err != nil {
		return false, err
	}
	if len(ib.ConvsUnverified) == 0 {
		return false, fmt.Errorf("conversation not found: %s", convID)
	}
	conv := ib.ConvsUnverified[0]
	switch conv.Conv.ReaderInfo.Status {
	case chat1.ConversationMemberStatus_ACTIVE, chat1.ConversationMemberStatus_RESET:
		return true, nil
	default:
		return false, nil
	}
}

func (b *baseInboxSource) Localize(ctx context.Context, uid gregor1.UID, convs []types.RemoteConversation,
	localizerTyp types.ConversationLocalizerTyp) ([]chat1.ConversationLocal, chan types.AsyncInboxResult, error) {
	localizeCb := make(chan types.AsyncInboxResult, len(convs))
	localizer := b.createConversationLocalizer(ctx, localizerTyp, localizeCb)
	b.Debug(ctx, "Localize: using localizer: %s", localizer.Name())

	res, err := localizer.Localize(ctx, uid, types.Inbox{
		ConvsUnverified: convs,
	}, nil)
	if err != nil {
		return res, localizeCb, err
	}
	return res, localizeCb, nil
}

func (b *baseInboxSource) createConversationLocalizer(ctx context.Context, typ types.ConversationLocalizerTyp,
	localizeCb chan types.AsyncInboxResult) conversationLocalizer {
	switch typ {
	case types.ConversationLocalizerBlocking:
		return newBlockingLocalizer(b.G(), b.localizer, localizeCb)
	case types.ConversationLocalizerNonblocking:
		return newNonblockingLocalizer(b.G(), b.localizer, localizeCb)
	default:
		b.Debug(ctx, "createConversationLocalizer: warning unknown typ, using default: %v", typ)
		return newBlockingLocalizer(b.G(), b.localizer, localizeCb)
	}
}

func (b *baseInboxSource) Start(ctx context.Context, uid gregor1.UID) {
	b.localizer.start(ctx)
}

func (b *baseInboxSource) Stop(ctx context.Context) chan struct{} {
	return b.localizer.stop(ctx)
}

func (b *baseInboxSource) Suspend(ctx context.Context) bool {
	return b.localizer.suspend(ctx)
}

func (b *baseInboxSource) Resume(ctx context.Context) bool {
	return b.localizer.resume(ctx)
}

func (b *baseInboxSource) IsOffline(ctx context.Context) bool {
	return b.so.IsOffline(ctx)
}

func (b *baseInboxSource) Connected(ctx context.Context) {
	b.so.Connected(ctx)
	b.localizer.Connected()
}

func (b *baseInboxSource) Disconnected(ctx context.Context) {
	b.so.Disconnected(ctx)
	b.localizer.Disconnected()
}

func GetInboxQueryNameInfo(ctx context.Context, g *globals.Context,
	lquery *chat1.GetInboxLocalQuery) (*types.NameInfoUntrusted, error) {
	if lquery.Name == nil || len(lquery.Name.Name) == 0 {
		return nil, nil
	}
	return CreateNameInfoSource(ctx, g, lquery.Name.MembersType).LookupIDUntrusted(ctx, lquery.Name.Name,
		lquery.Visibility() == keybase1.TLFVisibility_PUBLIC)
}

type RemoteInboxSource struct {
	globals.Contextified
	utils.DebugLabeler
	*baseInboxSource
}

var _ types.InboxSource = (*RemoteInboxSource)(nil)

func NewRemoteInboxSource(g *globals.Context, ri func() chat1.RemoteInterface) *RemoteInboxSource {
	labeler := utils.NewDebugLabeler(g.GetLog(), "RemoteInboxSource", false)
	s := &RemoteInboxSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
	}
	s.baseInboxSource = newBaseInboxSource(g, s, ri)
	return s
}

func (s *RemoteInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizerTyp types.ConversationLocalizerTyp, useLocalData bool, maxLocalize *int,
	query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (types.Inbox, chan types.AsyncInboxResult, error) {

	rquery, tlfInfo, err := s.GetInboxQueryLocalToRemote(ctx, query)
	if err != nil {
		return types.Inbox{}, nil, err
	}
	inbox, err := s.ReadUnverified(ctx, uid, useLocalData, rquery, p)
	if err != nil {
		return types.Inbox{}, nil, err
	}

	localizeCb := make(chan types.AsyncInboxResult, len(inbox.ConvsUnverified))
	localizer := s.createConversationLocalizer(ctx, localizerTyp, localizeCb)
	s.Debug(ctx, "Read: using localizer: %s", localizer.Name())

	res, err := localizer.Localize(ctx, uid, inbox, maxLocalize)
	if err != nil {
		return types.Inbox{}, localizeCb, err
	}

	res, err = filterConvLocals(res, rquery, query, tlfInfo)
	if err != nil {
		return types.Inbox{}, localizeCb, err
	}

	return types.Inbox{
		Version:         inbox.Version,
		Convs:           res,
		ConvsUnverified: inbox.ConvsUnverified,
		Pagination:      inbox.Pagination,
	}, localizeCb, nil
}

func (s *RemoteInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
	rquery *chat1.GetInboxQuery, p *chat1.Pagination) (types.Inbox, error) {

	if s.IsOffline(ctx) {
		return types.Inbox{}, OfflineError{}
	}

	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      rquery,
		Pagination: p,
	})
	if err != nil {
		return types.Inbox{}, err
	}

	return types.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: utils.RemoteConvs(ib.Inbox.Full().Conversations),
		Pagination:      ib.Inbox.Full().Pagination,
	}, nil
}

func (s *RemoteInboxSource) NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	conv chat1.Conversation) error {
	return nil
}

func (s *RemoteInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (*chat1.ConversationLocal, error) {
	return nil, nil
}

func (s *RemoteInboxSource) ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msgID chat1.MessageID) (*chat1.ConversationLocal, error) {
	return nil, nil
}

func (s *RemoteInboxSource) SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, status chat1.ConversationStatus) (*chat1.ConversationLocal, error) {
	return nil, nil
}

func (s *RemoteInboxSource) SetAppNotificationSettings(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID, settings chat1.ConversationNotificationInfo) (*chat1.ConversationLocal, error) {
	return nil, nil
}

func (s *RemoteInboxSource) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) ([]chat1.ConversationLocal, error) {
	// Notify rest of system about reset
	s.notifyTlfFinalize(ctx, finalizeInfo.ResetUser)
	return nil, nil
}

func (s *RemoteInboxSource) MembershipUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	joined []chat1.ConversationMember, removed []chat1.ConversationMember, resets []chat1.ConversationMember,
	previews []chat1.ConversationID) (res types.MembershipUpdateRes, err error) {
	return res, err
}

func (s *RemoteInboxSource) Expunge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
	expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (res *chat1.ConversationLocal, err error) {
	return res, err
}

func (s *RemoteInboxSource) SetConvRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, policy chat1.RetentionPolicy) (res *chat1.ConversationLocal, err error) {
	return res, err
}

func (s *RemoteInboxSource) SetTeamRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy) (res []chat1.ConversationLocal, err error) {
	return res, err
}

func (s *RemoteInboxSource) SetConvSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, convSettings *chat1.ConversationSettings) (res *chat1.ConversationLocal, err error) {
	return res, err
}

func (s *RemoteInboxSource) SubteamRename(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID) (convs []chat1.ConversationLocal, err error) {
	return convs, err
}

func (s *RemoteInboxSource) TeamTypeChanged(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID, teamType chat1.TeamType) (conv *chat1.ConversationLocal, err error) {
	return conv, err
}

func (s *RemoteInboxSource) UpgradeKBFSToImpteam(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	return conv, err
}

type HybridInboxSource struct {
	globals.Contextified
	utils.DebugLabeler
	*baseInboxSource
}

var _ types.InboxSource = (*HybridInboxSource)(nil)

func NewHybridInboxSource(g *globals.Context,
	getChatInterface func() chat1.RemoteInterface) *HybridInboxSource {
	labeler := utils.NewDebugLabeler(g.GetLog(), "HybridInboxSource", false)
	s := &HybridInboxSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
	}
	s.baseInboxSource = newBaseInboxSource(g, s, getChatInterface)
	return s
}

func (s *HybridInboxSource) fetchRemoteInbox(ctx context.Context, uid gregor1.UID, query *chat1.GetInboxQuery,
	p *chat1.Pagination) (types.Inbox, error) {

	// Insta fail if we are offline
	if s.IsOffline(ctx) {
		return types.Inbox{}, OfflineError{}
	}

	// We always want this on for fetches to fill the local inbox, otherwise we never get the
	// full list for the conversations that come back
	var rquery chat1.GetInboxQuery
	if query == nil {
		rquery = chat1.GetInboxQuery{
			ComputeActiveList: true,
			SummarizeMaxMsgs:  false,
		}
	} else {
		rquery = *query
		rquery.ComputeActiveList = true
		// If we have been given a fixed set of conversation IDs, then just return summary, since
		// we likely have the messages cached locally.
		rquery.SummarizeMaxMsgs = len(rquery.ConvIDs) > 0 || rquery.ConvID != nil
	}

	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      &rquery,
		Pagination: p,
	})
	if err != nil {
		return types.Inbox{}, err
	}

	for index, conv := range ib.Inbox.Full().Conversations {
		// Retention policy expunge
		expunge := conv.GetExpunge()
		if expunge != nil {
			s.G().ConvSource.Expunge(ctx, conv.GetConvID(), uid, *expunge)
		}
		// Queue all these convs up to be loaded by the background loader
		// Only load first 100 so we don't get the conv loader too backed up
		if index < 100 {
			job := types.NewConvLoaderJob(conv.GetConvID(), nil /* query */, &chat1.Pagination{Num: 50},
				types.ConvLoaderPriorityMedium, newConvLoaderPagebackHook(s.G(), 0, 5))
			if err := s.G().ConvLoader.Queue(ctx, job); err != nil {
				s.Debug(ctx, "fetchRemoteInbox: failed to queue conversation load: %s", err)
			}
		}
	}

	return types.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: utils.RemoteConvs(ib.Inbox.Full().Conversations),
		Pagination:      ib.Inbox.Full().Pagination,
	}, nil
}

func (s *HybridInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizerTyp types.ConversationLocalizerTyp, useLocalData bool, maxLocalize *int,
	query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (inbox types.Inbox, localizeCb chan types.AsyncInboxResult, err error) {

	defer s.Trace(ctx, func() error { return err }, "Read")()

	// Read unverified inbox
	rquery, tlfInfo, err := s.GetInboxQueryLocalToRemote(ctx, query)
	if err != nil {
		return inbox, localizeCb, err
	}
	inbox, err = s.ReadUnverified(ctx, uid, useLocalData, rquery, p)
	if err != nil {
		return inbox, localizeCb, err
	}

	localizeCb = make(chan types.AsyncInboxResult, len(inbox.ConvsUnverified))
	localizer := s.createConversationLocalizer(ctx, localizerTyp, localizeCb)
	s.Debug(ctx, "Read: using localizer: %s", localizer.Name())

	// Localize
	inbox.Convs, err = localizer.Localize(ctx, uid, inbox, maxLocalize)
	if err != nil {
		return inbox, localizeCb, err
	}

	// Run post filters
	inbox.Convs, err = filterConvLocals(inbox.Convs, rquery, query, tlfInfo)
	if err != nil {
		return inbox, localizeCb, err
	}

	// Write metadata to the inbox cache
	if err = storage.NewInbox(s.G()).MergeLocalMetadata(ctx, uid, inbox.Convs); err != nil {
		// Don't abort the operation on this kind of error
		s.Debug(ctx, "Read: unable to write inbox local metadata: %s", err)
	}

	return inbox, localizeCb, nil
}

func (s *HybridInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
	query *chat1.GetInboxQuery, p *chat1.Pagination) (res types.Inbox, err error) {
	defer s.Trace(ctx, func() error { return err }, "ReadUnverified")()

	var cerr storage.Error
	inboxStore := storage.NewInbox(s.G())

	// Try local storage (if enabled)
	if useLocalData {
		var vers chat1.InboxVers
		var convs []types.RemoteConversation
		var pagination *chat1.Pagination
		vers, convs, pagination, cerr = inboxStore.Read(ctx, uid, query, p)
		if cerr == nil {
			s.Debug(ctx, "ReadUnverified: hit local storage: uid: %s convs: %d", uid, len(convs))
			res = types.Inbox{
				Version:         vers,
				ConvsUnverified: convs,
				Pagination:      pagination,
			}
		}
	} else {
		cerr = storage.MissError{}
	}

	// If we hit an error reading from storage, then read from remote
	if cerr != nil {
		if _, ok := cerr.(storage.MissError); !ok {
			s.Debug(ctx, "ReadUnverified: error fetching inbox: %s", cerr.Error())
		} else {
			s.Debug(ctx, "ReadUnverified: storage miss")
		}

		// Go to the remote on miss
		res, err = s.fetchRemoteInbox(ctx, uid, query, p)
		if err != nil {
			return res, err
		}

		// Write out to local storage only if we are using local data
		if useLocalData {
			if cerr = inboxStore.Merge(ctx, uid, res.Version, utils.PluckConvs(res.ConvsUnverified), query, p); cerr != nil {
				s.Debug(ctx, "ReadUnverified: failed to write inbox to local storage: %s", cerr.Error())
			}
		}
	}

	return res, err
}

func (s *HybridInboxSource) handleInboxError(ctx context.Context, err error, uid gregor1.UID) (ferr error) {
	defer func() {
		if ferr != nil {
			// Only do this aggressive clear if the error we get is not some kind of network error
			if IsOfflineError(ferr) == OfflineErrorKindOnline {
				s.Debug(ctx, "handleInboxError: failed to recover from inbox error, clearing: %s", ferr)
				storage.NewInbox(s.G()).Clear(ctx, uid)
			} else {
				s.Debug(ctx, "handleInboxError: skipping inbox clear because of offline error: %s", ferr)
			}
		}
	}()

	if _, ok := err.(storage.MissError); ok {
		return nil
	}
	if verr, ok := err.(storage.VersionMismatchError); ok {
		s.Debug(ctx, "handleInboxError: version mismatch, syncing and sending stale notifications: %s",
			verr.Error())
		return s.G().Syncer.Sync(ctx, s.getChatInterface(), uid, nil)
	}
	return err
}

func (s *HybridInboxSource) NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	conv chat1.Conversation) (err error) {
	defer s.Trace(ctx, func() error { return err }, "NewConversation")()
	if cerr := storage.NewInbox(s.G()).NewConversation(ctx, uid, vers, conv); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return err
	}

	return nil
}

func (s *HybridInboxSource) getConvLocal(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	// Read back affected conversation so we can send it to the frontend
	ib, _, err := s.Read(ctx, uid, types.ConversationLocalizerBlocking, true, nil, &chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		return conv, err
	}
	if len(ib.Convs) == 0 {
		return conv, fmt.Errorf("unable to find conversation for new message: convID: %s", convID)
	}
	if len(ib.Convs) > 1 {
		return conv, fmt.Errorf("more than one conversation returned? convID: %s", convID)
	}
	return &ib.Convs[0], nil
}

// Get convs. May return fewer or no conversations.
func (s *HybridInboxSource) getConvsLocal(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID) ([]chat1.ConversationLocal, error) {
	// Read back affected conversation so we can send it to the frontend
	ib, _, err := s.Read(ctx, uid, types.ConversationLocalizerBlocking, true, nil, &chat1.GetInboxLocalQuery{
		ConvIDs: convIDs,
	}, nil)
	return ib.Convs, err
}

func (s *HybridInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "NewMessage")()
	if cerr := storage.NewInbox(s.G()).NewMessage(ctx, uid, vers, convID, msg, maxMsgs); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "NewMessage: unable to load conversation: convID: %s err: %s", convID, err.Error())
		return nil, nil
	}
	return conv, nil
}

func (s *HybridInboxSource) ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msgID chat1.MessageID) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "ReadMessage")()
	if cerr := storage.NewInbox(s.G()).ReadMessage(ctx, uid, vers, convID, msgID); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "ReadMessage: unable to load conversation: convID: %s err: %s", convID, err.Error())
		return nil, nil
	}
	return conv, nil

}

func (s *HybridInboxSource) SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, status chat1.ConversationStatus) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "SetStatus")()
	if cerr := storage.NewInbox(s.G()).SetStatus(ctx, uid, vers, convID, status); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "SetStatus: unable to load conversation: convID: %s err: %s", convID, err.Error())
		return nil, nil
	}
	return conv, nil
}

func (s *HybridInboxSource) SetAppNotificationSettings(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID, settings chat1.ConversationNotificationInfo) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "SetAppNotificationSettings")()
	ib := storage.NewInbox(s.G())
	if cerr := ib.SetAppNotificationSettings(ctx, uid, vers, convID, settings); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "SetAppNotificationSettings: unable to load conversation: convID: %s err: %s",
			convID, err.Error())
		return nil, nil
	}
	return conv, nil
}

func (s *HybridInboxSource) TeamTypeChanged(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID, teamType chat1.TeamType) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "TeamTypeChanged")()

	// Read the remote conversation so we can get the notification settings changes
	remoteConv, err := GetUnverifiedConv(ctx, s.G(), uid, convID, false)
	if err != nil {
		s.Debug(ctx, "TeamTypeChanged: failed to read team type conv: %s", err.Error())
		return nil, err
	}
	ib := storage.NewInbox(s.G())
	if cerr := ib.TeamTypeChanged(ctx, uid, vers, convID, teamType, remoteConv.Notifications); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "TeamTypeChanged: unable to load conversation: convID: %s err: %s",
			convID, err.Error())
		return nil, nil
	}
	return conv, nil
}

func (s *HybridInboxSource) UpgradeKBFSToImpteam(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "UpgradeKBFSToImpteam")()

	ib := storage.NewInbox(s.G())
	if cerr := ib.UpgradeKBFSToImpteam(ctx, uid, vers, convID); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "UpgradeKBFSToImpteam: unable to load conversation: convID: %s err: %s",
			convID, err.Error())
		return nil, nil
	}
	return conv, nil
}

func (s *HybridInboxSource) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) (convs []chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "TlfFinalize")()

	if cerr := storage.NewInbox(s.G()).TlfFinalize(ctx, uid, vers, convIDs, finalizeInfo); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return convs, err
	}
	for _, convID := range convIDs {
		var conv *chat1.ConversationLocal
		if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
			s.Debug(ctx, "TlfFinalize: unable to get conversation: %s", convID)
		}
		if conv != nil {
			convs = append(convs, *conv)
		}
	}

	// Notify rest of system about finalize
	s.notifyTlfFinalize(ctx, finalizeInfo.ResetUser)

	return convs, nil
}

func (s *HybridInboxSource) MembershipUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	joined []chat1.ConversationMember, removed []chat1.ConversationMember, resets []chat1.ConversationMember,
	previews []chat1.ConversationID) (res types.MembershipUpdateRes, err error) {
	defer s.Trace(ctx, func() error { return err }, "MembershipUpdate")()

	// Separate into joins and removed on uid, and then on other users
	var userJoined []chat1.ConversationID
	for _, j := range joined {
		if j.Uid.Eq(uid) {
			userJoined = append(userJoined, j.ConvID)
		} else {
			res.OthersJoinedConvs = append(res.OthersJoinedConvs, j)
		}
	}
	// Append any previewed channels as well. We can do this since we just fetch all these conversations from
	// the server, and that will have the proper member status set.
	userJoined = append(userJoined, previews...)
	for _, r := range removed {
		if r.Uid.Eq(uid) {
			// Blow away conversation cache for any conversations we get removed from
			s.Debug(ctx, "MembershipUpdate: clear conv cache for removed conv: %s", r.ConvID)
			s.G().ConvSource.Clear(ctx, r.ConvID, uid)
			res.UserRemovedConvs = append(res.UserRemovedConvs, r)
		} else {
			res.OthersRemovedConvs = append(res.OthersRemovedConvs, r)
		}
	}

	// Load the user joined conversations
	var userJoinedConvs []chat1.Conversation
	if len(userJoined) > 0 {
		var ibox types.Inbox
		ibox, _, err = s.Read(ctx, uid, types.ConversationLocalizerBlocking, false, nil,
			&chat1.GetInboxLocalQuery{
				ConvIDs: userJoined,
			}, nil)
		if err != nil {
			s.Debug(ctx, "MembershipUpdate: failed to read joined convs: %s", err.Error())
			return
		}

		userJoinedConvs = utils.PluckConvs(ibox.ConvsUnverified)
		res.UserJoinedConvs = ibox.Convs
	}

	for _, r := range resets {
		if r.Uid.Eq(uid) {
			res.UserResetConvs = append(res.UserResetConvs, r)
		} else {
			res.OthersResetConvs = append(res.OthersResetConvs, r)
		}
	}

	ib := storage.NewInbox(s.G())
	if cerr := ib.MembershipUpdate(ctx, uid, vers, userJoinedConvs, res.UserRemovedConvs,
		res.OthersJoinedConvs, res.OthersRemovedConvs, res.UserResetConvs, res.OthersResetConvs); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return res, err
	}

	return res, nil
}

func (s *HybridInboxSource) Expunge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
	expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (*chat1.ConversationLocal, error) {
	return s.modConversation(ctx, "Expunge", uid, convID, func(ctx context.Context, ib *storage.Inbox) error {
		return ib.Expunge(ctx, uid, vers, convID, expunge, maxMsgs)
	})
}

func (s *HybridInboxSource) SetConvRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, policy chat1.RetentionPolicy) (res *chat1.ConversationLocal, err error) {
	return s.modConversation(ctx, "SetConvRetention", uid, convID, func(ctx context.Context, ib *storage.Inbox) error {
		return ib.SetConvRetention(ctx, uid, vers, convID, policy)
	})
}

func (s *HybridInboxSource) SetTeamRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy) (convs []chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "SetTeamRetention")()
	ib := storage.NewInbox(s.G())
	convIDs, cerr := ib.SetTeamRetention(ctx, uid, vers, teamID, policy)
	if cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if convs, err = s.getConvsLocal(ctx, uid, convIDs); err != nil {
		s.Debug(ctx, "SetTeamRetention: unable to load conversations: convIDs: %v err: %s",
			convIDs, err.Error())
		return nil, nil
	}
	return convs, nil
}

func (s *HybridInboxSource) SetConvSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, convSettings *chat1.ConversationSettings) (res *chat1.ConversationLocal, err error) {
	return s.modConversation(ctx, "SetConvSettings", uid, convID, func(ctx context.Context, ib *storage.Inbox) error {
		return ib.SetConvSettings(ctx, uid, vers, convID, convSettings)
	})
}

func (s *HybridInboxSource) SubteamRename(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID) (convs []chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "SubteamRename")()
	ib := storage.NewInbox(s.G())
	if cerr := ib.SubteamRename(ctx, uid, vers, convIDs); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if convs, err = s.getConvsLocal(ctx, uid, convIDs); err != nil {
		s.Debug(ctx, "SubteamRename: unable to load conversations: convIDs: %v err: %s",
			convIDs, err.Error())
		return nil, nil
	}
	return convs, nil
}

func (s *HybridInboxSource) modConversation(ctx context.Context, debugLabel string, uid gregor1.UID, convID chat1.ConversationID,
	mod func(context.Context, *storage.Inbox) error) (
	conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, debugLabel)()
	ib := storage.NewInbox(s.G())
	if cerr := mod(ctx, ib); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "%v: unable to load conversation: convID: %s err: %s",
			debugLabel, convID, err.Error())
		return nil, nil
	}
	return conv, nil
}

func NewInboxSource(g *globals.Context, typ string, ri func() chat1.RemoteInterface) types.InboxSource {
	remoteInbox := NewRemoteInboxSource(g, ri)
	switch typ {
	case "hybrid":
		return NewHybridInboxSource(g, ri)
	default:
		return remoteInbox
	}
}
