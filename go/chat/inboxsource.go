package chat

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/client/go/uidmap"
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

type baseLocalizer struct {
	globals.Contextified
	utils.DebugLabeler
}

func newBaseLocalizer(g *globals.Context) *baseLocalizer {
	return &baseLocalizer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "baseLocalizer", false),
	}
}

func (b *baseLocalizer) filterSelfFinalized(ctx context.Context, inbox types.Inbox) (res types.Inbox) {
	username := b.G().Env.GetUsername().String()
	res = inbox
	res.ConvsUnverified = nil
	for _, conv := range inbox.ConvsUnverified {
		if conv.Conv.GetMembersType() == chat1.ConversationMembersType_KBFS &&
			conv.Conv.GetFinalizeInfo() != nil &&
			// If reset user is the current user, or is blank (only way such a thing could be in our
			// inbox is if the current user is the one that reset)
			(conv.Conv.GetFinalizeInfo().ResetUser == username ||
				conv.Conv.GetFinalizeInfo().ResetUser == "") {
			b.Debug(ctx, "baseLocalizer: skipping own finalized convo: %s name: %s", conv.GetConvID())
			continue
		}
		res.ConvsUnverified = append(res.ConvsUnverified, conv)
	}
	return res
}

type BlockingLocalizer struct {
	globals.Contextified
	*baseLocalizer
	pipeline *localizerPipeline
}

func NewBlockingLocalizer(g *globals.Context) *BlockingLocalizer {
	return &BlockingLocalizer{
		Contextified:  globals.NewContextified(g),
		baseLocalizer: newBaseLocalizer(g),
		pipeline: newLocalizerPipeline(g,
			newBasicSupersedesTransform(g, basicSupersedesTransformOpts{})),
	}
}

func (b *BlockingLocalizer) SetOffline() {
	b.pipeline.offline = true
}

func (b *BlockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox) (res []chat1.ConversationLocal, err error) {
	inbox = b.filterSelfFinalized(ctx, inbox)
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
	*baseLocalizer

	pipeline   *localizerPipeline
	localizeCb chan NonblockInboxResult
	maxUnbox   *int
}

