package chat

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

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
		localizer:        newLocalizerPipeline(g),
	}
}

func (b *baseInboxSource) notifyTlfFinalize(ctx context.Context, username string) {
	// Let the rest of the system know this user has changed
	arg := libkb.NewLoadUserArg(b.G().ExternalG()).WithName(username).WithPublicKeyOptional()
	finalizeUser, err := libkb.LoadUser(arg)
	if err != nil {
		b.Debug(ctx, "notifyTlfFinalize: failed to load finalize user, skipping user changed notification: err: %s", err.Error())
	} else {
		b.G().UserChanged(ctx, finalizeUser.GetUID())
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
	if lquery.Name != nil && lquery.Name.TlfID != nil {
		rquery.TlfID = lquery.Name.TlfID
		rquery.MembersTypes = []chat1.ConversationMembersType{lquery.Name.MembersType}
		info = types.NameInfo{
			CanonicalName: lquery.Name.Name,
			ID:            *lquery.Name.TlfID,
		}
		b.Debug(ctx, "GetInboxQueryLocalToRemote: using TLFID: %v", *lquery.Name.TlfID)
	} else if lquery.Name != nil && len(lquery.Name.Name) > 0 {
		var err error
		tlfName := utils.AddUserToTLFName(b.G(), lquery.Name.Name, lquery.Visibility(),
			lquery.Name.MembersType)
		info, err = CreateNameInfoSource(ctx, b.G(), lquery.Name.MembersType).LookupID(ctx, tlfName,
			lquery.Visibility() == keybase1.TLFVisibility_PUBLIC)
		if err != nil {
			b.Debug(ctx, "GetInboxQueryLocalToRemote: failed: %s", err)
			return nil, info, err
		}
		rquery.TlfID = &info.ID
		rquery.MembersTypes = []chat1.ConversationMembersType{lquery.Name.MembersType}
		b.Debug(ctx, "GetInboxQueryLocalToRemote: mapped name %q to TLFID %v", tlfName, info.ID)
	}
	rquery.TopicName = lquery.TopicName
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
	rquery.MemberStatus = lquery.MemberStatus
	rquery.SummarizeMaxMsgs = false

	return rquery, info, nil
}

func (b *baseInboxSource) IsMember(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (bool, error) {
	ib, err := b.sub.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
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
	b.Debug(ctx, "Localize: using localizer: %s, convs: %d", localizer.Name(), len(convs))

	res, err := localizer.Localize(ctx, uid, types.Inbox{
		ConvsUnverified: convs,
	}, nil)
	return res, localizeCb, err
}

func (b *baseInboxSource) notifyServerAboutReportedConv(mctx libkb.MetaContext, uid gregor1.UID, convID chat1.ConversationID) (err error) {
	ctx := mctx.Ctx()
	// Send word to API server about the report
	defer b.Trace(ctx, func() error { return err }, "notifyServerAboutReportedConv")()
	// Get TLF name to post
	tlfname := "<error fetching TLF name>"
	ib, _, err := b.sub.Read(ctx, uid, types.ConversationLocalizerBlocking, types.InboxSourceDataSourceAll,
		nil, &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		})
	if err != nil {
		b.Debug(ctx, "notifyServerAboutReportedConv: failed to fetch conversation: %s", err)
	} else {
		if len(ib.Convs) > 0 {
			tlfname = ib.Convs[0].Info.TLFNameExpanded()
		}
	}
	args := libkb.NewHTTPArgs()
	args.Add("tlfname", libkb.S{Val: tlfname})
	_, err = b.G().API.Post(mctx, libkb.APIArg{
		Endpoint:    "report/conversation",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        args,
	})
	if err != nil {
		b.Debug(ctx, "notifyServerAboutReportedConv: failed to post report: %s", err.Error())
	}
	return nil
}

// blockOtherUser attempts to do a user-block based on a convID if the conversation is
// impteam and has exactly two members: the active user and the user about to get blocked.
func (b *baseInboxSource) blockOtherUser(mctx libkb.MetaContext, convID chat1.ConversationID) (err error) {
	defer b.Trace(mctx.Ctx(), func() error { return err }, "blockOtherUser")()

	conversations, err := mctx.G().ChatHelper.FindConversationsByID(mctx.Ctx(), []chat1.ConversationID{convID})
	if err != nil {
		mctx.Debug("blockOtherUser: error loading conversation by ID", convID, err)
		return err
	}
	if len(conversations) != 1 {
		mctx.Debug("blockOtherUser: did not find exactly 1 conversation, so don't user-block")
		return nil
	}
	conv := conversations[0]
	if conv.GetMembersType() != chat1.ConversationMembersType_IMPTEAMNATIVE {
		mctx.Debug("blockOtherUser: conversation is not an implicit team, so don't user-block")
		return nil
	}
	participants := conv.Info.Participants
	if len(participants) != 2 {
		mctx.Debug("blockOtherUser: conversation does not have exactly 2 users, so don't user-block")
		return nil
	}
	myName := mctx.G().Env.GetUsername().String()
	var otherUser string
	var foundMyself bool
	for _, participant := range participants {
		if myName == participant.Username {
			foundMyself = true
		} else {
			otherUser = participant.Username
		}
	}
	if !foundMyself || otherUser == "" {
		mctx.Debug("blockOtherUser: did not find myself and another user, so don't user-block")
		return nil
	}

	otherUserUID, err := mctx.G().GetUPAKLoader().LookupUID(mctx.Ctx(), libkb.NewNormalizedUsername(otherUser))
	if err != nil || otherUserUID.String() == "" {
		mctx.Debug("blockOtherUser: could not load user and lookup UID, so don't user-block", err)
		return nil
	}
	apiArg := libkb.APIArg{
		Endpoint:    "user/block",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"block_uid": libkb.S{Val: otherUserUID.String()},
			"unblock":   libkb.B{Val: false},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	_ = mctx.G().CardCache().Delete(keybase1.UID(otherUserUID.String()))
	return err
}

func (b *baseInboxSource) RemoteSetConversationStatus(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, status chat1.ConversationStatus) (err error) {
	mctx := libkb.NewMetaContext(ctx, b.G().ExternalG())
	defer b.Trace(ctx, func() error { return err }, "RemoteSetConversationStatus")()
	if _, err = b.getChatInterface().SetConversationStatus(ctx, chat1.SetConversationStatusArg{
		ConversationID: convID,
		Status:         status,
	}); err != nil {
		return err
	}
	switch status {
	case chat1.ConversationStatus_REPORTED:
		_ = b.notifyServerAboutReportedConv(mctx, uid, convID)
		fallthrough
	case chat1.ConversationStatus_BLOCKED:
		return b.blockOtherUser(mctx, convID)
	}
	return nil
}

func (b *baseInboxSource) createConversationLocalizer(ctx context.Context, typ types.ConversationLocalizerTyp,
	localizeCb chan types.AsyncInboxResult) conversationLocalizer {
	switch typ {
	case types.ConversationLocalizerBlocking:
		return newBlockingLocalizer(b.G(), b.localizer, localizeCb)
	case types.ConversationLocalizerNonblocking:
		return newNonblockingLocalizer(b.G(), b.localizer, localizeCb)
	default:
		b.Debug(ctx, "createConversationLocalizer: warning unknown typ %v, using blockingLocalizer as default", typ)
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

func (b *baseInboxSource) ApplyLocalChatState(ctx context.Context, i []keybase1.BadgeConversationInfo) []keybase1.BadgeConversationInfo {
	return i
}

func GetInboxQueryNameInfo(ctx context.Context, g *globals.Context,
	lquery *chat1.GetInboxLocalQuery) (res types.NameInfo, err error) {
	if lquery.Name == nil {
		return res, errors.New("invalid name query")
	} else if lquery.Name != nil && len(lquery.Name.Name) > 0 {
		if lquery.Name.TlfID != nil {
			return CreateNameInfoSource(ctx, g, lquery.Name.MembersType).LookupName(ctx, *lquery.Name.TlfID,
				lquery.Visibility() == keybase1.TLFVisibility_PUBLIC, lquery.Name.Name)
		}
		return CreateNameInfoSource(ctx, g, lquery.Name.MembersType).LookupID(ctx, lquery.Name.Name,
			lquery.Visibility() == keybase1.TLFVisibility_PUBLIC)
	} else {
		return res, errors.New("invalid name query")
	}
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

func (s *RemoteInboxSource) Clear(ctx context.Context, uid gregor1.UID) error {
	return nil
}

func (s *RemoteInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizerTyp types.ConversationLocalizerTyp, dataSource types.InboxSourceDataSourceTyp, maxLocalize *int,
	query *chat1.GetInboxLocalQuery) (types.Inbox, chan types.AsyncInboxResult, error) {

	rquery, tlfInfo, err := s.GetInboxQueryLocalToRemote(ctx, query)
	if err != nil {
		return types.Inbox{}, nil, err
	}
	inbox, err := s.ReadUnverified(ctx, uid, dataSource, rquery)
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
	}, localizeCb, nil
}

func (s *RemoteInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID,
	dataSource types.InboxSourceDataSourceTyp, rquery *chat1.GetInboxQuery) (types.Inbox, error) {
	if s.IsOffline(ctx) {
		return types.Inbox{}, OfflineError{}
	}
	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: rquery,
	})
	if err != nil {
		return types.Inbox{}, err
	}
	return types.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: utils.RemoteConvs(ib.Inbox.Full().Conversations),
	}, nil
}

func (s *RemoteInboxSource) MarkAsRead(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgID *chat1.MessageID) (err error) {
	defer s.Trace(ctx, func() error { return err }, "MarkAsRead(%s,%d)", convID, msgID)()
	if msgID == nil {
		conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
		if err != nil {
			return err
		}
		msgID = new(chat1.MessageID)
		*msgID = conv.Conv.ReaderInfo.MaxMsgid
	}
	if _, err = s.getChatInterface().MarkAsRead(ctx, chat1.MarkAsReadArg{
		ConversationID: convID,
		MsgID:          *msgID,
	}); err != nil {
		return err
	}
	return nil
}

func (s *RemoteInboxSource) Search(ctx context.Context, uid gregor1.UID, query string, limit int) (res []types.RemoteConversation, err error) {
	return nil, errors.New("not implemented")
}

func (s *RemoteInboxSource) IsTeam(ctx context.Context, uid gregor1.UID, item string) (bool, error) {
	return false, errors.New("not implemented")
}

func (s *RemoteInboxSource) NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	conv chat1.Conversation) error {
	return nil
}

