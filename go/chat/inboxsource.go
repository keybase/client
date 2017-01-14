package chat

import (
	"errors"
	"fmt"

	"strings"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type localizerPipeline struct {
	libkb.Contextified
	getTlfInterface func() keybase1.TlfInterface
}

func newLocalizerPipeline(g *libkb.GlobalContext, getTlfInterface func() keybase1.TlfInterface) *localizerPipeline {
	return &localizerPipeline{
		Contextified:    libkb.NewContextified(g),
		getTlfInterface: getTlfInterface,
	}
}

type BlockingLocalizer struct {
	libkb.Contextified
	pipeline *localizerPipeline
}

func NewBlockingLocalizer(g *libkb.GlobalContext, getTlfInterface func() keybase1.TlfInterface) *BlockingLocalizer {
	return &BlockingLocalizer{
		Contextified: libkb.NewContextified(g),
		pipeline:     newLocalizerPipeline(g, getTlfInterface),
	}
}

func (b *BlockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox chat1.Inbox) (res []chat1.ConversationLocal, err error) {

	res, err = b.pipeline.localizeConversationsPipeline(ctx, uid, inbox.ConvsUnverified, nil)
	if err != nil {
		return res, err
	}

	return res, nil
}

func (b *BlockingLocalizer) Name() string {
	return "blocking"
}

type NonblockInboxResult struct {
	ConvID   chat1.ConversationID
	Err      error
	ConvRes  *chat1.ConversationLocal
	InboxRes *chat1.Inbox
}

type NonblockingLocalizer struct {
	libkb.Contextified
	pipeline   *localizerPipeline
	localizeCb chan NonblockInboxResult
}

func NewNonblockingLocalizer(g *libkb.GlobalContext, localizeCb chan NonblockInboxResult,
	getTlfInterface func() keybase1.TlfInterface) *NonblockingLocalizer {
	return &NonblockingLocalizer{
		Contextified: libkb.NewContextified(g),
		pipeline:     newLocalizerPipeline(g, getTlfInterface),
		localizeCb:   localizeCb,
	}
}

func (b *NonblockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox chat1.Inbox) ([]chat1.ConversationLocal, error) {
	// Send inbox over localize channel
	b.localizeCb <- NonblockInboxResult{
		InboxRes: &inbox,
	}

	// Spawn off localization into its own goroutine and use cb to communicate with outside world
	bctx := BackgroundContext(ctx)
	go func() {
		b.pipeline.localizeConversationsPipeline(bctx, uid, inbox.ConvsUnverified,
			&b.localizeCb)

		// Shutdown localize channel
		close(b.localizeCb)
	}()

	return nil, nil
}

func (b *NonblockingLocalizer) Name() string {
	return "nonblocking"
}

func filterConvLocals(convLocals []chat1.ConversationLocal, rquery *chat1.GetInboxQuery,
	query *chat1.GetInboxLocalQuery, tlfInfo *TLFInfo) (res []chat1.ConversationLocal, err error) {

	for _, convLocal := range convLocals {
		if rquery != nil && rquery.TlfID != nil {
			// inbox query contained a TLF name, so check to make sure that
			// the conversation from the server matches tlfInfo from kbfs
			if convLocal.Info.TLFNameExpanded() != tlfInfo.CanonicalName {
				return nil, fmt.Errorf("server conversation TLF name mismatch: %s, expected %s", convLocal.Info.TLFNameExpanded(), tlfInfo.CanonicalName)
			}
			if convLocal.Info.Visibility != rquery.Visibility() {
				return nil, fmt.Errorf("server conversation TLF visibility mismatch: %s, expected %s", convLocal.Info.Visibility, rquery.Visibility())
			}
			if !tlfInfo.ID.Eq(convLocal.Info.Triple.Tlfid) {
				return nil, fmt.Errorf("server conversation TLF ID mismatch: %s, expected %s", convLocal.Info.Triple.Tlfid, tlfInfo.ID)
			}
			// tlfInfo.ID and rquery.TlfID should always match, but just in case:
			if !rquery.TlfID.Eq(convLocal.Info.Triple.Tlfid) {
				return nil, fmt.Errorf("server conversation TLF ID mismatch: %s, expected %s", convLocal.Info.Triple.Tlfid, rquery.TlfID)
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

type RemoteInboxSource struct {
	libkb.Contextified
	utils.DebugLabeler

	getTlfInterface  func() keybase1.TlfInterface
	getChatInterface func() chat1.RemoteInterface
}

func NewRemoteInboxSource(g *libkb.GlobalContext, ri func() chat1.RemoteInterface,
	tlf func() keybase1.TlfInterface) *RemoteInboxSource {
	return &RemoteInboxSource{
		Contextified:     libkb.NewContextified(g),
		DebugLabeler:     utils.NewDebugLabeler(g, "RemoteInboxSource"),
		getTlfInterface:  tlf,
		getChatInterface: ri,
	}
}

func (s *RemoteInboxSource) ReadRemote(ctx context.Context, uid gregor1.UID,
	localizer libkb.ChatLocalizer,
	query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (
	chat1.Inbox, *chat1.RateLimit, error) {
	return s.Read(ctx, uid, localizer, query, p)
}

func (s *RemoteInboxSource) Read(ctx context.Context, uid gregor1.UID, localizer libkb.ChatLocalizer,
	query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (
	chat1.Inbox, *chat1.RateLimit, error) {

	if localizer == nil {
		localizer = NewBlockingLocalizer(s.G(), s.getTlfInterface)
	}
	s.Debug(ctx, "Read: using localizer: %s", localizer.Name())

	rquery, tlfInfo, err := GetInboxQueryLocalToRemote(ctx, s.getTlfInterface(), query)
	if err != nil {
		return chat1.Inbox{}, nil, err
	}
	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      rquery,
		Pagination: p,
	})
	if err != nil {
		return chat1.Inbox{}, ib.RateLimit, err
	}

	res, err := localizer.Localize(ctx, uid, chat1.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: ib.Inbox.Full().Conversations,
		Pagination:      ib.Inbox.Full().Pagination,
	})
	if err != nil {
		return chat1.Inbox{}, ib.RateLimit, err
	}

	res, err = filterConvLocals(res, rquery, query, tlfInfo)
	if err != nil {
		return chat1.Inbox{}, ib.RateLimit, err
	}

	return chat1.Inbox{
		Version:         ib.Inbox.Full().Vers,
		Convs:           res,
		ConvsUnverified: ib.Inbox.Full().Conversations,
		Pagination:      ib.Inbox.Full().Pagination,
	}, ib.RateLimit, nil
}

func (s *RemoteInboxSource) NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	conv chat1.Conversation) error {
	return nil
}

func (s *RemoteInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed) error {
	return nil
}

func (s *RemoteInboxSource) ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msgID chat1.MessageID) error {
	return nil
}

func (s *RemoteInboxSource) SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, status chat1.ConversationStatus) error {
	return nil
}

func (s *RemoteInboxSource) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) error {
	return nil
}