func NewNonblockingLocalizer(g *globals.Context, localizeCb chan NonblockInboxResult,
	maxUnbox *int) *NonblockingLocalizer {
	return &NonblockingLocalizer{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "NonblockingLocalizer", false),
		baseLocalizer: newBaseLocalizer(g),
		pipeline: newLocalizerPipeline(g,
			newBasicSupersedesTransform(g, basicSupersedesTransformOpts{})),
		localizeCb: localizeCb,
		maxUnbox:   maxUnbox,
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
	inbox = b.filterSelfFinalized(ctx, inbox)
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
	ib, err := b.ReadUnverified(ctx, uid, true, &chat1.GetInboxQuery{
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
	*sourceOfflinable
}

var _ types.InboxSource = (*RemoteInboxSource)(nil)

func NewRemoteInboxSource(g *globals.Context, ri func() chat1.RemoteInterface) *RemoteInboxSource {
	labeler := utils.NewDebugLabeler(g.GetLog(), "RemoteInboxSource", false)
	s := &RemoteInboxSource{
		Contextified:     globals.NewContextified(g),
		DebugLabeler:     labeler,
		sourceOfflinable: newSourceOfflinable(g, labeler),
	}
	s.baseInboxSource = newBaseInboxSource(g, s, ri)
	return s
}

func (s *RemoteInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizer types.ChatLocalizer, useLocalData bool, query *chat1.GetInboxLocalQuery,
	p *chat1.Pagination) (types.Inbox, error) {

	if localizer == nil {
		localizer = NewBlockingLocalizer(s.G())
	}
	if s.IsOffline(ctx) {
		localizer.SetOffline()
	}
	s.Debug(ctx, "Read: using localizer: %s", localizer.Name())

	rquery, tlfInfo, err := s.GetInboxQueryLocalToRemote(ctx, query)
	if err != nil {
		return types.Inbox{}, err
	}
	inbox, err := s.ReadUnverified(ctx, uid, useLocalData, rquery, p)
	if err != nil {
		return types.Inbox{}, err
	}

	res, err := localizer.Localize(ctx, uid, inbox)
	if err != nil {
		return types.Inbox{}, err
	}

	res, err = filterConvLocals(res, rquery, query, tlfInfo)
	if err != nil {
		return types.Inbox{}, err
	}

	return types.Inbox{
		Version:         inbox.Version,
		Convs:           res,
		ConvsUnverified: inbox.ConvsUnverified,
		Pagination:      inbox.Pagination,
	}, nil
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

func (s *RemoteInboxSource) TeamTypeChanged(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID, teamType chat1.TeamType) (conv *chat1.ConversationLocal, err error) {
	return conv, err
}

func (s *RemoteInboxSource) UpdateKBFSToImpteam(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers, convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	return conv, err
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
		sourceOfflinable: newSourceOfflinable(g, labeler),
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
			job := types.NewConvLoaderJob(conv.GetConvID(), &chat1.Pagination{Num: 50},
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
	localizer types.ChatLocalizer, useLocalData bool, query *chat1.GetInboxLocalQuery,
	p *chat1.Pagination) (inbox types.Inbox, err error) {

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
		return inbox, err
	}
	inbox, err = s.ReadUnverified(ctx, uid, useLocalData, rquery, p)
	if err != nil {
		return inbox, err
	}

	// Localize
	inbox.Convs, err = localizer.Localize(ctx, uid, inbox)
	if err != nil {
		return inbox, err
	}

	// Run post filters
	inbox.Convs, err = filterConvLocals(inbox.Convs, rquery, query, tlfInfo)
	if err != nil {
		return inbox, err
	}

	// Write metadata to the inbox cache
	if err = storage.NewInbox(s.G(), uid).MergeLocalMetadata(ctx, inbox.Convs); err != nil {
		// Don't abort the operation on this kind of error
		s.Debug(ctx, "Read: unable to write inbox local metadata: %s", err)
	}

	return inbox, nil
}

func (s *HybridInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
	query *chat1.GetInboxQuery, p *chat1.Pagination) (res types.Inbox, err error) {
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
		res, err = s.fetchRemoteInbox(ctx, uid, query, p)
		if err != nil {
			return res, err
		}

		// Write out to local storage only if we are using local data
		if useLocalData {
			if cerr = inboxStore.Merge(ctx, res.Version, utils.PluckConvs(res.ConvsUnverified), query, p); cerr != nil {
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
				storage.NewInbox(s.G(), uid).Clear(ctx)
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
	if cerr := storage.NewInbox(s.G(), uid).NewConversation(ctx, vers, conv); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return err
	}

	return nil
}

func (s *HybridInboxSource) getConvLocal(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	// Read back affected conversation so we can send it to the frontend
	ib, err := s.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
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
	ib, err := s.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: convIDs,
	}, nil)
	return ib.Convs, err
}

func (s *HybridInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "NewMessage")()
	if cerr := storage.NewInbox(s.G(), uid).NewMessage(ctx, vers, convID, msg, maxMsgs); cerr != nil {
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

	// Read the remote conversation so we can get the notification settings changes
	remoteConv, err := GetUnverifiedConv(ctx, s.G(), uid, convID, false)
	if err != nil {
		s.Debug(ctx, "TeamTypeChanged: failed to read team type conv: %s", err.Error())
		return nil, err
	}
	ib := storage.NewInbox(s.G(), uid)
	if cerr := ib.TeamTypeChanged(ctx, vers, convID, teamType, remoteConv.Notifications); cerr != nil {
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

	ib := storage.NewInbox(s.G(), uid)
	if cerr := ib.UpgradeKBFSToImpteam(ctx, vers, convID); cerr != nil {
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
		ibox, err = s.Read(ctx, uid, nil, false, &chat1.GetInboxLocalQuery{
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

	ib := storage.NewInbox(s.G(), uid)
	if cerr := ib.MembershipUpdate(ctx, vers, userJoinedConvs, res.UserRemovedConvs,
		res.OthersJoinedConvs, res.OthersRemovedConvs, res.UserResetConvs, res.OthersResetConvs); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return res, err
	}

	return res, nil
}

func (s *HybridInboxSource) Expunge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
	expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (*chat1.ConversationLocal, error) {
	return s.modConversation(ctx, "Expunge", uid, convID, func(ctx context.Context, ib *storage.Inbox) error {
		return ib.Expunge(ctx, vers, convID, expunge, maxMsgs)
	})
}

func (s *HybridInboxSource) SetConvRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, policy chat1.RetentionPolicy) (res *chat1.ConversationLocal, err error) {
	return s.modConversation(ctx, "SetConvRetention", uid, convID, func(ctx context.Context, ib *storage.Inbox) error {
		return ib.SetConvRetention(ctx, vers, convID, policy)
	})
}

func (s *HybridInboxSource) SetTeamRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy) (convs []chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "SetTeamRetention")()
	ib := storage.NewInbox(s.G(), uid)
	convIDs, cerr := ib.SetTeamRetention(ctx, vers, teamID, policy)
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
		return ib.SetConvSettings(ctx, vers, convID, convSettings)
	})
}

