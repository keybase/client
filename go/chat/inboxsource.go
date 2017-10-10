package chat

import (
	"errors"
	"fmt"
	"sort"

	"github.com/keybase/client/go/teams"

	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type localizerPipeline struct {
	globals.Contextified
	utils.DebugLabeler

	offline    bool
	superXform supersedesTransform
}

func newLocalizerPipeline(g *globals.Context, superXform supersedesTransform) *localizerPipeline {
	return &localizerPipeline{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "localizerPipeline", false),
		superXform:   superXform,
	}
}

type BlockingLocalizer struct {
	globals.Contextified
	pipeline *localizerPipeline
}

func NewBlockingLocalizer(g *globals.Context) *BlockingLocalizer {
	return &BlockingLocalizer{
		Contextified: globals.NewContextified(g),
		pipeline:     newLocalizerPipeline(g, newBasicSupersedesTransform(g)),
	}
}

func (b *BlockingLocalizer) SetOffline() {
	b.pipeline.offline = true
}

func (b *BlockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox) (res []chat1.ConversationLocal, err error) {
	res, err = b.pipeline.localizeConversationsPipeline(ctx, uid, utils.PluckConvs(inbox.ConvsUnverified),
		nil, nil)
	if err != nil {
		return res, err
	}

	return res, nil
}

func (b *BlockingLocalizer) Name() string {
	return "blocking"
}

type NonblockInboxResult struct {
	Conv     chat1.Conversation
	Err      *chat1.ConversationErrorLocal
	ConvRes  *chat1.ConversationLocal
	InboxRes *types.Inbox
}

type NonblockingLocalizer struct {
	globals.Contextified
	utils.DebugLabeler

	pipeline   *localizerPipeline
	localizeCb chan NonblockInboxResult
	maxUnbox   *int
}

func NewNonblockingLocalizer(g *globals.Context, localizeCb chan NonblockInboxResult,
	maxUnbox *int) *NonblockingLocalizer {
	return &NonblockingLocalizer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "NonblockingLocalizer", false),
		pipeline:     newLocalizerPipeline(g, newBasicSupersedesTransform(g)),
		localizeCb:   localizeCb,
		maxUnbox:     maxUnbox,
	}
}

func (b *NonblockingLocalizer) SetOffline() {
	b.pipeline.offline = true
}

func (b *NonblockingLocalizer) filterInboxRes(ctx context.Context, inbox types.Inbox, uid gregor1.UID) types.Inbox {
	defer b.Trace(ctx, func() error { return nil }, "filterInboxRes")()

	// Loop through and look for empty convs or known errors and skip them
	var res []types.RemoteConversation
	for _, conv := range inbox.ConvsUnverified {
		if utils.IsConvEmpty(conv.Conv) {
			b.Debug(ctx, "filterInboxRes: skipping because empty: convID: %s", conv.Conv.GetConvID())
			continue
		}
		res = append(res, conv)
	}

	return types.Inbox{
		Version:         inbox.Version,
		ConvsUnverified: res,
		Convs:           inbox.Convs,
		Pagination:      inbox.Pagination,
	}
}

func (b *NonblockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox) (res []chat1.ConversationLocal, err error) {
	defer b.Trace(ctx, func() error { return err }, "Localize")()

	// Run some easy filters for empty messages and known errors to optimize UI drawing behavior
	filteredInbox := b.filterInboxRes(ctx, inbox, uid)

	// Send inbox over localize channel
	b.localizeCb <- NonblockInboxResult{
		InboxRes: &filteredInbox,
	}

	// Spawn off localization into its own goroutine and use cb to communicate with outside world
	bctx := BackgroundContext(ctx, b.G())
	go func() {
		b.Debug(bctx, "Localize: starting background localization: convs: %d",
			len(inbox.ConvsUnverified))
		b.pipeline.localizeConversationsPipeline(bctx, uid, utils.PluckConvs(inbox.ConvsUnverified),
			b.maxUnbox, &b.localizeCb)

		// Shutdown localize channel
		close(b.localizeCb)
	}()

	return nil, nil
}

func (b *NonblockingLocalizer) Name() string {
	return "nonblocking"
}

func filterConvLocals(convLocals []chat1.ConversationLocal, rquery *chat1.GetInboxQuery,
	query *chat1.GetInboxLocalQuery, nameInfo types.NameInfo) (res []chat1.ConversationLocal, err error) {

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
	types.InboxSource

	getChatInterface func() chat1.RemoteInterface
}

