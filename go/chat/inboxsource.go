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

type getMessagesRes struct {
	err    error
	errTyp chat1.ConversationErrorType
	msgs   []chat1.MessageUnboxed
}

type getMessagesFunc func(context.Context, chat1.ConversationID, gregor1.UID, []chat1.MessageBoxed,
	*chat1.ConversationFinalizeInfo) getMessagesRes

type localizerPipeline struct {
	libkb.Contextified
	utils.DebugLabeler

	getTlfInterface func() keybase1.TlfInterface
	getMessages     getMessagesFunc
}

func newLocalizerPipeline(g *libkb.GlobalContext, getTlfInterface func() keybase1.TlfInterface) *localizerPipeline {
	return &localizerPipeline{
		Contextified:    libkb.NewContextified(g),
		DebugLabeler:    utils.NewDebugLabeler(g, "localizerPipeline", false),
		getTlfInterface: getTlfInterface,
	}
}

func newLocalizerPipelineCustom(g *libkb.GlobalContext, getTlfInterface func() keybase1.TlfInterface,
	getMessages getMessagesFunc) *localizerPipeline {
	return &localizerPipeline{
		Contextified:    libkb.NewContextified(g),
		DebugLabeler:    utils.NewDebugLabeler(g, "localizerPipeline", false),
		getTlfInterface: getTlfInterface,
		getMessages:     getMessages,
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
	Err      *chat1.ConversationErrorLocal
	ConvRes  *chat1.ConversationLocal
	InboxRes *chat1.Inbox
}

type NonblockingLocalizer struct {
	libkb.Contextified
	utils.DebugLabeler

	pipeline   *localizerPipeline
	localizeCb chan NonblockInboxResult
}

func NewNonblockingLocalizer(g *libkb.GlobalContext, localizeCb chan NonblockInboxResult,
	getTlfInterface func() keybase1.TlfInterface) *NonblockingLocalizer {
	return &NonblockingLocalizer{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "NonblockingLocalizer", false),
		pipeline:     newLocalizerPipeline(g, getTlfInterface),
		localizeCb:   localizeCb,
	}
}

func (b *NonblockingLocalizer) filterInboxRes(ctx context.Context, inbox chat1.Inbox, uid gregor1.UID) chat1.Inbox {

	f := func(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msgs []chat1.MessageBoxed, finalizeInfo *chat1.ConversationFinalizeInfo) getMessagesRes {

		var msgIDs []chat1.MessageID
		for _, msg := range msgs {
			msgIDs = append(msgIDs, msg.GetMessageID())
		}

		st := storage.New(b.G(), func() libkb.SecretUI { return DelivererSecretUI{} })
		res, err := st.FetchMessages(ctx, convID, uid, msgIDs)
		if err != nil {
			// Just say we didn't find it in this case
			return getMessagesRes{
				err:    err,
				errTyp: chat1.ConversationErrorType_LOCALMAXMESSAGENOTFOUND,
			}
		}

		// Make sure we get them all
		var foundMsgs []chat1.MessageUnboxed
		for _, msg := range res {
			if msg != nil {
				foundMsgs = append(foundMsgs, *msg)
			}
		}

		if len(foundMsgs) != len(msgs) {
			return getMessagesRes{
				err:    errors.New("missing messages locally"),
				errTyp: chat1.ConversationErrorType_LOCALMAXMESSAGENOTFOUND,
			}
		}

		return getMessagesRes{
			msgs: foundMsgs,
		}
	}

	localizer := newLocalizerPipelineCustom(b.G(), b.pipeline.getTlfInterface, f)
	convs, err := localizer.localizeConversationsPipeline(ctx, uid, inbox.ConvsUnverified, nil)
	if err != nil {
		// Any errors we just return original inbox
		b.Debug(ctx, "filterInboxRes: error running localize pipeline: %s", err.Error())
		return inbox
	}

	cmap := make(map[string]chat1.ConversationLocal)
	for _, conv := range convs {
		cmap[conv.GetConvID().String()] = conv
	}

	// Loop through and look for empty convs or known errors and skip them
	var res []chat1.Conversation
	for _, conv := range inbox.ConvsUnverified {
		localConv := cmap[conv.GetConvID().String()]

		if localConv.Error != nil &&
			localConv.Error.Typ != chat1.ConversationErrorType_LOCALMAXMESSAGENOTFOUND {
			b.Debug(ctx, "filterInboxRes: skipping because error: convID: %s err: %s", conv.GetConvID(),
				localConv.Error.Message)
			continue
		}

		if localConv.Error == nil && localConv.IsEmpty {
			b.Debug(ctx, "filterInboxRes: skipping because empty: convID: %s", conv.GetConvID())
			continue
		}

		res = append(res, conv)
	}

	return chat1.Inbox{
		Version:         inbox.Version,
		ConvsUnverified: res,
		Convs:           inbox.Convs,
		Pagination:      inbox.Pagination,
	}
}