func (s *RemoteInboxSource) Sync(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convs []chat1.Conversation) (res types.InboxSyncRes, err error) {
	return res, nil
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
	previews []chat1.ConversationID, teamMemberRoleUpdate *chat1.TeamMemberRoleUpdate) (res types.MembershipUpdateRes, err error) {
	return res, err
}

func (s *RemoteInboxSource) ConversationsUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convUpdates []chat1.ConversationUpdate) error {
	return nil
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

func (s *RemoteInboxSource) UpdateInboxVersion(ctx context.Context, uid gregor1.UID,
	vers chat1.InboxVers) error {
	return nil
}

func (s *RemoteInboxSource) Draft(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	text *string) error {
	return nil
}

func (s *RemoteInboxSource) MergeLocalMetadata(ctx context.Context, uid gregor1.UID,
	convs []chat1.ConversationLocal) error {
	return nil
}

func (s *RemoteInboxSource) NotifyUpdate(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) {
}

func (s *RemoteInboxSource) IncrementLocalConvVersion(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	return nil, nil
}

func (s *RemoteInboxSource) UpdateLocalMtime(ctx context.Context, uid gregor1.UID, updates []chat1.LocalMtimeUpdate) error {
	return nil
}

func (s *RemoteInboxSource) TeamBotSettingsForConv(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (
	map[keybase1.UID]keybase1.TeamBotSettings, error) {
	return nil, nil
}

type HybridInboxSource struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler
	*baseInboxSource

	uid                   gregor1.UID
	started               bool
	stopCh                chan struct{}
	eg                    errgroup.Group
	flushDelay            time.Duration
	readOutbox            *storage.ReadOutbox
	readFlushDelay        time.Duration
	readFlushCh           chan struct{}
	searchStatusMap       map[chat1.ConversationStatus]bool
	searchMemberStatusMap map[chat1.ConversationMemberStatus]bool

	testFlushCh chan struct{} // testing only
}

var _ types.InboxSource = (*HybridInboxSource)(nil)

func NewHybridInboxSource(g *globals.Context,
	getChatInterface func() chat1.RemoteInterface) *HybridInboxSource {
	labeler := utils.NewDebugLabeler(g.GetLog(), "HybridInboxSource", false)
	s := &HybridInboxSource{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   labeler,
		flushDelay:     time.Minute,
		readFlushDelay: 5 * time.Second,
		readFlushCh:    make(chan struct{}, 10),
	}
	s.searchStatusMap = map[chat1.ConversationStatus]bool{
		chat1.ConversationStatus_UNFILED:  true,
		chat1.ConversationStatus_FAVORITE: true,
		chat1.ConversationStatus_MUTED:    true,
		chat1.ConversationStatus_IGNORED:  true,
	}
	s.searchMemberStatusMap = map[chat1.ConversationMemberStatus]bool{
		chat1.ConversationMemberStatus_ACTIVE:  true,
		chat1.ConversationMemberStatus_PREVIEW: true,
		chat1.ConversationMemberStatus_RESET:   true,
	}
	s.baseInboxSource = newBaseInboxSource(g, s, getChatInterface)
	return s
}

func (s *HybridInboxSource) createInbox() *storage.Inbox {
	return storage.NewInbox(s.G(),
		storage.FlushMode(storage.InboxFlushModeDelegate),
		storage.LayoutChangedNotifier(s.G().UIInboxLoader))
}

func (s *HybridInboxSource) Clear(ctx context.Context, uid gregor1.UID) error {
	return s.createInbox().Clear(ctx, uid)
}

func (s *HybridInboxSource) Connected(ctx context.Context) {
	defer s.Trace(ctx, func() error { return nil }, "Connected")()
	s.baseInboxSource.Connected(ctx)
	s.flushMarkAsRead(ctx)
}

func (s *HybridInboxSource) Start(ctx context.Context, uid gregor1.UID) {
	defer s.Trace(ctx, func() error { return nil }, "Start")()
	s.baseInboxSource.Start(ctx, uid)
	s.Lock()
	defer s.Unlock()
	if s.started {
		return
	}
	s.stopCh = make(chan struct{})
	s.started = true
	s.uid = uid
	s.readOutbox = storage.NewReadOutbox(s.G(), uid)
	s.eg.Go(func() error { return s.inboxFlushLoop(uid, s.stopCh) })
	s.eg.Go(func() error { return s.markAsReadDeliverLoop(uid, s.stopCh) })
}

func (s *HybridInboxSource) Stop(ctx context.Context) chan struct{} {
	defer s.Trace(ctx, func() error { return nil }, "Stop")()
	<-s.baseInboxSource.Stop(ctx)
	s.Lock()
	defer s.Unlock()
	ch := make(chan struct{})
	if s.started {
		close(s.stopCh)
		s.started = false
		go func() {
			_ = s.eg.Wait()
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (s *HybridInboxSource) flushMarkAsRead(ctx context.Context) {
	select {
	case s.readFlushCh <- struct{}{}:
	default:
		s.Debug(ctx, "flushMarkAsRead: channel full, dropping")
	}
}

func (s *HybridInboxSource) markAsReadDeliver(ctx context.Context) (err error) {
	defer func() {
		if err != nil {
			s.Debug(ctx, "markAsReadDeliver: failed to mark as read: %s", err)
		}
	}()
	recs, err := s.readOutbox.GetRecords(ctx)
	if err != nil {
		return err
	}
	for _, rec := range recs {
		shouldRemove := false
		if _, err := s.getChatInterface().MarkAsRead(ctx, chat1.MarkAsReadArg{
			ConversationID: rec.ConvID,
			MsgID:          rec.MsgID,
		}); err != nil {
			s.Debug(ctx, "markAsReadDeliver: failed to mark as read: convID: %s msgID: %s err: %s",
				rec.ConvID, rec.MsgID, err)
			// check for an immediate failure from the server, and get the attempt out if it fails
			if berr, ok := err.(DelivererInfoError); ok {
				if _, ok := berr.IsImmediateFail(); ok {
					s.Debug(ctx, "markAsReadDeliver: error is an immediate failure, not retrying")
					shouldRemove = true
				}
			}
		} else {
			shouldRemove = true
		}
		if shouldRemove {
			if err := s.readOutbox.RemoveRecord(ctx, rec.ID); err != nil {
				s.Debug(ctx, "markAsReadDeliver: failed to remove record: %s", err)
			}
		}
	}
	return nil
}

func (s *HybridInboxSource) markAsReadDeliverLoop(uid gregor1.UID, stopCh chan struct{}) error {
	ctx := context.Background()
	for {
		select {
		case <-s.readFlushCh:
			err := s.markAsReadDeliver(ctx)
			if err != nil {
				return err
			}
		case <-s.G().Clock().After(s.readFlushDelay):
			err := s.markAsReadDeliver(ctx)
			if err != nil {
				return err
			}
		case <-stopCh:
			return nil
		}
	}
}

func makeBadgeConversationInfo(convID keybase1.ChatConversationID, count int) keybase1.BadgeConversationInfo {
	return keybase1.BadgeConversationInfo{
		ConvID: convID,
		BadgeCounts: map[keybase1.DeviceType]int{
			keybase1.DeviceType_DESKTOP: count,
			keybase1.DeviceType_MOBILE:  count,
		},
		UnreadMessages: count,
	}
}

// ApplyLocalChatState marks items locally as read and badges conversations
// that have failed outbox items.
func (s *HybridInboxSource) ApplyLocalChatState(ctx context.Context, infos []keybase1.BadgeConversationInfo) (res []keybase1.BadgeConversationInfo) {
	var convIDs []chat1.ConversationID
	for _, info := range infos {
		if !info.IsEmpty() {
			convIDs = append(convIDs, chat1.ConversationID(info.ConvID.Bytes()))
		}
	}
	_, convs, err := s.createInbox().Read(ctx, s.uid, &chat1.GetInboxQuery{
		ConvIDs: convIDs,
	})
	if err != nil {
		s.Debug(ctx, "ApplyLocalChatState: failed to get convs: %v", err)
	}

	// convID -> isRead
	readConvMap := make(map[string]bool)
	for _, conv := range convs {
		if conv.IsLocallyRead() {
			readConvMap[conv.ConvIDStr] = true
		}
	}

	outbox := storage.NewOutbox(s.G(), s.uid)
	obrs, oerr := outbox.PullAllConversations(ctx, true /*includeErrors */, false /*remove*/)
	if oerr != nil {
		s.Debug(ctx, "ApplyLocalChatState: failed to get outbox: %v", oerr)
	}

	// convID -> unreadCount
	failedOutboxMap := make(map[string]int)
	// convID -> mtime
	localUpdates := make(map[string]chat1.LocalMtimeUpdate)
	s.Debug(ctx, "ApplyLocalChatState: looking through %d outbox items for badgable errors", len(obrs))
	for _, obr := range obrs {
		if topicType := obr.Msg.ClientHeader.Conv.TopicType; !(obr.Msg.IsBadgableType() && topicType == chat1.TopicType_CHAT) {
			s.Debug(ctx, "ApplyLocalChatState: skipping msgTyp: %v, topicType: %v", obr.Msg.MessageType(), topicType)
			continue
		}
		state, err := obr.State.State()
		if err != nil {
			s.Debug(ctx, "ApplyLocalChatState: unknown state item: skipping: err: %v", err)
			continue
		}
		if state == chat1.OutboxStateType_ERROR {
			ctime := obr.Ctime
			isBadgableError := obr.State.Error().Typ.IsBadgableError()
			s.Debug(ctx, "ApplyLocalChatState: found errored outbox item ctime: %v, error: %v, messageType: %v, IsBadgableError: %v",
				ctime.Time(), obr.State.Error(), obr.Msg.MessageType(), isBadgableError)
			if !isBadgableError {
				continue
			}
			if update, ok := localUpdates[obr.ConvID.String()]; ok {
				if ctime.After(update.Mtime) {
					localUpdates[obr.ConvID.String()] = update
				}
			} else {
				localUpdates[obr.ConvID.String()] = chat1.LocalMtimeUpdate{
					ConvID: obr.ConvID,
					Mtime:  ctime,
				}
			}
			failedOutboxMap[obr.ConvID.String()]++
		}
	}

	updates := []chat1.LocalMtimeUpdate{}
	for _, update := range localUpdates {
		updates = append(updates, update)
	}
	if err := s.createInbox().UpdateLocalMtime(ctx, s.uid, updates); err != nil {
		s.Debug(ctx, "ApplyLocalChatState: unable to apply UpdateLocalMtime: %v", err)
	}

	for _, info := range infos {
		// mark this conv as read
		if readConvMap[info.ConvID.String()] {
			info = makeBadgeConversationInfo(info.ConvID, 0)
			s.Debug(ctx, "ApplyLocalChatState, marking as read %+v", info)
		}
		// badge qualifying failed outbox items
		if failedCount, ok := failedOutboxMap[info.ConvID.String()]; ok {
			newInfo := makeBadgeConversationInfo(info.ConvID, failedCount)
			newInfo.BadgeCounts[keybase1.DeviceType_DESKTOP] += info.BadgeCounts[keybase1.DeviceType_DESKTOP]
			newInfo.BadgeCounts[keybase1.DeviceType_MOBILE] += info.BadgeCounts[keybase1.DeviceType_MOBILE]
			newInfo.UnreadMessages += info.UnreadMessages
			info = newInfo
			delete(failedOutboxMap, info.ConvID.String())
			s.Debug(ctx, "ApplyLocalChatState, applying failed to existing info %+v", info)
		}
		res = append(res, info)
	}

	// apply any new failed outbox items
	for convIDStr, failedCount := range failedOutboxMap {
		convID, err := chat1.MakeConvID(convIDStr)
		if err != nil {
			s.Debug(ctx, "ApplyLocalChatState: Unable to make convID: %v", err)
			continue
		}
		newInfo := makeBadgeConversationInfo(keybase1.ChatConversationID(convID), failedCount)
		s.Debug(ctx, "ApplyLocalChatState, applying failed to new info %+v", newInfo)
		res = append(res, newInfo)
	}
	return res
}

func (s *HybridInboxSource) Draft(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	text *string) error {
	if err := s.createInbox().Draft(ctx, uid, convID, text); err != nil {
		return err
	}
	return nil
}

func (s *HybridInboxSource) UpdateLocalMtime(ctx context.Context, uid gregor1.UID, updates []chat1.LocalMtimeUpdate) error {
	if err := s.createInbox().UpdateLocalMtime(ctx, uid, updates); err != nil {
		return err
	}
	return nil
}

func (s *HybridInboxSource) MergeLocalMetadata(ctx context.Context, uid gregor1.UID, convs []chat1.ConversationLocal) (err error) {
	defer s.Trace(ctx, func() error { return err }, "MergeLocalMetadata")()
	return s.createInbox().MergeLocalMetadata(ctx, uid, convs)
}

func (s *HybridInboxSource) NotifyUpdate(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) {
	if err := s.createInbox().IncrementLocalConvVersion(ctx, uid, convID); err != nil {
		s.Debug(ctx, "NotifyUpdate: unable to IncrementLocalConvVersion, err", err)
	}
	conv, err := s.getConvLocal(ctx, uid, convID)
	if err != nil {
		s.Debug(ctx, "NotifyUpdate: unable to getConvLocal, err", err)
	}
	var inboxUIItem *chat1.InboxUIItem
	topicType := chat1.TopicType_NONE
	if conv != nil {
		inboxUIItem = PresentConversationLocalWithFetchRetry(ctx, s.G(), uid, *conv)
		topicType = conv.GetTopicType()
	}
	s.G().ActivityNotifier.ConvUpdate(ctx, uid, convID,
		topicType, inboxUIItem)
}

func (s *HybridInboxSource) IncrementLocalConvVersion(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "IncrementLocalConvVersion")()
	if err := s.createInbox().IncrementLocalConvVersion(ctx, uid, convID); err != nil {
		s.Debug(ctx, "IncrementLocalConvVersion: unable to IncrementLocalConvVersion, err", err)
	}
	return s.getConvLocal(ctx, uid, convID)
}

func (s *HybridInboxSource) MarkAsRead(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgID *chat1.MessageID) (err error) {
	defer s.Trace(ctx, func() error { return err }, "MarkAsRead(%s,%d)", convID, msgID)()
	// Check local copy to see if we have this convo, and have fully read it. If so, we skip the remote call
	readRes, err := s.createInbox().GetConversation(ctx, uid, convID)
	if err == nil && readRes.GetConvID().Eq(convID) &&
		readRes.Conv.ReaderInfo.ReadMsgid == readRes.Conv.ReaderInfo.MaxMsgid {
		s.Debug(ctx, "MarkAsRead: conversation fully read: %s, not sending remote call", convID)
		return nil
	}
	if msgID == nil {
		conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
		if err != nil {
			return err
		}
		msgID = new(chat1.MessageID)
		*msgID = conv.Conv.ReaderInfo.MaxMsgid
	}
	if err := s.createInbox().MarkLocalRead(ctx, uid, convID, *msgID); err != nil {
		s.Debug(ctx, "MarkAsRead: failed to mark local read: %s", err)
	} else {
		if err := s.G().Badger.Send(ctx); err != nil {
			return err
		}
	}
	if err := s.readOutbox.PushRead(ctx, convID, *msgID); err != nil {
		return err
	}
	s.flushMarkAsRead(ctx)
	return nil
}

func (s *HybridInboxSource) inboxFlushLoop(uid gregor1.UID, stopCh chan struct{}) error {
	ctx := globals.ChatCtx(context.Background(), s.G(),
		keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, nil)
	appState := s.G().MobileAppState.State()
	doFlush := func() {
		s.createInbox().Flush(ctx, uid)
		if s.testFlushCh != nil {
			s.testFlushCh <- struct{}{}
		}
	}
	for {
		select {
		case <-s.G().Clock().After(s.flushDelay):
			doFlush()
		case appState = <-s.G().MobileAppState.NextUpdate(&appState):
			switch appState {
			case keybase1.MobileAppState_BACKGROUND:
				doFlush()
			default:
				// Nothing to do for other app states.
			}
		case <-stopCh:
			doFlush()
			return nil
		}
	}
}

func (s *HybridInboxSource) fetchRemoteInbox(ctx context.Context, uid gregor1.UID,
	query *chat1.GetInboxQuery) (res types.Inbox, err error) {
	defer s.Trace(ctx, func() error { return err }, "fetchRemoteInbox")()

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
		}
	} else {
		rquery = *query
		rquery.ComputeActiveList = true
	}
	rquery.SummarizeMaxMsgs = true // always summarize max msgs

	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &rquery,
	})
	if err != nil {
		return types.Inbox{}, err
	}

	var bgEnqueued int
	// Limit the number of jobs we enqueue when on a limited data connection in
	// mobile.
	maxBgEnqueued := 10
	if s.G().MobileNetState.State().IsLimited() {
		maxBgEnqueued = 3
	}

	for _, conv := range ib.Inbox.Full().Conversations {
		// Retention policy expunge
		expunge := conv.GetExpunge()
		if expunge != nil {
			err := s.G().ConvSource.Expunge(ctx, conv.GetConvID(), uid, *expunge)
			if err != nil {
				return types.Inbox{}, err
			}
		}
		if query != nil && query.SkipBgLoads {
			continue
		}
		// Queue all these convs up to be loaded by the background loader. Only
		// load first maxBgEnqueued non KBFS convs, ACTIVE convs so we don't
		// get the conv loader too backed up.
		if conv.Metadata.MembersType != chat1.ConversationMembersType_KBFS &&
			(conv.HasMemberStatus(chat1.ConversationMemberStatus_ACTIVE) ||
				conv.HasMemberStatus(chat1.ConversationMemberStatus_PREVIEW)) &&
			bgEnqueued < maxBgEnqueued {
			job := types.NewConvLoaderJob(conv.GetConvID(), &chat1.Pagination{Num: 50},
				types.ConvLoaderPriorityMedium, types.ConvLoaderGeneric, nil)
			if err := s.G().ConvLoader.Queue(ctx, job); err != nil {
				s.Debug(ctx, "fetchRemoteInbox: failed to queue conversation load: %s", err)
			}
			bgEnqueued++
		}
	}

	return types.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: utils.RemoteConvs(ib.Inbox.Full().Conversations),
	}, nil
}