func newBaseInboxSource(g *globals.Context, ibs types.InboxSource,
	getChatInterface func() chat1.RemoteInterface) *baseInboxSource {
	return &baseInboxSource{
		Contextified:     globals.NewContextified(g),
		InboxSource:      ibs,
		DebugLabeler:     utils.NewDebugLabeler(g.GetLog(), "baseInboxSource", false),
		getChatInterface: getChatInterface,
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
	lquery *chat1.GetInboxLocalQuery) (rquery *chat1.GetInboxQuery, info types.NameInfo, err error) {

	if lquery == nil {
		return nil, info, nil
	}

	rquery = &chat1.GetInboxQuery{}
	if lquery.Name != nil && len(lquery.Name.Name) > 0 {
		var err error
		info, err = CtxKeyFinder(ctx, b.G()).Find(ctx, lquery.Name.Name, lquery.Name.MembersType,
			lquery.Visibility() == keybase1.TLFVisibility_PUBLIC)
		if err != nil {
			return nil, info, err
		}
		rquery.TlfID = &info.ID
		b.Debug(ctx, "GetInboxQueryLocalToRemote: mapped name %q to TLFID %v",
			lquery.Name.Name, info.ID)
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

func (b *baseInboxSource) IsMember(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (bool, *chat1.RateLimit, error) {
	ib, rl, err := b.ReadUnverified(ctx, uid, true, &chat1.GetInboxQuery{
		ConvID: &convID,
	}, nil)
	if err != nil {
		return false, rl, err
	}
	if len(ib.ConvsUnverified) == 0 {
		return false, rl, fmt.Errorf("conversation not found: %s", convID)
	}
	conv := ib.ConvsUnverified[0]
	switch conv.Conv.ReaderInfo.Status {
	case chat1.ConversationMemberStatus_ACTIVE, chat1.ConversationMemberStatus_RESET:
		return true, rl, nil
	default:
		return false, rl, nil
	}
}

func GetInboxQueryNameInfo(ctx context.Context, g *globals.Context,
	lquery *chat1.GetInboxLocalQuery) (types.NameInfo, error) {
	if lquery.Name == nil || len(lquery.Name.Name) == 0 {
		return types.NameInfo{}, nil
	}
	return CtxKeyFinder(ctx, g).Find(ctx, lquery.Name.Name, lquery.Name.MembersType,
		lquery.Visibility() == keybase1.TLFVisibility_PUBLIC)
}

type RemoteInboxSource struct {
	globals.Contextified
	utils.DebugLabeler
	*baseInboxSource
	*sourceOfflinable
}

var _ types.InboxSource = (*RemoteInboxSource)(nil)

func NewRemoteInboxSource(g *globals.Context, ri func() chat1.RemoteInterface) *RemoteInboxSource {
	labeler := utils.NewDebugLabeler(g.GetLog(), "RemoteInboxSource", false)
	s := &RemoteInboxSource{
		Contextified:     globals.NewContextified(g),
		DebugLabeler:     labeler,
		sourceOfflinable: newSourceOfflinable(labeler),
	}
	s.baseInboxSource = newBaseInboxSource(g, s, ri)
	return s
}

func (s *RemoteInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizer types.ChatLocalizer, useLocalData bool, query *chat1.GetInboxLocalQuery,
	p *chat1.Pagination) (types.Inbox, *chat1.RateLimit, error) {

	if localizer == nil {
		localizer = NewBlockingLocalizer(s.G())
	}
	if s.IsOffline(ctx) {
		localizer.SetOffline()
	}
	s.Debug(ctx, "Read: using localizer: %s", localizer.Name())

	rquery, tlfInfo, err := s.GetInboxQueryLocalToRemote(ctx, query)
	if err != nil {
		return types.Inbox{}, nil, err
	}
	inbox, rl, err := s.ReadUnverified(ctx, uid, useLocalData, rquery, p)
	if err != nil {
		return types.Inbox{}, rl, err
	}

	res, err := localizer.Localize(ctx, uid, inbox)
	if err != nil {
		return types.Inbox{}, rl, err
	}

	res, err = filterConvLocals(res, rquery, query, tlfInfo)
	if err != nil {
		return types.Inbox{}, rl, err
	}

	return types.Inbox{
		Version:         inbox.Version,
		Convs:           res,
		ConvsUnverified: inbox.ConvsUnverified,
		Pagination:      inbox.Pagination,
	}, rl, nil
}

func (s *RemoteInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
	rquery *chat1.GetInboxQuery, p *chat1.Pagination) (types.Inbox, *chat1.RateLimit, error) {

	if s.IsOffline(ctx) {
		return types.Inbox{}, nil, OfflineError{}
	}

	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      rquery,
		Pagination: p,
	})
	if err != nil {
		return types.Inbox{}, ib.RateLimit, err
	}

	return types.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: utils.RemoteConvs(ib.Inbox.Full().Conversations),
		Pagination:      ib.Inbox.Full().Pagination,
	}, ib.RateLimit, nil
}

func (s *RemoteInboxSource) NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	conv chat1.Conversation) error {
	return nil
}