type HybridInboxSource struct {
	libkb.Contextified
	utils.DebugLabeler

	syncer           *Syncer
	getSecretUI      func() libkb.SecretUI
	getTlfInterface  func() keybase1.TlfInterface
	getChatInterface func() chat1.RemoteInterface
}

func NewHybridInboxSource(g *libkb.GlobalContext,
	getTlfInterface func() keybase1.TlfInterface,
	getChatInterface func() chat1.RemoteInterface,
	getSecretUI func() libkb.SecretUI,
) *HybridInboxSource {
	return &HybridInboxSource{
		Contextified:     libkb.NewContextified(g),
		DebugLabeler:     utils.NewDebugLabeler(g, "HybridInboxSource"),
		getSecretUI:      getSecretUI,
		getTlfInterface:  getTlfInterface,
		getChatInterface: getChatInterface,
		syncer:           NewSyncer(g),
	}
}

func (s *HybridInboxSource) fetchRemoteInbox(ctx context.Context, query *chat1.GetInboxQuery,
	p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {

	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      query,
		Pagination: p,
	})
	if err != nil {
		return chat1.Inbox{}, ib.RateLimit, err
	}

	return chat1.Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: ib.Inbox.Full().Conversations,
		Pagination:      ib.Inbox.Full().Pagination,
	}, ib.RateLimit, nil
}