func (s *HybridInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizerTyp types.ConversationLocalizerTyp, dataSource types.InboxSourceDataSourceTyp, maxLocalize *int,
	query *chat1.GetInboxLocalQuery) (inbox types.Inbox, localizeCb chan types.AsyncInboxResult, err error) {

	defer s.Trace(ctx, func() error { return err }, "Read")()

	// Read unverified inbox
	rquery, tlfInfo, err := s.GetInboxQueryLocalToRemote(ctx, query)
	if err != nil {
		return inbox, localizeCb, err
	}
	inbox, err = s.ReadUnverified(ctx, uid, dataSource, rquery)
	if err != nil {
		return inbox, localizeCb, err
	}
	// we add an additional 1 here for the unverified payload which is also sent
	// on this channel
	localizeCb = make(chan types.AsyncInboxResult, len(inbox.ConvsUnverified)+1)
	localizer := s.createConversationLocalizer(ctx, localizerTyp, localizeCb)
	s.Debug(ctx, "Read: using localizer: %s on %d convs", localizer.Name(), len(inbox.ConvsUnverified))

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
	if err = s.createInbox().MergeLocalMetadata(ctx, uid, inbox.Convs); err != nil {
		// Don't abort the operation on this kind of error
		s.Debug(ctx, "Read: unable to write inbox local metadata: %s", err)
	}

	return inbox, localizeCb, nil
}