func (s *RemoteInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed) (*chat1.ConversationLocal, error) {
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
	joined []chat1.ConversationMember, removed []chat1.ConversationMember, resets []chat1.ConversationMember) (res types.MembershipUpdateRes, err error) {
	return res, err
}

type HybridInboxSource struct {
	globals.Contextified
	utils.DebugLabeler
	*baseInboxSource
	*sourceOfflinable
}

var _ types.InboxSource = (*HybridInboxSource)(nil)

func NewHybridInboxSource(g *globals.Context,
	getChatInterface func() chat1.RemoteInterface) *HybridInboxSource {
	labeler := utils.NewDebugLabeler(g.GetLog(), "HybridInboxSource", false)
	s := &HybridInboxSource{
		Contextified:     globals.NewContextified(g),
		DebugLabeler:     labeler,
		sourceOfflinable: newSourceOfflinable(labeler),
	}
	s.baseInboxSource = newBaseInboxSource(g, s, getChatInterface)
	return s
}

func (s *HybridInboxSource) fetchRemoteInbox(ctx context.Context, query *chat1.GetInboxQuery,
	p *chat1.Pagination) (types.Inbox, *chat1.RateLimit, error) {

	// Insta fail if we are offline
	if s.IsOffline(ctx) {
		return types.Inbox{}, nil, OfflineError{}
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
		return types.Inbox{}, ib.RateLimit, err
	}

	return types.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: utils.RemoteConvs(ib.Inbox.Full().Conversations),
		Pagination:      ib.Inbox.Full().Pagination,
	}, ib.RateLimit, nil
}

func (s *HybridInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizer types.ChatLocalizer, useLocalData bool, query *chat1.GetInboxLocalQuery,
	p *chat1.Pagination) (inbox types.Inbox, rl *chat1.RateLimit, err error) {

	defer s.Trace(ctx, func() error { return err }, "Read")()
	if localizer == nil {
		localizer = NewBlockingLocalizer(s.G())
	}
	if s.IsOffline(ctx) {
		localizer.SetOffline()
	}
	s.Debug(ctx, "Read: using localizer: %s", localizer.Name())

	// Read unverified inbox
	rquery, tlfInfo, err := s.GetInboxQueryLocalToRemote(ctx, query)
	if err != nil {
		return inbox, rl, err
	}
	inbox, rl, err = s.ReadUnverified(ctx, uid, useLocalData, rquery, p)
	if err != nil {
		return inbox, rl, err
	}

	// Localize
	inbox.Convs, err = localizer.Localize(ctx, uid, inbox)
	if err != nil {
		return inbox, rl, err
	}

	// Run post filters
	inbox.Convs, err = filterConvLocals(inbox.Convs, rquery, query, tlfInfo)
	if err != nil {
		return inbox, rl, err
	}

	// Write metadata to the inbox cache
	if err = storage.NewInbox(s.G(), uid).MergeLocalMetadata(ctx, inbox.Convs); err != nil {
		// Don't abort the operaton on this kind of error
		s.Debug(ctx, "Read: unable to write inbox local metadata: %s", err)
	}

	return inbox, rl, nil
}

func (s *HybridInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
	query *chat1.GetInboxQuery, p *chat1.Pagination) (res types.Inbox, rl *chat1.RateLimit, err error) {
	defer s.Trace(ctx, func() error { return err }, "ReadUnverified")()

	var cerr storage.Error
	inboxStore := storage.NewInbox(s.G(), uid)

	// Try local storage (if enabled)
	if useLocalData {
		var vers chat1.InboxVers
		var convs []types.RemoteConversation
		var pagination *chat1.Pagination
		vers, convs, pagination, cerr = inboxStore.Read(ctx, query, p)
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
		res, rl, err = s.fetchRemoteInbox(ctx, query, p)
		if err != nil {
			return res, rl, err
		}

		// Write out to local storage only if we are using local daata
		if useLocalData {
			if cerr = inboxStore.Merge(ctx, res.Version, utils.PluckConvs(res.ConvsUnverified), query, p); cerr != nil {
				s.Debug(ctx, "ReadUnverified: failed to write inbox to local storage: %s", cerr.Error())
			}
		}
	}

	return res, rl, err
}