func (s *HybridInboxSource) ReadRemote(ctx context.Context, uid gregor1.UID,
	localizer libkb.ChatLocalizer, query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {

	if localizer == nil {
		localizer = NewBlockingLocalizer(s.G(), s.getTlfInterface)
	}
	s.Debug(ctx, "ReadRemote: using localizer: %s", localizer.Name())

	rquery, tlfInfo, err := GetInboxQueryLocalToRemote(ctx, s.getTlfInterface(), query)
	if err != nil {
		return chat1.Inbox{}, nil, err
	}

	inbox, rl, err := s.fetchRemoteInbox(ctx, rquery, p)
	if err != nil {
		return inbox, rl, err
	}

	// Localize
	inbox.Convs, err = localizer.Localize(ctx, uid, inbox)
	if err != nil {
		return inbox, rl, err
	}

	inbox.Convs, err = filterConvLocals(inbox.Convs, rquery, query, tlfInfo)
	if err != nil {
		return inbox, rl, err
	}

	return inbox, rl, err
}

func (s *HybridInboxSource) Read(ctx context.Context, uid gregor1.UID, localizer libkb.ChatLocalizer,
	query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {

	if localizer == nil {
		localizer = NewBlockingLocalizer(s.G(), s.getTlfInterface)
	}
	s.Debug(ctx, "Read: using localizer: %s", localizer.Name())

	rquery, tlfInfo, err := GetInboxQueryLocalToRemote(ctx, s.getTlfInterface(), query)
	if err != nil {
		return chat1.Inbox{}, nil, err
	}

	// Try local storage
	var inbox chat1.Inbox
	var rl *chat1.RateLimit
	inboxStore := storage.NewInbox(s.G(), uid, s.getSecretUI)

	vers, convs, pagination, cerr := inboxStore.Read(ctx, rquery, p)
	if cerr != nil {
		if _, ok := cerr.(storage.MissError); !ok {
			s.Debug(ctx, "Read: error fetching inbox: %s", cerr.Error())
		} else {
			s.Debug(ctx, "Read: storage miss")
		}

		// Go to the remote on miss
		inbox, rl, err = s.fetchRemoteInbox(ctx, rquery, p)
		if err != nil {
			return inbox, rl, err
		}

		// Write out to local storage
		if cerr := inboxStore.Merge(ctx, inbox.Version, inbox.ConvsUnverified, rquery, p); cerr != nil {
			return chat1.Inbox{}, rl, cerr
		}
	} else {
		s.Debug(ctx, "Read: hit local storage: uid: %s convs: %d", uid, len(convs))
		inbox = chat1.Inbox{
			Version:         vers,
			ConvsUnverified: convs,
			Pagination:      pagination,
		}
	}

	// Localize
	inbox.Convs, err = localizer.Localize(ctx, uid, inbox)
	if err != nil {
		return inbox, rl, err
	}

	inbox.Convs, err = filterConvLocals(inbox.Convs, rquery, query, tlfInfo)
	if err != nil {
		return inbox, rl, err
	}

	return inbox, rl, nil
}

func (s *HybridInboxSource) handleInboxError(err storage.Error, uid gregor1.UID) error {
	if _, ok := err.(storage.MissError); ok {
		return nil
	}
	if _, ok := err.(storage.VersionMismatchError); ok {
		s.syncer.SendChatStaleNotifications(uid)
		return nil
	}
	return err
}

func (s *HybridInboxSource) NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	conv chat1.Conversation) (err error) {
	defer s.Trace(ctx, func() error { return err }, "NewConversation")()
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).NewConversation(ctx, vers, conv); cerr != nil {
		err = s.handleInboxError(cerr, uid)
		return err
	}
	return nil
}

func (s *HybridInboxSource) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed) (err error) {
	defer s.Trace(ctx, func() error { return err }, "NewMessage")()
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).NewMessage(ctx, vers, convID, msg); cerr != nil {
		err = s.handleInboxError(cerr, uid)
		return err
	}
	return nil
}

func (s *HybridInboxSource) ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msgID chat1.MessageID) (err error) {
	defer s.Trace(ctx, func() error { return err }, "ReadMessage")()
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).ReadMessage(ctx, vers, convID, msgID); cerr != nil {
		err = s.handleInboxError(cerr, uid)
		return err
	}
	return nil
}

func (s *HybridInboxSource) SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, status chat1.ConversationStatus) (err error) {
	defer s.Trace(ctx, func() error { return err }, "SetStatus")()
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).SetStatus(ctx, vers, convID, status); cerr != nil {
		err = s.handleInboxError(cerr, uid)
		return err
	}
	return nil
}