func (s *HybridInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID,
	dataSource types.InboxSourceDataSourceTyp, query *chat1.GetInboxQuery) (res types.Inbox, err error) {
	defer s.Trace(ctx, func() error { return err }, "ReadUnverified")()

	var cerr storage.Error
	inboxStore := s.createInbox()
	mergeInboxStore := false

	// Try local storage (if enabled)
	switch dataSource {
	case types.InboxSourceDataSourceLocalOnly, types.InboxSourceDataSourceAll:
		var vers chat1.InboxVers
		var convs []types.RemoteConversation
		mergeInboxStore = true
		vers, convs, cerr = inboxStore.Read(ctx, uid, query)
		if cerr == nil {
			s.Debug(ctx, "ReadUnverified: hit local storage: uid: %s convs: %d", uid, len(convs))
			res = types.Inbox{
				Version:         vers,
				ConvsUnverified: convs,
			}
		} else {
			if dataSource == types.InboxSourceDataSourceLocalOnly {
				s.Debug(ctx, "ReadUnverified: missed local storage, and in local only mode: %s", cerr)
				return res, cerr
			}
		}
	default:
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
		res, err = s.fetchRemoteInbox(ctx, uid, query)
		if err != nil {
			return res, err
		}

		// Write out to local storage only if we are using local data
		if mergeInboxStore {
			if cerr = inboxStore.Merge(ctx, uid, res.Version, utils.PluckConvs(res.ConvsUnverified), query); cerr != nil {
				s.Debug(ctx, "ReadUnverified: failed to write inbox to local storage: %s", cerr.Error())
			}
		}
	}

	return res, err
}