func (s *HybridInboxSource) handleInboxError(ctx context.Context, err error, uid gregor1.UID) (ferr error) {
	defer func() {
		if ferr != nil {
			s.Debug(ctx, "handleInboxError: failed to recover from inbox error, clearing: %s",
				ferr.Error())
			storage.NewInbox(s.G(), uid).Clear(ctx)
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
	if cerr := storage.NewInbox(s.G(), uid).NewConversation(ctx, vers, conv); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return err
	}

	return nil
}

func (s *HybridInboxSource) getConvLocal(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	// Read back affected conversation so we can send it to the frontend
	ib, _, err := s.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
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

func (s *HybridInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "NewMessage")()
	if cerr := storage.NewInbox(s.G(), uid).NewMessage(ctx, vers, convID, msg); cerr != nil {
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
	if cerr := storage.NewInbox(s.G(), uid).ReadMessage(ctx, vers, convID, msgID); cerr != nil {
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
	if cerr := storage.NewInbox(s.G(), uid).SetStatus(ctx, vers, convID, status); cerr != nil {
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
	ib := storage.NewInbox(s.G(), uid)
	if cerr := ib.SetAppNotificationSettings(ctx, vers, convID, settings); cerr != nil {
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
	ib := storage.NewInbox(s.G(), uid)
	if cerr := ib.TeamTypeChanged(ctx, vers, convID, teamType); cerr != nil {
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

func (s *HybridInboxSource) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) (convs []chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "TlfFinalize")()

	if cerr := storage.NewInbox(s.G(), uid).TlfFinalize(ctx, vers, convIDs, finalizeInfo); cerr != nil {
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
	joined []chat1.ConversationMember, removed []chat1.ConversationMember, resets []chat1.ConversationMember) (res types.MembershipUpdateRes, err error) {
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
	for _, r := range removed {
		if r.Uid.Eq(uid) {
			res.UserRemovedConvs = append(res.UserRemovedConvs, r.ConvID)
		} else {
			res.OthersRemovedConvs = append(res.OthersRemovedConvs, r)
		}
	}

	// Load the user joined conversations
	var userJoinedConvs []chat1.Conversation
	if len(userJoined) > 0 {
		var ibox types.Inbox
		ibox, _, err = s.Read(ctx, uid, nil, false, &chat1.GetInboxLocalQuery{
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
			res.UserResetConvs = append(res.UserResetConvs, r.ConvID)
		} else {
			res.OthersResetConvs = append(res.OthersResetConvs, r)
		}
	}

	ib := storage.NewInbox(s.G(), uid)
	if cerr := ib.MembershipUpdate(ctx, vers, userJoinedConvs, res.UserRemovedConvs,
		res.OthersJoinedConvs, res.OthersRemovedConvs, res.UserResetConvs, res.OthersResetConvs); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return res, err
	}

	return res, nil
}

func (s *localizerPipeline) localizeConversationsPipeline(ctx context.Context, uid gregor1.UID,
	convs []chat1.Conversation, maxUnbox *int, localizeCb *chan NonblockInboxResult) ([]chat1.ConversationLocal, error) {

	// Fetch conversation local information in parallel
	type jobRes struct {
		conv  chat1.ConversationLocal
		index int
	}
	type job struct {
		conv  chat1.Conversation
		index int
	}

	if maxUnbox != nil {
		s.Debug(ctx, "pipeline: maxUnbox set to: %d", *maxUnbox)
	}
	eg, ctx := errgroup.WithContext(ctx)
	convCh := make(chan job)
	retCh := make(chan jobRes)
	eg.Go(func() error {
		defer close(convCh)
		for i, conv := range convs {
			if maxUnbox != nil && i >= *maxUnbox {
				s.Debug(ctx, "pipeline: maxUnbox set and reached, early exit: %d",
					*maxUnbox)
				return nil
			}
			select {
			case convCh <- job{conv: conv, index: i}:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return nil
	})
	for i := 0; i < 10; i++ {
		eg.Go(func() error {
			for conv := range convCh {
				convLocal := s.localizeConversation(ctx, uid, conv.conv)

				jr := jobRes{
					conv:  convLocal,
					index: conv.index,
				}
				select {
				case retCh <- jr:
				case <-ctx.Done():
					return ctx.Err()
				}

				// If a localize callback channel exists, send along the result as well
				if localizeCb != nil {
					if convLocal.Error != nil {
						s.Debug(ctx, "error localizing: convID: %s err: %s", conv.conv.GetConvID(),
							convLocal.Error.Message)
						*localizeCb <- NonblockInboxResult{
							Err:  convLocal.Error,
							Conv: conv.conv,
						}
					} else {
						*localizeCb <- NonblockInboxResult{
							ConvRes: &convLocal,
							Conv:    conv.conv,
						}
					}
				}
			}
			return nil
		})
	}
	go func() {
		eg.Wait()
		close(retCh)
	}()
	res := make([]chat1.ConversationLocal, len(convs))
	for c := range retCh {
		res[c.index] = c.conv
	}
	if err := eg.Wait(); err != nil {
		return nil, err
	}
	return res, nil
}

func (s *localizerPipeline) needsCanonicalize(name string) bool {
	return strings.Contains(name, "@") || strings.Contains(name, ":")
}

func (s *localizerPipeline) isErrPermanent(err error) bool {
	if uberr, ok := err.(UnboxingError); ok {
		return uberr.IsPermanent()
	}
	return false
}

func getUnverifiedTlfNameForErrors(conversationRemote chat1.Conversation) string {
	var tlfName string
	var latestMsgID chat1.MessageID
	for _, msg := range conversationRemote.MaxMsgSummaries {
		if msg.GetMessageID() > latestMsgID {
			latestMsgID = msg.GetMessageID()
			tlfName = msg.TLFNameExpanded(conversationRemote.Metadata.FinalizeInfo)
		}
	}
	return tlfName
}

type nullUsernameSource struct {
}

func (n nullUsernameSource) LookupUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	return "", errors.New("null username loader always fails")
}

func (s *localizerPipeline) getMessagesOffline(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageSummary, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, chat1.ConversationErrorType, error) {

	st := storage.New(s.G())
	res, err := st.FetchMessages(ctx, convID, uid, utils.PluckMessageIDs(msgs))
	if err != nil {
		// Just say we didn't find it in this case
		return nil, chat1.ConversationErrorType_TRANSIENT, err
	}

	// Make sure we got legit msgs
	var foundMsgs []chat1.MessageUnboxed
	for _, msg := range res {
		if msg != nil {
			foundMsgs = append(foundMsgs, *msg)
		}
	}

	if len(foundMsgs) == 0 {
		return nil, chat1.ConversationErrorType_TRANSIENT, errors.New("missing messages locally")
	}

	return foundMsgs, chat1.ConversationErrorType_NONE, nil
}

func (s *localizerPipeline) getResetUserNames(ctx context.Context, uidMapper libkb.UIDMapper,
	conv chat1.Conversation) (res []string) {
	if len(conv.Metadata.ResetList) == 0 {
		return res
	}

	var kuids []keybase1.UID
	for _, uid := range conv.Metadata.ResetList {
		kuids = append(kuids, keybase1.UID(uid.String()))
	}
	rows, err := uidMapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, 0, 0, false)
	if err != nil {
		s.Debug(ctx, "getResetUserNames: failed to run uid mapper: %s", err)
		return res
	}
	for _, row := range rows {
		res = append(res, row.NormalizedUsername.String())
	}
	return res
}

func (s *localizerPipeline) localizeConversation(ctx context.Context, uid gregor1.UID,
	conversationRemote chat1.Conversation) (conversationLocal chat1.ConversationLocal) {

	// Pick a source of usernames based on offline status, if we are offline then just use a
	// type that just returns errors all the time (this will just use TLF name as the ordering)
	var uloader utils.ReorderUsernameSource
	if s.offline {
		uloader = nullUsernameSource{}
	} else {
		uloader = s.G().GetUPAKLoader()
	}

	unverifiedTLFName := getUnverifiedTlfNameForErrors(conversationRemote)
	s.Debug(ctx, "localizing: TLF: %s convID: %s offline: %v vis: %v", unverifiedTLFName,
		conversationRemote.GetConvID(), s.offline, conversationRemote.Metadata.Visibility)

	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id:           conversationRemote.Metadata.ConversationID,
		Visibility:   conversationRemote.Metadata.Visibility,
		Triple:       conversationRemote.Metadata.IdTriple,
		Status:       conversationRemote.Metadata.Status,
		MembersType:  conversationRemote.Metadata.MembersType,
		MemberStatus: conversationRemote.ReaderInfo.Status,
		TeamType:     conversationRemote.Metadata.TeamType,
		Version:      conversationRemote.Metadata.Version,
	}
	conversationLocal.Info.FinalizeInfo = conversationRemote.Metadata.FinalizeInfo
	for _, super := range conversationRemote.Metadata.Supersedes {
		conversationLocal.Supersedes = append(conversationLocal.Supersedes, super)
	}
	for _, super := range conversationRemote.Metadata.SupersededBy {
		conversationLocal.SupersededBy = append(conversationLocal.SupersededBy, super)
	}
	if conversationRemote.ReaderInfo == nil {
		errMsg := "empty ReaderInfo from server?"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}
	conversationLocal.ReaderInfo = *conversationRemote.ReaderInfo
	conversationLocal.Notifications = conversationRemote.Notifications
	if conversationRemote.CreatorInfo != nil {
		nname, err := uloader.LookupUsername(ctx, keybase1.UID(conversationRemote.CreatorInfo.Uid.String()))
		if err != nil {
			s.Debug(ctx, "localizeConversation: failed to load creator username: %s", err)
		} else {
			conversationLocal.CreatorInfo = &chat1.ConversationCreatorInfoLocal{
				Username: nname.String(),
				Ctime:    conversationRemote.CreatorInfo.Ctime,
			}
		}
	}

	if len(conversationRemote.MaxMsgSummaries) == 0 {
		errMsg := "conversation has an empty MaxMsgSummaries field"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}

	conversationLocal.IsEmpty = utils.IsConvEmpty(conversationRemote)
	errTyp := chat1.ConversationErrorType_PERMANENT
	if len(conversationRemote.MaxMsgs) == 0 {
		// Fetch max messages unboxed, using either a custom function or through
		// the conversation source configured in the global context
		var err error
		var msgs []chat1.MessageUnboxed
		if s.offline {
			msgs, errTyp, err = s.getMessagesOffline(ctx, conversationRemote.GetConvID(),
				uid, conversationRemote.MaxMsgSummaries, conversationRemote.Metadata.FinalizeInfo)
		} else {
			msgs, err = s.G().ConvSource.GetMessages(ctx, conversationRemote,
				uid, utils.PluckMessageIDs(conversationRemote.MaxMsgSummaries))
			if !s.isErrPermanent(err) {
				errTyp = chat1.ConversationErrorType_TRANSIENT
			}
		}
		if err != nil {
			convErr := s.checkRekeyError(ctx, err, conversationRemote, unverifiedTLFName)
			if convErr != nil {
				conversationLocal.Error = convErr
				return conversationLocal
			}
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				err.Error(), conversationRemote, unverifiedTLFName, errTyp, nil)
			return conversationLocal
		}
		conversationLocal.MaxMessages = msgs
	} else {
		// Use the attached MaxMsgs
		msgs, err := s.G().ConvSource.GetMessagesWithRemotes(ctx,
			conversationRemote, uid, conversationRemote.MaxMsgs)
		if err != nil {
			convErr := s.checkRekeyError(ctx, err, conversationRemote, unverifiedTLFName)
			if convErr != nil {
				conversationLocal.Error = convErr
				return conversationLocal
			}
			if !s.isErrPermanent(err) {
				errTyp = chat1.ConversationErrorType_TRANSIENT
			}
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				err.Error(), conversationRemote, unverifiedTLFName, errTyp, nil)
			return conversationLocal
		}
		conversationLocal.MaxMessages = msgs
	}

	var maxValidID chat1.MessageID
	var newMaxMsgs []chat1.MessageUnboxed
	for _, mm := range conversationLocal.MaxMessages {
		if mm.IsValid() {
			body := mm.Valid().MessageBody
			typ, err := body.MessageType()
			if err != nil {
				s.Debug(ctx, "failed to get message type: convID: %s id: %d",
					conversationRemote.Metadata.ConversationID, mm.GetMessageID())
				continue
			}
			if typ == chat1.MessageType_METADATA {
				conversationLocal.Info.TopicName = body.Metadata().ConversationTitle
			}

			if mm.GetMessageID() >= maxValidID {
				conversationLocal.Info.TlfName = mm.Valid().ClientHeader.TlfName
				maxValidID = mm.GetMessageID()
			}

			conversationLocal.Info.Triple = mm.Valid().ClientHeader.Conv

			// Resolve edits/deletes
			var newMsg []chat1.MessageUnboxed
			if newMsg, err = s.superXform.Run(ctx, conversationRemote, uid, []chat1.MessageUnboxed{mm}); err != nil {
				s.Debug(ctx, "failed to transform message: id: %d err: %s", mm.GetMessageID(),
					err.Error())
			} else {
				if len(newMsg) > 0 {
					newMaxMsgs = append(newMaxMsgs, newMsg[0])
				}
			}
		}
	}
	conversationLocal.MaxMessages = newMaxMsgs
	if len(conversationLocal.Info.TlfName) == 0 {
		errMsg := "no valid message in the conversation"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}

	// Verify ConversationID is derivable from ConversationIDTriple
	if !conversationLocal.Info.Triple.Derivable(conversationLocal.Info.Id) {
		errMsg := fmt.Sprintf("unexpected response from server: conversation ID is not derivable from conversation triple. triple: %#+v; Id: %x",
			conversationLocal.Info.Triple, conversationLocal.Info.Id)
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}

	// verify Conv matches ConversationIDTriple in MessageClientHeader
	if !conversationRemote.Metadata.IdTriple.Eq(conversationLocal.Info.Triple) {
		errMsg := "server header conversation triple does not match client header triple"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}

	// Only do this check if there is a chance the TLF name might be an SBS name. Only attempt
	// this if we are online
	if !s.offline && s.needsCanonicalize(conversationLocal.Info.TlfName) {
		info, err := CtxKeyFinder(ctx, s.G()).Find(ctx,
			conversationLocal.Info.TLFNameExpanded(), conversationLocal.GetMembersType(),
			conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC)
		if err != nil {
			errMsg := err.Error()
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT,
				nil)
			return conversationLocal
		}
		// Not sure about the utility of this TlfName assignment, but the previous code did this:
		conversationLocal.Info.TlfName = info.CanonicalName
	}

	// Form the writers name list, either from the active list + TLF name, or from the
	// channel information for a team chat
	switch conversationRemote.GetMembersType() {
	case chat1.ConversationMembersType_IMPTEAM:
		teamID, err := tlfIDToTeamdID(conversationLocal.Info.Triple.Tlfid)
		if err != nil {
			errMsg := fmt.Sprintf("error parsing impteam TLFID: %v", err.Error())
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_PERMANENT, nil)
			return conversationLocal
		}
		ok := true
		var errMsg string
		s.Debug(ctx, "localizeConversation: trying to load team for %v chat", conversationLocal.Info.Visibility)
		iteam, err := teams.Load(ctx, s.G().ExternalG(), keybase1.LoadTeamArg{
			ID:     teamID,
			Public: conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC,
		})
		if err != nil {
			ok = false
			errMsg = fmt.Sprintf("unable to load iteam: %v", err.Error())
		}
		var iteamName string
		if ok {
			iteamName, err = iteam.ImplicitTeamDisplayNameString(ctx)
			if err != nil {
				ok = false
				errMsg = fmt.Sprintf("failed to read : %v", err.Error())
			}
		}
		if ok {
			conversationLocal.Info.ResetNames = s.getResetUserNames(ctx, s.G().UIDMapper, conversationRemote)
			conversationLocal.Info.WriterNames, conversationLocal.Info.ReaderNames, err = utils.ReorderParticipants(
				ctx,
				uloader,
				iteamName,
				conversationRemote.Metadata.ActiveList)
			if err != nil {
				ok = false
				errMsg = fmt.Sprintf("error reordering participants: %v", err.Error())
			}
		}
		if !ok {
			s.Debug(ctx, "localizeConversation: failed to get implicit team members: %s", errMsg)
		}
	case chat1.ConversationMembersType_TEAM:
		var kuids []keybase1.UID
		for _, uid := range conversationRemote.Metadata.AllList {
			kuids = append(kuids, keybase1.UID(uid.String()))
		}

		conversationLocal.Info.ResetNames = s.getResetUserNames(ctx, s.G().UIDMapper, conversationRemote)
		rows, err := s.G().UIDMapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, 0, 0, false)
		unames := make([]libkb.NormalizedUsername, len(rows), len(rows))
		for i, row := range rows {
			unames[i] = row.NormalizedUsername
		}

		if err == nil {
			for _, uname := range unames {
				conversationLocal.Info.WriterNames = append(conversationLocal.Info.WriterNames,
					uname.String())
			}
			// Sort alphabetically
			sort.Slice(conversationLocal.Info.WriterNames, func(i, j int) bool {
				return conversationLocal.Info.WriterNames[i] < conversationLocal.Info.WriterNames[j]
			})
		} else {
			// If we are offline, we just won't know who is in the channel
			s.Debug(ctx, "localizeConversation: failed to get team channel usernames: %s", err)
		}
	case chat1.ConversationMembersType_KBFS:
		var err error
		conversationLocal.Info.WriterNames, conversationLocal.Info.ReaderNames, err = utils.ReorderParticipants(
			ctx,
			uloader,
			conversationLocal.Info.TlfName,
			conversationRemote.Metadata.ActiveList)
		if err != nil {
			errMsg := fmt.Sprintf("error reordering participants: %v", err.Error())
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
			return conversationLocal
		}
	default:
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			"unknown members type", conversationRemote, unverifiedTLFName,
			chat1.ConversationErrorType_PERMANENT, nil)
		return conversationLocal
	}

	return conversationLocal
}