func (s *HybridInboxSource) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) (err error) {
	defer s.Trace(ctx, func() error { return err }, "TlfFinalize")()
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).TlfFinalize(ctx, vers, convIDs, finalizeInfo); cerr != nil {
		err = s.handleInboxError(cerr, uid)
		return err
	}
	return nil
}

func (s *localizerPipeline) localizeConversationsPipeline(ctx context.Context, uid gregor1.UID,
	convs []chat1.Conversation, localizeCb *chan NonblockInboxResult) ([]chat1.ConversationLocal, error) {

	// Fetch conversation local information in parallel
	type jobRes struct {
		conv  chat1.ConversationLocal
		index int
	}
	type job struct {
		conv  chat1.Conversation
		index int
	}
	eg, ctx := errgroup.WithContext(ctx)
	convCh := make(chan job)
	retCh := make(chan jobRes)
	eg.Go(func() error {
		defer close(convCh)
		for i, conv := range convs {
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
						*localizeCb <- NonblockInboxResult{
							Err:    errors.New(convLocal.Error.Message),
							ConvID: conv.conv.Metadata.ConversationID,
						}
					} else {
						*localizeCb <- NonblockInboxResult{
							ConvRes: &convLocal,
							ConvID:  convLocal.Info.Id,
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

func (s *localizerPipeline) localizeConversation(ctx context.Context, uid gregor1.UID,
	conversationRemote chat1.Conversation) (conversationLocal chat1.ConversationLocal) {

	s.G().Log.Debug("localizeConversation: localizing %d msgs", len(conversationRemote.MaxMsgs))

	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id:         conversationRemote.Metadata.ConversationID,
		Visibility: conversationRemote.Metadata.Visibility,
		Triple:     conversationRemote.Metadata.IdTriple,
		Status:     conversationRemote.Metadata.Status,
	}
	conversationLocal.Info.FinalizeInfo = conversationRemote.Metadata.FinalizeInfo
	for _, super := range conversationRemote.Supersedes {
		conversationLocal.Supersedes = append(conversationLocal.Supersedes, super.ConversationID)
	}
	for _, super := range conversationRemote.SupersededBy {
		conversationLocal.SupersededBy = append(conversationLocal.SupersededBy, super.ConversationID)
	}
	if conversationRemote.ReaderInfo == nil {
		errMsg := "empty ReaderInfo from server?"
		conversationLocal.Error = &chat1.ConversationErrorLocal{
			Message:    errMsg,
			RemoteConv: conversationRemote,
			Permanent:  false,
		}
		return conversationLocal
	}
	conversationLocal.ReaderInfo = *conversationRemote.ReaderInfo

	if len(conversationRemote.MaxMsgs) == 0 {
		errMsg := "conversation has an empty MaxMsgs field"
		conversationLocal.Error = &chat1.ConversationErrorLocal{
			Message:    errMsg,
			RemoteConv: conversationRemote,
			Permanent:  false,
		}
		return conversationLocal
	}

	var err error
	conversationLocal.MaxMessages, err = s.G().ConvSource.GetMessagesWithRemotes(ctx,
		conversationRemote.Metadata.ConversationID, uid, conversationRemote.MaxMsgs, conversationRemote.Metadata.FinalizeInfo)
	if err != nil {
		conversationLocal.Error = &chat1.ConversationErrorLocal{
			Message:    err.Error(),
			RemoteConv: conversationRemote,
			Permanent:  s.isErrPermanent(err),
		}
		return conversationLocal
	}

	// Set to true later if visible messages are in max messages.
	conversationLocal.IsEmpty = true

	var maxValidID chat1.MessageID
	for _, mm := range conversationLocal.MaxMessages {
		if mm.IsValid() {
			body := mm.Valid().MessageBody
			typ, err := body.MessageType()
			if err != nil {
				s.G().Log.Debug("localizeConversation: failed to get message type: convID: %s id: %d",
					conversationRemote.Metadata.ConversationID, mm.GetMessageID())
				continue
			}
			if typ == chat1.MessageType_METADATA {
				conversationLocal.Info.TopicName = body.Metadata().ConversationTitle
			}
			if utils.IsVisibleChatMessageType(typ) {
				conversationLocal.IsEmpty = false
			}

			if mm.GetMessageID() >= maxValidID {
				conversationLocal.Info.TlfName = mm.Valid().ClientHeader.TlfName
				maxValidID = mm.GetMessageID()
			}
			conversationLocal.Info.Triple = mm.Valid().ClientHeader.Conv
		}
	}

	if len(conversationLocal.Info.TlfName) == 0 {
		errMsg := "no valid message in the conversation"
		conversationLocal.Error = &chat1.ConversationErrorLocal{
			Message:    errMsg,
			RemoteConv: conversationRemote,
			Permanent:  false,
		}
		return conversationLocal
	}

	// Verify ConversationID is derivable from ConversationIDTriple
	if !conversationLocal.Info.Triple.Derivable(conversationLocal.Info.Id) {
		errMsg := fmt.Sprintf("unexpected response from server: conversation ID is not derivable from conversation triple. triple: %#+v; Id: %x",
			conversationLocal.Info.Triple, conversationLocal.Info.Id)
		conversationLocal.Error = &chat1.ConversationErrorLocal{
			Message:    errMsg,
			RemoteConv: conversationRemote,
			Permanent:  false,
		}
		return conversationLocal
	}

	// Only do this check if there is a chance the TLF name might be an SBS name.
	if s.needsCanonicalize(conversationLocal.Info.TlfName) {
		info, err := LookupTLF(ctx, s.getTlfInterface(), conversationLocal.Info.TLFNameExpanded(), conversationLocal.Info.Visibility)
		if err != nil {
			errMsg := err.Error()
			conversationLocal.Error = &chat1.ConversationErrorLocal{
				Message:    errMsg,
				RemoteConv: conversationRemote,
				Permanent:  s.isErrPermanent(err),
			}
			return conversationLocal
		}
		// Not sure about the utility of this TlfName assignment, but the previous code did this:
		conversationLocal.Info.TlfName = info.CanonicalName
	}

	conversationLocal.Info.WriterNames, conversationLocal.Info.ReaderNames, err = utils.ReorderParticipants(
		ctx,
		s.G().GetUPAKLoader(),
		conversationLocal.Info.TlfName,
		conversationRemote.Metadata.ActiveList)
	if err != nil {
		errMsg := fmt.Sprintf("error reordering participants: %v", err.Error())
		conversationLocal.Error = &chat1.ConversationErrorLocal{
			Message:    errMsg,
			RemoteConv: conversationRemote,
			Permanent:  s.isErrPermanent(err),
		}
		return conversationLocal
	}

	// verify Conv matches ConversationIDTriple in MessageClientHeader
	if !conversationRemote.Metadata.IdTriple.Eq(conversationLocal.Info.Triple) {
		errMsg := "server header conversation triple does not match client header triple"
		conversationLocal.Error = &chat1.ConversationErrorLocal{
			Message:    errMsg,
			RemoteConv: conversationRemote,
			Permanent:  false,
		}
		return conversationLocal
	}

	return conversationLocal
}

func GetInboxQueryLocalToRemote(ctx context.Context,
	tlfInterface keybase1.TlfInterface, lquery *chat1.GetInboxLocalQuery) (
	rquery *chat1.GetInboxQuery, info *TLFInfo, err error) {

	if lquery == nil {
		return nil, nil, nil
	}

	rquery = &chat1.GetInboxQuery{}
	if lquery.TlfName != nil && len(*lquery.TlfName) > 0 {
		var err error
		info, err = LookupTLF(ctx, tlfInterface, *lquery.TlfName, lquery.Visibility())
		if err != nil {
			return nil, nil, err
		}
		rquery.TlfID = &info.ID
	}

	rquery.After = lquery.After
	rquery.Before = lquery.Before
	rquery.TlfVisibility = lquery.TlfVisibility
	rquery.TopicType = lquery.TopicType
	rquery.UnreadOnly = lquery.UnreadOnly
	rquery.ReadOnly = lquery.ReadOnly
	rquery.ComputeActiveList = lquery.ComputeActiveList
	rquery.ConvID = lquery.ConvID
	rquery.OneChatTypePerTLF = lquery.OneChatTypePerTLF
	rquery.Status = lquery.Status

	return rquery, info, nil
}

func NewInboxSource(g *libkb.GlobalContext, typ string, ri func() chat1.RemoteInterface,
	si func() libkb.SecretUI, ti func() keybase1.TlfInterface) libkb.InboxSource {
	remoteInbox := NewRemoteInboxSource(g, ri, ti)
	switch typ {
	case "hybrid":
		return NewHybridInboxSource(g, ti, ri, si)
	default:
		return remoteInbox
	}
}