type nameContainsQueryRes int

const (
	nameContainsQueryNone nameContainsQueryRes = iota
	nameContainsQuerySimilar
	nameContainsQueryPrefix
	nameContainsQueryExact
	nameContainsQueryUnread
	nameContainsQueryBadged
)

type convSearchHit struct {
	conv      types.RemoteConversation
	queryToks []string
	convToks  []string
	nameToks  []string
	hits      []nameContainsQueryRes
}

func (h convSearchHit) hitScore() (score int) {
	exacts := 0
	for _, hit := range h.hits {
		switch hit {
		case nameContainsQueryExact:
			score += 20
			exacts++
		case nameContainsQueryPrefix:
			score += 10
		case nameContainsQuerySimilar:
			score += 3
		case nameContainsQueryUnread:
			score += 100
		case nameContainsQueryBadged:
			score += 200
		}
	}
	if len(h.queryToks) == len(h.convToks) && len(h.hits) == len(h.convToks) && exacts == len(h.hits) {
		return 1000000
	} else if len(h.queryToks) == len(h.nameToks) && len(h.hits) == len(h.nameToks) && exacts == len(h.hits) {
		return 1000000
	}
	return score
}

func (h convSearchHit) less(o convSearchHit) bool {
	hScore := h.hitScore()
	oScore := o.hitScore()
	if hScore < oScore {
		return true
	} else if hScore > oScore {
		return false
	}
	htime := utils.GetConvMtime(h.conv)
	otime := utils.GetConvMtime(o.conv)
	return htime.Before(otime)
}