// Checks fromErr to see if it is a rekey error.
// Returns a ConversationErrorLocal if it is a rekey error.
// Returns nil otherwise.
func (s *localizerPipeline) checkRekeyError(ctx context.Context, fromErr error, conversationRemote chat1.Conversation, unverifiedTLFName string) *chat1.ConversationErrorLocal {
	if fromErr == nil {
		return nil
	}
	convErr, err2 := s.checkRekeyErrorInner(ctx, fromErr, conversationRemote, unverifiedTLFName)
	if err2 != nil {
		errMsg := fmt.Sprintf("failed to get rekey info: convID: %s: %s",
			conversationRemote.Metadata.ConversationID, err2.Error())
		return chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
	}
	if convErr != nil {
		return convErr
	}
	return nil
}

// Checks fromErr to see if it is a rekey error.
// Returns (ConversationErrorRekey, nil) if it is
// Returns (nil, nil) if it is a different kind of error
// Returns (nil, err) if there is an error building the ConversationErrorRekey
func (s *localizerPipeline) checkRekeyErrorInner(ctx context.Context, fromErr error, conversationRemote chat1.Conversation, unverifiedTLFName string) (*chat1.ConversationErrorLocal, error) {
	convErrTyp := chat1.ConversationErrorType_TRANSIENT
	var rekeyInfo *chat1.ConversationErrorRekey

	switch fromErr := fromErr.(type) {
	case UnboxingError:
		switch fromErr := fromErr.Inner().(type) {
		case libkb.NeedSelfRekeyError:
			convErrTyp = chat1.ConversationErrorType_SELFREKEYNEEDED
			rekeyInfo = &chat1.ConversationErrorRekey{
				TlfName: fromErr.Tlf,
			}
		case libkb.NeedOtherRekeyError:
			convErrTyp = chat1.ConversationErrorType_OTHERREKEYNEEDED
			rekeyInfo = &chat1.ConversationErrorRekey{
				TlfName: fromErr.Tlf,
			}
		}
	}
	if rekeyInfo == nil {
		// Not a rekey error.
		return nil, nil
	}

	if len(conversationRemote.MaxMsgSummaries) == 0 {
		return nil, errors.New("can't determine isPrivate with no maxMsgs")
	}
	rekeyInfo.TlfPublic = conversationRemote.MaxMsgSummaries[0].TlfPublic

	// Fill readers and writers
	writerNames, readerNames, err := utils.ReorderParticipants(
		ctx,
		s.G().GetUPAKLoader(),
		rekeyInfo.TlfName,
		conversationRemote.Metadata.ActiveList)
	if err != nil {
		return nil, err
	}
	rekeyInfo.WriterNames = writerNames
	rekeyInfo.ReaderNames = readerNames

	// Fill rekeyers list
	myUsername := string(s.G().Env.GetUsername())
	rekeyExcludeSelf := (convErrTyp != chat1.ConversationErrorType_SELFREKEYNEEDED)
	for _, w := range writerNames {
		if rekeyExcludeSelf && w == myUsername {
			// Skip self if self can't rekey.
			continue
		}
		if strings.Contains(w, "@") {
			// Skip assertions. They can't rekey.
			continue
		}
		rekeyInfo.Rekeyers = append(rekeyInfo.Rekeyers, w)
	}

	convErrorLocal := chat1.NewConversationErrorLocal(
		fromErr.Error(), conversationRemote, unverifiedTLFName, convErrTyp, rekeyInfo)
	return convErrorLocal, nil
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
