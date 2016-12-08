package chat

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type Inbox struct {
	Version         chat1.InboxVers
	ConvsUnverified []chat1.Conversation
	Convs           []chat1.ConversationLocal
	Pagination      *chat1.Pagination
}

type InboxSource interface {
	// Read reads inbox from the source. We specify the identify behavior as a
	// parameter here to give it a chance to re-run identify an get latest
	// identify results even when pulling from local storage. The local storage
	// doesn't include identify information such as proof breaks.
	Read(ctx context.Context, uid gregor1.UID, query *chat1.GetInboxLocalQuery,
		p *chat1.Pagination, identifyBehavior keybase1.TLFIdentifyBehavior) (Inbox, *chat1.RateLimit, error)
}

type localizer struct {
	libkb.Contextified
	getTlfInterface func() keybase1.TlfInterface
}

func newLocalizer(g *libkb.GlobalContext, getTlfInterface func() keybase1.TlfInterface) *localizer {
	return &localizer{
		Contextified:    libkb.NewContextified(g),
		getTlfInterface: getTlfInterface,
	}
}

type RemoteInboxSource struct {
	libkb.Contextified

	localizer        *localizer
	boxer            *Boxer
	getTlfInterface  func() keybase1.TlfInterface
	getChatInterface func() chat1.RemoteInterface
}

func NewRemoteInboxSource(g *libkb.GlobalContext, boxer *Boxer, ri func() chat1.RemoteInterface,
	tlf func() keybase1.TlfInterface) *RemoteInboxSource {
	return &RemoteInboxSource{
		Contextified:     libkb.NewContextified(g),
		localizer:        newLocalizer(g, tlf),
		getTlfInterface:  tlf,
		getChatInterface: ri,
		boxer:            boxer,
	}
}

func (s *RemoteInboxSource) Read(ctx context.Context, uid gregor1.UID,
	query *chat1.GetInboxLocalQuery, p *chat1.Pagination,
	identifyBehavior keybase1.TLFIdentifyBehavior) (
	Inbox, *chat1.RateLimit, error) {

	rquery, _, err := utils.GetInboxQueryLocalToRemote(ctx,
		s.getTlfInterface(), query, identifyBehavior)
	if err != nil {
		return Inbox{}, nil, err
	}
	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      rquery,
		Pagination: p,
	})
	if err != nil {
		return Inbox{}, ib.RateLimit, err
	}

	var res []chat1.ConversationLocal
	ctx, _ = utils.GetUserInfoMapper(ctx, s.G())
	convLocals, err := s.localizer.localizeConversationsPipeline(ctx, uid, ib.Inbox.Full().Conversations,
		identifyBehavior, nil)
	if err != nil {
		return Inbox{}, ib.RateLimit, err
	}
	for _, convLocal := range convLocals {
		if rquery != nil && rquery.TlfID != nil {
			// Verify using signed TlfName to make sure server returned genuine
			// conversation.
			signedTlfID, _, _, err := utils.CryptKeysWrapper(ctx, s.getTlfInterface(),
				convLocal.Info.TlfName, identifyBehavior)
			if err != nil {
				return Inbox{}, ib.RateLimit, err
			}
			// The *rquery.TlfID is trusted source of TLF ID here since it's derived
			// from the TLF name in the query.
			if !signedTlfID.Eq(*rquery.TlfID) || !signedTlfID.Eq(convLocal.Info.Triple.Tlfid) {
				return Inbox{}, ib.RateLimit, errors.New("server returned conversations for different TLF than query")
			}
		}

		// server can't query on topic name, so we have to do it ourselves in the loop
		if query != nil && query.TopicName != nil && *query.TopicName != convLocal.Info.TopicName {
			continue
		}

		res = append(res, convLocal)
	}

	return Inbox{
		Version:    ib.Inbox.Full().Vers,
		Convs:      res,
		Pagination: ib.Inbox.Full().Pagination,
	}, ib.RateLimit, nil
}

type NonblockInboxResult struct {
	ConvID   chat1.ConversationID
	Err      error
	ConvRes  *chat1.ConversationLocal
	InboxRes *Inbox
}

type NonblockRemoteInboxSource struct {
	libkb.Contextified

	localizer        *localizer
	boxer            *Boxer
	localizeCb       chan NonblockInboxResult
	getTlfInterface  func() keybase1.TlfInterface
	getChatInterface func() chat1.RemoteInterface
}