func (h convSearchHit) valid() bool {
	return len(h.hits) > 0
}

func (s *HybridInboxSource) getDeviceType() keybase1.DeviceType {
	if s.G().IsMobileAppType() {
		return keybase1.DeviceType_MOBILE
	}
	return keybase1.DeviceType_DESKTOP
}

func (s *HybridInboxSource) fullNamesForSearch(ctx context.Context, conv types.RemoteConversation,
	convName, username string) (res []string) {
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		return nil
	default:
	}
	if conv.LocalMetadata == nil {
		return nil
	}
	for _, name := range conv.LocalMetadata.FullNamesForSearch {
		if name == username && convName != username {
			continue
		}
		res = append(res, strings.Split(strings.ToLower(name), " ")...)
	}
	return res
}

func (s *HybridInboxSource) isConvSearchHit(ctx context.Context, conv types.RemoteConversation,
	queryToks []string, username string) (res convSearchHit) {
	var convToks []string
	res.conv = conv
	res.queryToks = queryToks
	if len(queryToks) == 0 {
		if conv.Conv.IsUnread() {
			cqe := nameContainsQueryUnread
			if s.G().Badger.State().ConversationBadge(ctx, conv.GetConvID(), s.getDeviceType()) > 0 {
				cqe = nameContainsQueryBadged
			}
			res.hits = []nameContainsQueryRes{cqe}
		}
		return res
	}
	convName := utils.SearchableRemoteConversationName(conv, username)
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		convToks = []string{convName}
	default:
		convToks = strings.Split(convName, ",")
	}
	res.convToks = convToks
	res.nameToks = s.fullNamesForSearch(ctx, conv, convName, username)
	convToks = append(convToks, res.nameToks...)
	for _, queryTok := range queryToks {
		curHit := nameContainsQueryNone
		for _, convTok := range convToks {
			if nameContainsQueryExact > curHit && convTok == queryTok {
				curHit = nameContainsQueryExact
				break
			} else if nameContainsQueryPrefix > curHit && strings.HasPrefix(convTok, queryTok) {
				curHit = nameContainsQueryPrefix
			} else if nameContainsQuerySimilar > curHit && strings.Contains(convTok, queryTok) {
				curHit = nameContainsQuerySimilar
			}
		}
		if curHit > nameContainsQueryNone {
			res.hits = append(res.hits, curHit)
		}
	}
	return res
}