func (b *NonblockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox chat1.Inbox) ([]chat1.ConversationLocal, error) {

	// Run some easy filters for empty messages and known errors to optimize UI drawing behavior
	filteredInbox := b.filterInboxRes(ctx, inbox, uid)

	// Send inbox over localize channel
	b.localizeCb <- NonblockInboxResult{
		InboxRes: &filteredInbox,
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
				if convLocal.Error == nil {
					return nil, fmt.Errorf("server conversation TLF name mismatch: %s, expected %s", convLocal.Info.TLFNameExpanded(), tlfInfo.CanonicalName)
				}
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

type baseInboxSource struct {
	libkb.Contextified
	utils.DebugLabeler
}

func newBaseInboxSource(g *libkb.GlobalContext) *baseInboxSource {
	return &baseInboxSource{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "baseInboxSource", false),
	}
}

func (b *baseInboxSource) notifyTlfFinalize(ctx context.Context, username string) {
	// Let the rest of the system know this user has changed
	finalizeUser, err := libkb.LoadUser(libkb.LoadUserArg{
		Name: username,
	})
	if err != nil {
		b.Debug(ctx, "notifyTlfFinalize: failed to load finalize user, skipping user changed notification: err: %s", err.Error())
	} else {
		b.G().UserChanged(finalizeUser.GetUID())
	}
}

type RemoteInboxSource struct {
	libkb.Contextified
	utils.DebugLabeler
	*baseInboxSource

	getTlfInterface  func() keybase1.TlfInterface
	getChatInterface func() chat1.RemoteInterface
}

func NewRemoteInboxSource(g *libkb.GlobalContext, ri func() chat1.RemoteInterface,
	tlf func() keybase1.TlfInterface) *RemoteInboxSource {
	return &RemoteInboxSource{
		Contextified:     libkb.NewContextified(g),
		DebugLabeler:     utils.NewDebugLabeler(g, "RemoteInboxSource", false),
		baseInboxSource:  newBaseInboxSource(g),
		getTlfInterface:  tlf,
		getChatInterface: ri,
	}
}

func (s *RemoteInboxSource) ReadNoCache(ctx context.Context, uid gregor1.UID,
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

func (s *RemoteInboxSource) ReadRemote(ctx context.Context, uid gregor1.UID,
	q *chat1.GetInboxLocalQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {
	lq, _, err := GetInboxQueryLocalToRemote(ctx, s.getTlfInterface(), q)
	if err != nil {
		return chat1.Inbox{}, nil, err
	}
	return readRemote(ctx, s.getChatInterface(), uid, lq, p)
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

func (s *RemoteInboxSource) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) ([]chat1.ConversationLocal, error) {
	// Notify rest of system about reset
	s.notifyTlfFinalize(ctx, finalizeInfo.ResetUser)
	return nil, nil
}

type HybridInboxSource struct {
	libkb.Contextified
	utils.DebugLabeler
	*baseInboxSource

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
		DebugLabeler:     utils.NewDebugLabeler(g, "HybridInboxSource", false),
		baseInboxSource:  newBaseInboxSource(g),
		getSecretUI:      getSecretUI,
		getTlfInterface:  getTlfInterface,
		getChatInterface: getChatInterface,
		syncer:           NewSyncer(g),
	}
}

func (s *HybridInboxSource) fetchRemoteInbox(ctx context.Context, query *chat1.GetInboxQuery,
	p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {

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

	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      &rquery,
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

func (s *HybridInboxSource) ReadNoCache(ctx context.Context, uid gregor1.UID,
	localizer libkb.ChatLocalizer, query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {

	if localizer == nil {
		localizer = NewBlockingLocalizer(s.G(), s.getTlfInterface)
	}
	s.Debug(ctx, "ReadNoCache: using localizer: %s", localizer.Name())

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

func (s *HybridInboxSource) ReadRemote(ctx context.Context, uid gregor1.UID,
	q *chat1.GetInboxLocalQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {
	lq, _, err := GetInboxQueryLocalToRemote(ctx, s.getTlfInterface(), q)
	if err != nil {
		return chat1.Inbox{}, nil, err
	}
	return readRemote(ctx, s.getChatInterface(), uid, lq, p)
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

func (s *HybridInboxSource) getConvLocal(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (conv *chat1.ConversationLocal, err error) {
	// Read back affected conversation so we can send it to the frontend
	ib, _, err := s.Read(ctx, uid, nil, &chat1.GetInboxLocalQuery{
		ConvID: &convID,
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
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).NewMessage(ctx, vers, convID, msg); cerr != nil {
		err = s.handleInboxError(cerr, uid)
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
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).ReadMessage(ctx, vers, convID, msgID); cerr != nil {
		err = s.handleInboxError(cerr, uid)
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
	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).SetStatus(ctx, vers, convID, status); cerr != nil {
		err = s.handleInboxError(cerr, uid)
		return nil, err
	}
	if conv, err = s.getConvLocal(ctx, uid, convID); err != nil {
		s.Debug(ctx, "SetStatus: unable to load conversation: convID: %s err: %s", convID, err.Error())
		return nil, nil
	}
	return conv, nil
}

func (s *HybridInboxSource) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) (convs []chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, func() error { return err }, "TlfFinalize")()

	if cerr := storage.NewInbox(s.G(), uid, s.getSecretUI).TlfFinalize(ctx, vers, convIDs, finalizeInfo); cerr != nil {
		err = s.handleInboxError(cerr, uid)
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
						s.Debug(ctx, "error localizing: convID: %s err: %s", conv.conv.GetConvID(),
							convLocal.Error.Message)
						*localizeCb <- NonblockInboxResult{
							Err:    convLocal.Error,
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

func getUnverifiedTlfNameForErrors(conversationRemote chat1.Conversation) string {
	var tlfName string
	var latestMsgID chat1.MessageID
	for _, msg := range conversationRemote.MaxMsgs {
		if msg.GetMessageID() > latestMsgID {
			latestMsgID = msg.GetMessageID()
			tlfName = msg.ClientHeader.TLFNameExpanded(conversationRemote.Metadata.FinalizeInfo)
		}
	}
	return tlfName
}

func (s *localizerPipeline) localizeConversation(ctx context.Context, uid gregor1.UID,
	conversationRemote chat1.Conversation) (conversationLocal chat1.ConversationLocal) {

	s.Debug(ctx, "localizing %d msgs", len(conversationRemote.MaxMsgs))

	unverifiedTLFName := getUnverifiedTlfNameForErrors(conversationRemote)

	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id:         conversationRemote.Metadata.ConversationID,
		Visibility: conversationRemote.Metadata.Visibility,
		Triple:     conversationRemote.Metadata.IdTriple,
		Status:     conversationRemote.Metadata.Status,
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
			errMsg, conversationRemote, false, unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
		return conversationLocal
	}
	conversationLocal.ReaderInfo = *conversationRemote.ReaderInfo

	if len(conversationRemote.MaxMsgs) == 0 {
		errMsg := "conversation has an empty MaxMsgs field"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, false, unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
		return conversationLocal
	}

	// Conversation is not empty as long as we have a visible message, even if they are
	// errors
	conversationLocal.IsEmpty = true
	for _, maxMsg := range conversationRemote.MaxMsgs {
		if utils.IsVisibleChatMessageType(maxMsg.GetMessageType()) {
			conversationLocal.IsEmpty = false
			break
		}
	}

	// Fetch max messages unboxed, using either a custom function or through
	// the conversation source configured in the global context
	var err error
	if s.getMessages != nil {
		gmRes := s.getMessages(ctx, conversationRemote.GetConvID(),
			uid, conversationRemote.MaxMsgs, conversationRemote.Metadata.FinalizeInfo)
		if gmRes.err != nil {
			convErr := s.checkRekeyError(ctx, gmRes.err, conversationRemote, unverifiedTLFName)
			if convErr != nil {
				conversationLocal.Error = convErr
				return conversationLocal
			}

			conversationLocal.Error = chat1.NewConversationErrorLocal(
				gmRes.err.Error(), conversationRemote, s.isErrPermanent(gmRes.err), unverifiedTLFName, gmRes.errTyp, nil)
			return conversationLocal
		}
		conversationLocal.MaxMessages = gmRes.msgs
	} else {
		conversationLocal.MaxMessages, err = s.G().ConvSource.GetMessagesWithRemotes(ctx,
			conversationRemote.Metadata.ConversationID, uid, conversationRemote.MaxMsgs, conversationRemote.Metadata.FinalizeInfo)
		if err != nil {
			convErr := s.checkRekeyError(ctx, err, conversationRemote, unverifiedTLFName)
			if convErr != nil {
				conversationLocal.Error = convErr
				return conversationLocal
			}

			conversationLocal.Error = chat1.NewConversationErrorLocal(
				err.Error(), conversationRemote, s.isErrPermanent(err), unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
			return conversationLocal
		}
	}

	var maxValidID chat1.MessageID
	superXform := newSupersedesTransform(s.G())

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
			if newMsg, err = superXform.run(ctx, conversationLocal.GetConvID(), uid,
				[]chat1.MessageUnboxed{mm}, conversationRemote.Metadata.FinalizeInfo); err != nil {
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
			errMsg, conversationRemote, false, unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
		return conversationLocal
	}

	// Verify ConversationID is derivable from ConversationIDTriple
	if !conversationLocal.Info.Triple.Derivable(conversationLocal.Info.Id) {
		errMsg := fmt.Sprintf("unexpected response from server: conversation ID is not derivable from conversation triple. triple: %#+v; Id: %x",
			conversationLocal.Info.Triple, conversationLocal.Info.Id)
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, false, unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
		return conversationLocal
	}

	// Only do this check if there is a chance the TLF name might be an SBS name.
	if s.needsCanonicalize(conversationLocal.Info.TlfName) {
		info, err := LookupTLF(ctx, s.getTlfInterface(), conversationLocal.Info.TLFNameExpanded(), conversationLocal.Info.Visibility)
		if err != nil {
			errMsg := err.Error()
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, s.isErrPermanent(err), unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
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
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, s.isErrPermanent(err), unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
		return conversationLocal
	}

	// verify Conv matches ConversationIDTriple in MessageClientHeader
	if !conversationRemote.Metadata.IdTriple.Eq(conversationLocal.Info.Triple) {
		errMsg := "server header conversation triple does not match client header triple"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, false, unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
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
			errMsg, conversationRemote, false, unverifiedTLFName, chat1.ConversationErrorType_MISC, nil)
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
	convErrTyp := chat1.ConversationErrorType_MISC
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

	if len(conversationRemote.MaxMsgs) == 0 {
		return nil, errors.New("can't determine isPrivate with no maxMsgs")
	}
	rekeyInfo.TlfPublic = conversationRemote.MaxMsgs[0].ClientHeader.TlfPublic

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
		fromErr.Error(), conversationRemote, s.isErrPermanent(err), unverifiedTLFName, convErrTyp, rekeyInfo)
	return convErrorLocal, nil
}

func readRemote(ctx context.Context, ri chat1.RemoteInterface, uid gregor1.UID,
	q *chat1.GetInboxQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error) {
	inbox, err := ri.GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      q,
		Pagination: p,
	})

	if err != nil {
		return chat1.Inbox{}, inbox.RateLimit, storage.RemoteError{Msg: err.Error()}
	}

	return chat1.Inbox{
		ConvsUnverified: inbox.Inbox.Full().Conversations,
		Pagination:      inbox.Inbox.Full().Pagination,
		Version:         inbox.Inbox.Full().Vers,
	}, inbox.RateLimit, nil
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