func NewNonblockRemoteInboxSource(g *libkb.GlobalContext, boxer *Boxer, ri func() chat1.RemoteInterface,
	tlf func() keybase1.TlfInterface, localizeCb chan NonblockInboxResult) *NonblockRemoteInboxSource {
	return &NonblockRemoteInboxSource{
		Contextified:     libkb.NewContextified(g),
		getTlfInterface:  tlf,
		getChatInterface: ri,
		boxer:            boxer,
		localizeCb:       localizeCb,
		localizer:        newLocalizer(g, tlf),
	}
}

func (s *NonblockRemoteInboxSource) Read(ctx context.Context, uid gregor1.UID,
	query *chat1.GetInboxLocalQuery, p *chat1.Pagination,
	identifyBehavior keybase1.TLFIdentifyBehavior) (
	Inbox, *chat1.RateLimit, error) {

	rquery, _, err := utils.GetInboxQueryLocalToRemote(ctx,
		s.getTlfInterface(), query, identifyBehavior)
	if err != nil {
		return Inbox{}, nil, err
	}
	ib, err := s.getChatInterface().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      rquery,
		Pagination: p,
	})
	if err != nil {
		return Inbox{}, ib.RateLimit, err
	}
	inbox := Inbox{
		Version:         ib.Inbox.Full().Vers,
		ConvsUnverified: ib.Inbox.Full().Conversations,
		Pagination:      ib.Inbox.Full().Pagination,
	}

	// Send inbox over localize channel
	s.localizeCb <- NonblockInboxResult{
		InboxRes: &inbox,
	}

	// Spawn off localization into its own goroutine and use cb to communicate with outside world
	go func() {
		bctx, _ := utils.GetUserInfoMapper(context.Background(), s.G())
		s.localizer.localizeConversationsPipeline(bctx, uid,
			ib.Inbox.Full().Conversations, identifyBehavior, &s.localizeCb)

		// Shutdown localize channel
		close(s.localizeCb)
	}()

	return inbox, ib.RateLimit, nil
}

type HybridInboxSource struct {
	libkb.Contextified

	remote *RemoteInboxSource
	inbox  *storage.Inbox
}

func NewHybridInboxSource(g *libkb.GlobalContext, inbox *storage.Inbox, remote *RemoteInboxSource) *HybridInboxSource {
	return &HybridInboxSource{
		Contextified: libkb.NewContextified(g),
		remote:       remote,
		inbox:        inbox,
	}
}

func (s *HybridInboxSource) isPaginationSafe(p *chat1.Pagination) bool {
	return p == nil || (len(p.Next) == 0 && len(p.Previous) == 0 && p.Num >= 5)
}

func (s *HybridInboxSource) isSaveable(query *chat1.GetInboxLocalQuery, p *chat1.Pagination) bool {
	// TODO: makethis work
	return true
}

func (s *HybridInboxSource) Read(ctx context.Context, uid gregor1.UID, query *chat1.GetInboxLocalQuery,
	p *chat1.Pagination, identifyBehavior keybase1.TLFIdentifyBehavior) (Inbox, *chat1.RateLimit, error) {

	// Try local storage
	saveable := s.isSaveable(query, p)
	if saveable {
		vers, convsStorage, cerr := s.inbox.Read(query, p)
		if cerr != nil {
			if _, ok := cerr.(libkb.ChatStorageMissError); !ok {
				s.G().Log.Error("HybridInboxSource: error fetch inbox locally: %s", cerr.Error())
			}
		} else {
			convs := make([]chat1.ConversationLocal, 0, len(convsStorage))
			for _, cs := range convsStorage {
				_, _, failures, err := utils.CryptKeysWrapper(ctx,
					s.remote.getTlfInterface(), cs.Info.TlfName, identifyBehavior)
				if err != nil {
					return Inbox{}, nil, err
				}
				convs = append(convs, storage.ToConversationLocal(cs, failures))
			}
			s.G().Log.Debug("HybridInboxSource: hit local storage: uid: %s convs: %d", uid, len(convs))
			// TODO: pagination
			return Inbox{
				Version:    vers,
				Convs:      convs,
				Pagination: nil,
			}, nil, nil
		}
	}

	// Go to the remote on miss
	ib, rl, err := s.remote.Read(ctx, uid, query, p, identifyBehavior)
	if err != nil {
		return Inbox{}, rl, err
	}

	// Write out to local storage
	if saveable {
		convs := make([]storage.ConversationStorage, 0, len(ib.Convs))
		for _, c := range ib.Convs {
			convs = append(convs, storage.FromConversationLocal(c))
		}
		if cerr := s.inbox.Replace(ib.Version, convs); cerr != nil {
			return Inbox{}, rl, cerr
		}
	}

	return ib, rl, nil
}