func (s *HybridInboxSource) Search(ctx context.Context, uid gregor1.UID, query string, limit int) (res []types.RemoteConversation, err error) {
	defer s.Trace(ctx, func() error { return err }, "Search")()
	username := s.G().GetEnv().GetUsernameForUID(keybase1.UID(uid.String())).String()
	ib := s.createInbox()
	_, convs, err := ib.ReadAll(ctx, uid, true)
	if err != nil {
		return res, err
	}
	// normalize the search query to lowercase
	query = strings.ToLower(query)
	var queryToks []string
	for _, t := range strings.FieldsFunc(query, func(r rune) bool {
		return r == ',' || r == ' '
	}) {
		tok := strings.Trim(t, " ")
		if len(tok) > 0 {
			queryToks = append(queryToks, tok)
		}
	}
	var hits []convSearchHit
	for _, conv := range convs {
		if conv.Conv.GetTopicType() != chat1.TopicType_CHAT ||
			utils.IsConvEmpty(conv.Conv) || conv.Conv.IsPublic() ||
			!s.searchStatusMap[conv.Conv.Metadata.Status] ||
			!s.searchMemberStatusMap[conv.Conv.ReaderInfo.Status] {
			continue
		}
		hit := s.isConvSearchHit(ctx, conv, queryToks, username)
		if !hit.valid() {
			continue
		}
		hits = append(hits, hit)
	}
	sort.Slice(hits, func(i, j int) bool {
		return hits[j].less(hits[i])
	})
	res = make([]types.RemoteConversation, len(hits))
	for i, hit := range hits {
		res[i] = hit.conv
	}
	if limit > 0 && limit < len(res) {
		return res[:limit], nil
	}
	return res, nil
}

func (s *HybridInboxSource) IsTeam(ctx context.Context, uid gregor1.UID, item string) (res bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "IsTeam")()
	_, convs, err := s.createInbox().ReadAll(ctx, uid, true)
	if err != nil {
		return res, err
	}
	for _, conv := range convs {
		if conv.GetMembersType() == chat1.ConversationMembersType_TEAM &&
			utils.GetRemoteConvTLFName(conv) == item {
			return true, nil
		}
	}
	return false, nil
}

func (s *HybridInboxSource) handleInboxError(ctx context.Context, err error, uid gregor1.UID) (ferr error) {
	defer func() {
		if ferr != nil {
			// Only do this aggressive clear if the error we get is not some kind of network error
			_, isStorageAbort := ferr.(storage.AbortedError)
			if ferr != context.Canceled && !isStorageAbort &&
				IsOfflineError(ferr) == OfflineErrorKindOnline {
				s.Debug(ctx, "handleInboxError: failed to recover from inbox error, clearing: %s", ferr)
				err := s.createInbox().Clear(ctx, uid)
				if err != nil {
					s.Debug(ctx, "handleInboxError: error clearing inbox: %+v", err)
				}
			} else {
				s.Debug(ctx, "handleInboxError: skipping inbox clear because of offline error: %s", ferr)
			}
		}
		s.G().UIInboxLoader.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "inbox error")
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
	if cerr := s.createInbox().NewConversation(ctx, uid, vers, conv); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return err
	}

	return nil
}

func (s *HybridInboxSource) getConvLocal(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	// Read back affected conversation so we can send it to the frontend
	convs, err := s.getConvsLocal(ctx, uid, []chat1.ConversationID{convID})
	if err != nil {
		return nil, err
	}
	if len(convs) == 0 {
		return nil, fmt.Errorf("unable to find conversation for new message: convID: %s", convID)
	}
	if len(convs) > 1 {
		return nil, fmt.Errorf("more than one conversation returned? convID: %s", convID)
	}
	return &convs[0], nil
}

// Get convs. May return fewer or no conversations.
func (s *HybridInboxSource) getConvsLocal(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID) ([]chat1.ConversationLocal, error) {
	// Read back affected conversation so we can send it to the frontend
	ib, _, err := s.Read(ctx, uid, types.ConversationLocalizerBlocking, types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: convIDs,
		})
	return ib.Convs, err
}