func (s *HybridInboxSource) modConversation(ctx context.Context, debugLabel string, uid gregor1.UID, convID chat1.ConversationID,
	mod func(context.Context, *storage.Inbox) error) (
	conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, debugLabel)()
	ib := storage.NewInbox(s.G(), uid)
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
	nthreads := s.G().Env.GetChatInboxSourceLocalizeThreads()
	s.Debug(ctx, "pipeline: using %d threads", nthreads)
	for i := 0; i < nthreads; i++ {
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
	return strings.Contains(name, "@") || strings.Contains(name, ":") || strings.Contains(name, ".")
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

func (s *localizerPipeline) getMessagesOffline(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageSummary, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, chat1.ConversationErrorType, error) {

	st := storage.New(s.G(), s.G().ConvSource)
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

func (s *localizerPipeline) getMinWriterRoleInfoLocal(ctx context.Context, info *chat1.ConversationMinWriterRoleInfo) *chat1.ConversationMinWriterRoleInfoLocal {
	if info == nil {
		return nil
	}
	username := ""
	name, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(info.Uid.String()))
	if err == nil {
		username = name.String()
	}
	return &chat1.ConversationMinWriterRoleInfoLocal{
		Role:     info.Role,
		Username: username,
	}
}

func (s *localizerPipeline) getConvSettingsLocal(ctx context.Context, conv chat1.Conversation) (res *chat1.ConversationSettingsLocal) {
	settings := conv.ConvSettings
	if settings == nil {
		return nil
	}
	res = &chat1.ConversationSettingsLocal{}
	res.MinWriterRoleInfo = s.getMinWriterRoleInfoLocal(ctx, settings.MinWriterRoleInfo)
	return res

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
	var umapper libkb.UIDMapper
	if s.offline {
		umapper = &uidmap.OfflineUIDMap{}
	} else {
		umapper = s.G().UIDMapper
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
		packages, err := umapper.MapUIDsToUsernamePackages(ctx, s.G(),
			[]keybase1.UID{keybase1.UID(conversationRemote.CreatorInfo.Uid.String())}, 0, 0, false)
		if err != nil || len(packages) == 0 {
			s.Debug(ctx, "localizeConversation: failed to load creator username: %s", err)
		} else {
			conversationLocal.CreatorInfo = &chat1.ConversationCreatorInfoLocal{
				Username: packages[0].NormalizedUsername.String(),
				Ctime:    conversationRemote.CreatorInfo.Ctime,
			}
		}
	}
	conversationLocal.Expunge = conversationRemote.Expunge
	conversationLocal.ConvRetention = conversationRemote.ConvRetention
	conversationLocal.TeamRetention = conversationRemote.TeamRetention
	conversationLocal.ConvSettings = s.getConvSettingsLocal(ctx, conversationRemote)

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
				uid, utils.PluckMessageIDs(conversationRemote.MaxMsgSummaries), nil)
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
				} else {
					newMaxMsgs = append(newMaxMsgs, mm)
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

	// Only do this check if there is a chance the TLF name might be an SBS
	// name. Only attempt this if we are online
	if !s.offline && s.needsCanonicalize(conversationLocal.Info.TlfName) {
		infoSource := CreateNameInfoSource(ctx, s.G(), conversationLocal.GetMembersType())
		var info *types.NameInfo
		var ierr error
		// If we are of type TEAM, it's possible that our subteam has been
		// renamed so we have to rely on the Tlfid, not the TLFName to get the
		// latest info.
		switch conversationRemote.GetMembersType() {
		case chat1.ConversationMembersType_TEAM:
			info, ierr = infoSource.LookupName(ctx,
				conversationLocal.Info.Triple.Tlfid,
				conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC)
		default:
			info, ierr = infoSource.LookupID(ctx,
				conversationLocal.Info.TLFNameExpanded(),
				conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC)
		}
		if ierr != nil {
			errMsg := ierr.Error()
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
	case chat1.ConversationMembersType_TEAM:
		var kuids []keybase1.UID
		for _, uid := range conversationRemote.Metadata.AllList {
			kuids = append(kuids, keybase1.UID(uid.String()))
		}
		conversationLocal.Info.ResetNames = s.getResetUserNames(ctx, umapper, conversationRemote)
		rows, err := umapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, time.Hour*24,
			10*time.Second, true)
		if err != nil {
			s.Debug(ctx, "localizeConversation: UIDMapper returned an error: %s", err)
		}
		for _, row := range rows {
			conversationLocal.Info.Participants = append(conversationLocal.Info.Participants,
				utils.UsernamePackageToParticipant(row))
		}
		// Sort alphabetically
		sort.Slice(conversationLocal.Info.Participants, func(i, j int) bool {
			return conversationLocal.Info.Participants[i].Username <
				conversationLocal.Info.Participants[j].Username
		})
	case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_IMPTEAMUPGRADE:
		conversationLocal.Info.ResetNames = s.getResetUserNames(ctx, umapper, conversationRemote)
		fallthrough
	case chat1.ConversationMembersType_KBFS:
		var err error
		conversationLocal.Info.Participants, err = utils.ReorderParticipants(
			ctx,
			s.G(),
			umapper,
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
		switch conversationRemote.GetMembersType() {
		case chat1.ConversationMembersType_KBFS:
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
		default:
			if teams.IsTeamReadError(fromErr.Inner()) {
				convErrTyp = chat1.ConversationErrorType_OTHERREKEYNEEDED
				rekeyInfo = &chat1.ConversationErrorRekey{
					TlfName: unverifiedTLFName,
				}
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
	parts, err := utils.ReorderParticipants(
		ctx,
		s.G(),
		s.G().UIDMapper,
		rekeyInfo.TlfName,
		conversationRemote.Metadata.ActiveList)
	if err != nil {
		return nil, err
	}
	var writerNames []string
	for _, p := range parts {
		writerNames = append(writerNames, p.Username)
	}
	rekeyInfo.WriterNames = writerNames

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