func (s *localizer) localizeConversationsPipeline(ctx context.Context, uid gregor1.UID,
	convs []chat1.Conversation, identifyBehavior keybase1.TLFIdentifyBehavior,
	localizeCb *chan NonblockInboxResult) ([]chat1.ConversationLocal, error) {

	// Fetch conversation local information in parallel
	ctx, _ = utils.GetUserInfoMapper(ctx, s.G())
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
				convLocal, err := s.localizeConversation(ctx, uid, conv.conv, identifyBehavior)
				if err != nil {
					// If we got an error, then send that back as a result
					if localizeCb != nil {
						*localizeCb <- NonblockInboxResult{
							Err:    err,
							ConvID: conv.conv.Metadata.ConversationID,
						}
					}
					return err
				}
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
					*localizeCb <- NonblockInboxResult{
						ConvRes: &convLocal,
						ConvID:  convLocal.Info.Id,
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

func (s *localizer) localizeConversation(ctx context.Context, uid gregor1.UID,
	conversationRemote chat1.Conversation, identifyBehavior keybase1.TLFIdentifyBehavior) (
	conversationLocal chat1.ConversationLocal, err error) {

	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id: conversationRemote.Metadata.ConversationID,
	}

	if len(conversationRemote.MaxMsgs) == 0 {
		errMsg := "conversation has an empty MaxMsgs field"
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}

	s.G().Log.Debug("localizeConversation: localizing %d msgs", len(conversationRemote.MaxMsgs))
	var msgIDs []chat1.MessageID
	for _, m := range conversationRemote.MaxMsgs {
		msgIDs = append(msgIDs, m.GetMessageID())
	}
	conversationLocal.MaxMessages, err = s.G().ConvSource.GetMessages(ctx,
		conversationRemote.Metadata.ConversationID, uid, msgIDs)
	if err != nil {
		errMsg := err.Error()
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}

	if conversationRemote.ReaderInfo == nil {
		errMsg := "empty ReaderInfo from server?"
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}
	conversationLocal.ReaderInfo = *conversationRemote.ReaderInfo

	var maxValidID chat1.MessageID
	for _, mm := range conversationLocal.MaxMessages {
		if mm.IsValid() {
			body := mm.Valid().MessageBody
			if t, err := body.MessageType(); err != nil {
				return chat1.ConversationLocal{}, err
			} else if t == chat1.MessageType_METADATA {
				conversationLocal.Info.TopicName = body.Metadata().ConversationTitle
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
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}

	// Verify ConversationID is derivable from ConversationIDTriple
	if !conversationLocal.Info.Triple.Derivable(conversationLocal.Info.Id) {
		errMsg := fmt.Sprintf("unexpected response from server: conversation ID is not derivable from conversation triple. triple: %#+v; Id: %x",
			conversationLocal.Info.Triple, conversationLocal.Info.Id)
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}

	if _, conversationLocal.Info.TlfName,
		conversationLocal.IdentifyFailures, err =
		utils.CryptKeysWrapper(ctx, s.getTlfInterface(),
			conversationLocal.Info.TlfName, identifyBehavior); err != nil {
		return chat1.ConversationLocal{}, err
	}

	conversationLocal.Info.WriterNames, conversationLocal.Info.ReaderNames, err = utils.ReorderParticipants(
		s.G().GetUserDeviceCache(),
		conversationLocal.Info.TlfName,
		conversationRemote.Metadata.ActiveList)
	if err != nil {
		return chat1.ConversationLocal{}, fmt.Errorf("error reordering participants: %v", err.Error())
	}

	// verify Conv matches ConversationIDTriple in MessageClientHeader
	if !conversationRemote.Metadata.IdTriple.Eq(conversationLocal.Info.Triple) {
		return chat1.ConversationLocal{}, errors.New("server header conversation triple does not match client header triple")
	}

	return conversationLocal, nil
}