func (s *HybridInboxSource) Sync(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convs []chat1.Conversation) (res types.InboxSyncRes, err error) {
	defer s.Trace(ctx, func() error { return err }, "Sync")()
	return s.createInbox().Sync(ctx, uid, vers, convs)
}

func (s *HybridInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "NewMessage")()
	if cerr := s.createInbox().NewMessage(ctx, uid, vers, convID, msg, maxMsgs); cerr != nil {
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
	if cerr := s.createInbox().ReadMessage(ctx, uid, vers, convID, msgID); cerr != nil {
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
	if cerr := s.createInbox().SetStatus(ctx, uid, vers, convID, status); cerr != nil {
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
	ib := s.createInbox()
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
	remoteConv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID,
		types.InboxSourceDataSourceRemoteOnly)
	if err != nil {
		s.Debug(ctx, "TeamTypeChanged: failed to read team type conv: %s", err.Error())
		return nil, err
	}
	ib := s.createInbox()
	if cerr := ib.TeamTypeChanged(ctx, uid, vers, convID, teamType, remoteConv.Conv.Notifications); cerr != nil {
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

	ib := s.createInbox()
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

	if cerr := s.createInbox().TlfFinalize(ctx, uid, vers, convIDs, finalizeInfo); cerr != nil {
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
	previews []chat1.ConversationID, teamMemberRoleUpdate *chat1.TeamMemberRoleUpdate) (res types.MembershipUpdateRes, err error) {
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
			err := s.G().ConvSource.Clear(ctx, r.ConvID, uid)
			if err != nil {
				s.Debug(ctx, "MembershipUpdate: error clearing conv source: %+v", err)
			}
			res.UserRemovedConvs = append(res.UserRemovedConvs, r)
		} else {
			res.OthersRemovedConvs = append(res.OthersRemovedConvs, r)
		}
	}

	// Load the user joined conversations
	var userJoinedConvs []chat1.Conversation
	if len(userJoined) > 0 {
		var ibox types.Inbox
		ibox, _, err = s.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceRemoteOnly, nil,
			&chat1.GetInboxLocalQuery{
				ConvIDs: userJoined,
			})
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

	ib := s.createInbox()
	roleUpdates, cerr := ib.MembershipUpdate(ctx, uid, vers, userJoinedConvs, res.UserRemovedConvs,
		res.OthersJoinedConvs, res.OthersRemovedConvs, res.UserResetConvs,
		res.OthersResetConvs, teamMemberRoleUpdate)
	if cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return res, err
	}
	if len(roleUpdates) > 0 {
		convs, err := s.getConvsLocal(ctx, uid, roleUpdates)
		if err != nil {
			s.Debug(ctx, "MembershipUpdate: failed to read role update convs: %v", err)
			return res, err
		}
		res.RoleUpdates = convs
	}

	return res, nil
}

func (s *HybridInboxSource) ConversationsUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convUpdates []chat1.ConversationUpdate) (err error) {
	defer s.Trace(ctx, func() error { return err }, "ConversationUpdate")()

	ib := s.createInbox()
	if cerr := ib.ConversationsUpdate(ctx, uid, vers, convUpdates); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return err
	}

	return nil
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
	ib := s.createInbox()
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
	ib := s.createInbox()
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

func (s *HybridInboxSource) UpdateInboxVersion(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers) (err error) {
	defer s.Trace(ctx, func() error { return err }, "UpdateInboxVersion")()
	return s.createInbox().UpdateInboxVersion(ctx, uid, vers)
}

func (s *HybridInboxSource) modConversation(ctx context.Context, debugLabel string, uid gregor1.UID, convID chat1.ConversationID,
	mod func(context.Context, *storage.Inbox) error) (
	conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, debugLabel)()
	ib := s.createInbox()
	if cerr := mod(ctx, ib); cerr != nil {
		err = s.handleInboxError(ctx, cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "%v: unable to load conversation: convID: %s err: %v",
			debugLabel, convID, err)
		return nil, nil
	}
	return conv, nil
}

func (s *HybridInboxSource) TeamBotSettingsForConv(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (
	teambotSettings map[keybase1.UID]keybase1.TeamBotSettings, err error) {
	defer s.Trace(ctx, func() error { return err }, "TeamBotSettingsForConv")()
	rConv, err := s.createInbox().GetConversation(ctx, uid, convID)
	if err != nil {
		return nil, err
	}

	metadata := rConv.Conv.Metadata
	public := metadata.Visibility == keybase1.TLFVisibility_PUBLIC
	tlfID := metadata.IdTriple.Tlfid
	infoSource := CreateNameInfoSource(ctx, s.G(), metadata.MembersType)
	var tlfName string
	if rConv.LocalMetadata == nil {
		info, err := infoSource.LookupName(ctx, tlfID, public, "")
		if err != nil {
			return nil, err
		}
		tlfName = info.CanonicalName
	} else {
		tlfName = rConv.LocalMetadata.Name
	}

	teamBotSettings, err := infoSource.TeamBotSettings(ctx, tlfName, tlfID, metadata.MembersType, public)
	if err != nil {
		return nil, err
	}
	res := make(map[keybase1.UID]keybase1.TeamBotSettings)
	for uv, botSettings := range teamBotSettings {
		res[uv.Uid] = botSettings
	}
	return res, nil
}

func NewInboxSource(g *globals.Context, typ string, ri func() chat1.RemoteInterface) types.InboxSource {
	switch typ {
	case "hybrid":
		return NewHybridInboxSource(g, ri)
	default:
		return NewRemoteInboxSource(g, ri)
	}
}
