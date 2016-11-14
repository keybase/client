// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// chatLocalHandler implements keybase1.chatLocal.
type chatLocalHandler struct {
	*BaseHandler
	libkb.Contextified
	gh    *gregorHandler
	tlf   keybase1.TlfInterface
	udc   *utils.UserDeviceCache
	boxer *chat.Boxer

	// Only for testing
	rc chat1.RemoteInterface
}

// newChatLocalHandler creates a chatLocalHandler.
func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	tlf := newTlfHandler(nil, g)
	udc := utils.NewUserDeviceCache(g)
	h := &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		gh:           gh,
		tlf:          tlf,
		udc:          udc,
		boxer:        chat.NewBoxer(g, tlf, udc),
	}

	if gh != nil {
		g.ConvSource = chat.NewConversationSource(g, g.Env.GetConvSourceType(), h.boxer,
			storage.New(g, h.getSecretUI), h.remoteClient(), tlf)
	}

	return h
}

func (h *chatLocalHandler) cryptKeysWrapper(ctx context.Context, tlfName string, identifyBehavior keybase1.TLFIdentifyBehavior) (tlfID chat1.TLFID, canonicalTlfName string, breaks []keybase1.TLFUserBreak, err error) {
	resp, err := h.tlf.CryptKeys(ctx, keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: identifyBehavior,
	})
	if err != nil {
		return nil, "", nil, err
	}
	tlfIDb := resp.NameIDBreaks.TlfID.ToBytes()
	if tlfIDb == nil {
		return nil, "", breaks, errors.New("invalid TLF ID acquired")
	}
	tlfID = chat1.TLFID(tlfIDb)
	return tlfID, string(resp.NameIDBreaks.CanonicalName), resp.NameIDBreaks.Breaks.Breaks, nil
}

func (h *chatLocalHandler) getInboxQueryLocalToRemote(ctx context.Context, lquery *chat1.GetInboxLocalQuery, identifyBehavior keybase1.TLFIdentifyBehavior) (rquery *chat1.GetInboxQuery, breaks []keybase1.TLFUserBreak, err error) {
	if lquery == nil {
		return nil, nil, nil
	}
	rquery = &chat1.GetInboxQuery{}
	if lquery.TlfName != nil && len(*lquery.TlfName) > 0 {
		tlfID, _, brks, err := h.cryptKeysWrapper(ctx, *lquery.TlfName, identifyBehavior)
		if err != nil {
			return nil, nil, err
		}
		rquery.TlfID = &tlfID
		breaks = brks
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

	return rquery, breaks, nil
}

// GetInboxLocal implements keybase.chatLocal.getInboxLocal protocol.
func (h *chatLocalHandler) GetInboxLocal(ctx context.Context, arg chat1.GetInboxLocalArg) (inbox chat1.GetInboxLocalRes, err error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxLocalRes{}, err
	}

	if arg.Query != nil && arg.Query.TopicName != nil {
		return chat1.GetInboxLocalRes{}, fmt.Errorf("cannot query by TopicName without unboxing")
	}

	rquery, breaks, err := h.getInboxQueryLocalToRemote(ctx, arg.Query, arg.IdentifyBehavior)
	if err != nil {
		return chat1.GetInboxLocalRes{}, err
	}
	ib, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      rquery,
		Pagination: arg.Pagination,
	})
	if err != nil {
		return chat1.GetInboxLocalRes{}, err
	}
	return chat1.GetInboxLocalRes{
		ConversationsUnverified: ib.Inbox.Full().Conversations,
		Pagination:              ib.Inbox.Full().Pagination,
		RateLimits:              utils.AggRateLimitsP([]*chat1.RateLimit{ib.RateLimit}),

		// This s only populated if a TLF name is specified in arg.
		Breaks: breaks,
	}, nil
}

// GetInboxAndUnboxLocal implements keybase.chatLocal.getInboxAndUnboxLocal protocol.
func (h *chatLocalHandler) GetInboxAndUnboxLocal(ctx context.Context, arg chat1.GetInboxAndUnboxLocalArg) (inbox chat1.GetInboxAndUnboxLocalRes, err error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxAndUnboxLocalRes{}, err
	}

	// We ignore the breaks here since the unboxing happening later will populate
	// the breaks for each conversation.
	rquery, _, err := h.getInboxQueryLocalToRemote(ctx, arg.Query, arg.IdentifyBehavior)
	if err != nil {
		return chat1.GetInboxAndUnboxLocalRes{}, err
	}
	ib, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      rquery,
		Pagination: arg.Pagination,
	})
	if err != nil {
		return chat1.GetInboxAndUnboxLocalRes{}, err
	}
	inbox = chat1.GetInboxAndUnboxLocalRes{
		Pagination: arg.Pagination,
		RateLimits: utils.AggRateLimitsP([]*chat1.RateLimit{ib.RateLimit}),
	}

	ctx, _ = utils.GetUserInfoMapper(ctx, h.G())
	convLocals, err := h.localizeConversationsPipeline(ctx, ib.Inbox.Full().Conversations, arg.IdentifyBehavior)
	if err != nil {
		return chat1.GetInboxAndUnboxLocalRes{}, err
	}
	for _, convLocal := range convLocals {
		if rquery != nil && rquery.TlfID != nil {
			// Verify using signed TlfName to make sure server returned genuine
			// conversation.
			signedTlfID, _, _, err := h.cryptKeysWrapper(ctx, convLocal.Info.TlfName, arg.IdentifyBehavior)
			if err != nil {
				return chat1.GetInboxAndUnboxLocalRes{}, err
			}
			// The *rquery.TlfID is trusted source of TLF ID here since it's derived
			// from the TLF name in the query.
			if !signedTlfID.Eq(*rquery.TlfID) || !signedTlfID.Eq(convLocal.Info.Triple.Tlfid) {
				return chat1.GetInboxAndUnboxLocalRes{}, errors.New("server returned conversations for different TLF than query")
			}
		}

		// server can't query on topic name, so we have to do it ourselves in the loop
		if arg.Query != nil && arg.Query.TopicName != nil && *arg.Query.TopicName != convLocal.Info.TopicName {
			continue
		}

		inbox.Conversations = append(inbox.Conversations, convLocal)
	}

	return inbox, nil
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *chatLocalHandler) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (chat1.GetThreadLocalRes, error) {
	var err error
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	// Get messages from the source
	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		return chat1.GetThreadLocalRes{}, libkb.LoginRequiredError{}
	}
	thread, rl, breaks, err := h.G().ConvSource.Pull(ctx, arg.ConversationID,
		gregor1.UID(uid.ToBytes()), arg.Query, arg.Pagination, arg.IdentifyBehavior)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	// Sanity check the prev pointers in this thread.
	// TODO: We'll do this against what's in the cache once that's ready,
	//       rather than only checking the messages we just fetched against
	//       each other.
	_, err = chat.CheckPrevPointersAndGetUnpreved(&thread)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	// Run type filter if it exists
	thread.Messages = utils.FilterByType(thread.Messages, arg.Query)

	// Fetch outbox and tack onto the result
	outbox := storage.NewOutbox(h.G(), uid.ToBytes(), h.getSecretUI)
	obr, err := outbox.PullConversation(arg.ConversationID)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	return chat1.GetThreadLocalRes{
		Thread:     thread,
		Outbox:     obr,
		RateLimits: utils.AggRateLimitsP(rl),
		Breaks:     breaks,
	}, nil
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
// Create a new conversation. Or in the case of CHAT, create-or-get a conversation.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, arg chat1.NewConversationLocalArg) (res chat1.NewConversationLocalRes, reserr error) {
	h.G().Log.Debug("NewConversationLocal: %+v", arg)
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	tlfID, cname, breaks, err := h.cryptKeysWrapper(ctx, arg.TlfName, arg.IdentifyBehavior)
	if err != nil {
		return chat1.NewConversationLocalRes{}, err
	}
	res.Breaks = breaks

	triple := chat1.ConversationIDTriple{
		Tlfid:     tlfID,
		TopicType: arg.TopicType,
		TopicID:   make(chat1.TopicID, 16),
	}

	for i := 0; i < 3; i++ {
		triple.TopicID, err = libkb.NewChatTopicID()
		if err != nil {
			return chat1.NewConversationLocalRes{}, fmt.Errorf("error creating topic ID: %s", err)
		}

		firstMessageBoxed, err := h.makeFirstMessage(ctx, triple, cname, arg.TlfVisibility, arg.TopicName, arg.IdentifyBehavior)
		if err != nil {
			return chat1.NewConversationLocalRes{}, fmt.Errorf("error preparing message: %s", err)

		}

		var ncrres chat1.NewConversationRemoteRes
		ncrres, reserr = h.remoteClient().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
			IdTriple:   triple,
			TLFMessage: *firstMessageBoxed,
		})
		if ncrres.RateLimit != nil {
			res.RateLimits = append(res.RateLimits, *ncrres.RateLimit)
		}
		convID := ncrres.ConvID
		if reserr != nil {
			switch cerr := reserr.(type) {
			case libkb.ChatConvExistsError:
				// This triple already exists.

				if triple.TopicType != chat1.TopicType_CHAT {
					// Not a chat conversation. Multiples are fine. Just retry with a
					// different topic ID.
					continue
				}
				// A chat conversation already exists; just reuse it.
				// Note that from this point on, TopicID is entirely the wrong value.
				convID = cerr.ConvID
			case libkb.ChatCollisionError:
				// The triple did not exist, but a collision occurred on convID. Retry with a different topic ID.
				continue
			default:
				return chat1.NewConversationLocalRes{}, fmt.Errorf("error creating conversation: %s", reserr)
			}
		}

		// create succeeded; grabbing the conversation and returning

		gilres, err := h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvID: &convID,
			},
		})
		if err != nil {
			return chat1.NewConversationLocalRes{}, err
		}
		res.RateLimits = append(res.RateLimits, gilres.RateLimits...)

		if len(gilres.Conversations) != 1 {
			return chat1.NewConversationLocalRes{}, fmt.Errorf("unexpected number (%d) of conversation; need 1", len(gilres.Conversations))
		}
		res.Conv = gilres.Conversations[0]

		if res.Conv.Error != nil {
			return chat1.NewConversationLocalRes{}, errors.New(*res.Conv.Error)
		}

		return res, nil
	}

	return chat1.NewConversationLocalRes{}, reserr
}

func (h *chatLocalHandler) makeFirstMessage(ctx context.Context, triple chat1.ConversationIDTriple, tlfName string, tlfVisibility chat1.TLFVisibility, topicName *string, identifyBehavior keybase1.TLFIdentifyBehavior) (*chat1.MessageBoxed, error) {
	var msg chat1.MessagePlaintext
	if topicName != nil {
		msg = chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        triple,
				TlfName:     tlfName,
				TlfPublic:   tlfVisibility == chat1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_METADATA,
				Prev:        nil, // TODO
				// Sender and SenderDevice filled by prepareMessageForRemote
			},
			MessageBody: chat1.NewMessageBodyWithMetadata(
				chat1.MessageConversationMetadata{
					ConversationTitle: *topicName,
				}),
		}
	} else {
		msg = chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        triple,
				TlfName:     tlfName,
				TlfPublic:   tlfVisibility == chat1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_TLFNAME,
				Prev:        nil, // TODO
				// Sender and SenderDevice filled by prepareMessageForRemote
			},
		}
	}

	sender := chat.NewBlockingSender(h.G(), h.boxer, h.remoteClient, h.getSecretUI, identifyBehavior)
	mb, _, err := sender.Prepare(ctx, msg, nil)
	if err != nil {
		return nil, err
	}
	return mb, nil
}

func (h *chatLocalHandler) localizeConversationsPipeline(ctx context.Context, convs []chat1.Conversation, identifyBehavior keybase1.TLFIdentifyBehavior) ([]chat1.ConversationLocal, error) {
	// Fetch conversation local information in parallel
	ctx, _ = utils.GetUserInfoMapper(ctx, h.G())
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
				convLocal, err := h.localizeConversation(ctx, conv.conv, identifyBehavior)
				if err != nil {
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

func (h *chatLocalHandler) GetInboxSummaryForCLILocal(ctx context.Context, arg chat1.GetInboxSummaryForCLILocalQuery) (res chat1.GetInboxSummaryForCLILocalRes, err error) {
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxSummaryForCLILocalRes{}, err
	}

	var after time.Time
	if len(arg.After) > 0 {
		after, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.After)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.After, err)
		}
	}
	var before time.Time
	if len(arg.Before) > 0 {
		before, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.Before)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.Before, err)
		}
	}

	var queryBase chat1.GetInboxLocalQuery
	queryBase.ComputeActiveList = true
	if !after.IsZero() {
		gafter := gregor1.ToTime(after)
		queryBase.After = &gafter
	}
	if !before.IsZero() {
		gbefore := gregor1.ToTime(before)
		queryBase.Before = &gbefore
	}
	if arg.TopicType != chat1.TopicType_NONE {
		queryBase.TopicType = &arg.TopicType
	}
	if arg.Visibility != chat1.TLFVisibility_ANY {
		queryBase.TlfVisibility = &arg.Visibility
	}
	queryBase.Status = arg.Status

	var gires chat1.GetInboxAndUnboxLocalRes
	if arg.UnreadFirst {
		if arg.UnreadFirstLimit.AtMost <= 0 {
			arg.UnreadFirstLimit.AtMost = int(^uint(0) >> 1) // maximum int
		}
		query := queryBase
		query.UnreadOnly, query.ReadOnly = true, false
		if gires, err = h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Pagination: &chat1.Pagination{Num: arg.UnreadFirstLimit.AtMost},
			Query:      &query,
		}); err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
		res.RateLimits = append(res.RateLimits, gires.RateLimits...)
		res.Conversations = append(res.Conversations, gires.Conversations...)

		more := utils.Collar(
			arg.UnreadFirstLimit.AtLeast-len(res.Conversations),
			arg.UnreadFirstLimit.NumRead,
			arg.UnreadFirstLimit.AtMost-len(res.Conversations),
		)
		if more > 0 {
			query := queryBase
			query.UnreadOnly, query.ReadOnly = false, true
			if gires, err = h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
				Pagination: &chat1.Pagination{Num: more},
				Query:      &query,
			}); err != nil {
				return chat1.GetInboxSummaryForCLILocalRes{}, err
			}
			res.RateLimits = append(res.RateLimits, gires.RateLimits...)
			res.Conversations = append(res.Conversations, gires.Conversations...)
		}
	} else {
		if arg.ActivitySortedLimit <= 0 {
			arg.ActivitySortedLimit = int(^uint(0) >> 1) // maximum int
		}
		query := queryBase
		query.UnreadOnly, query.ReadOnly = false, false
		if gires, err = h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Pagination: &chat1.Pagination{Num: arg.ActivitySortedLimit},
			Query:      &query,
		}); err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
		res.RateLimits = append(res.RateLimits, gires.RateLimits...)
		res.Conversations = append(res.Conversations, gires.Conversations...)
	}

	res.RateLimits = utils.AggRateLimits(res.RateLimits)

	return res, nil
}

func (h *chatLocalHandler) localizeConversation(
	ctx context.Context, conversationRemote chat1.Conversation, identifyBehavior keybase1.TLFIdentifyBehavior) (
	conversationLocal chat1.ConversationLocal, err error) {

	ctx, uimap := utils.GetUserInfoMapper(ctx, h.G())

	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id: conversationRemote.Metadata.ConversationID,
	}

	if len(conversationRemote.MaxMsgs) == 0 {
		errMsg := "conversation has an empty MaxMsgs field"
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}
	if conversationLocal.MaxMessages, conversationLocal.Breaks, err = h.boxer.UnboxMessages(ctx, conversationRemote.MaxMsgs, identifyBehavior); err != nil {
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
		errMsg := "unexpected response from server: conversation ID is not derivable from conversation triple."
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}

	// make sure TLF name is canonicalized
	if _, conversationLocal.Info.TlfName, _, err = h.cryptKeysWrapper(ctx, conversationLocal.Info.TlfName, identifyBehavior); err != nil {
		return chat1.ConversationLocal{}, err
	}

	conversationLocal.Info.WriterNames, conversationLocal.Info.ReaderNames, err = utils.ReorderParticipants(
		h.udc,
		uimap,
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

func (h *chatLocalHandler) GetConversationForCLILocal(ctx context.Context, arg chat1.GetConversationForCLILocalQuery) (res chat1.GetConversationForCLILocalRes, err error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetConversationForCLILocalRes{}, err
	}

	var rlimits []chat1.RateLimit

	if arg.Limit.AtMost <= 0 {
		arg.Limit.AtMost = int(^uint(0) >> 1) // maximum int
	}

	ibres, err := h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			ConvID: &arg.ConversationId,
		},
	})
	if err != nil {
		return chat1.GetConversationForCLILocalRes{}, fmt.Errorf("getting conversation %v error: %v", arg.ConversationId, err)
	}
	rlimits = append(rlimits, ibres.RateLimits...)
	if len(ibres.Conversations) != 1 {
		return chat1.GetConversationForCLILocalRes{}, fmt.Errorf("unexpected number (%d) of conversation; need 1", len(ibres.Conversations))
	}
	convLocal := ibres.Conversations[0]

	var since time.Time
	if arg.Since != nil {
		since, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), *arg.Since)
		if err != nil {
			return chat1.GetConversationForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", *arg.Since, since)
		}
	}

	query := chat1.GetThreadQuery{
		MarkAsRead:   arg.MarkAsRead,
		MessageTypes: arg.MessageTypes,
	}
	if !since.IsZero() {
		gsince := gregor1.ToTime(since)
		query.After = &gsince
	}

	tv, err := h.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID: arg.ConversationId,
		Query:          &query,
	})
	if err != nil {
		return chat1.GetConversationForCLILocalRes{}, err
	}
	rlimits = append(rlimits, tv.RateLimits...)

	// apply message count limits
	var messages []chat1.MessageUnboxed
	for _, m := range tv.Thread.Messages {
		messages = append(messages, m)

		arg.Limit.AtMost--
		arg.Limit.AtLeast--
		if m.GetMessageID() <= convLocal.ReaderInfo.ReadMsgid {
			arg.Limit.NumRead--
		}
		if arg.Limit.AtMost <= 0 ||
			(arg.Limit.NumRead <= 0 && arg.Limit.AtLeast <= 0) {
			break
		}
	}

	return chat1.GetConversationForCLILocalRes{
		Conversation: convLocal,
		Messages:     messages,
		RateLimits:   utils.AggRateLimits(rlimits),
	}, nil
}

func (h *chatLocalHandler) GetMessagesLocal(ctx context.Context, arg chat1.GetMessagesLocalArg) (res chat1.GetMessagesLocalRes, err error) {
	deflt := chat1.GetMessagesLocalRes{}

	if err := h.assertLoggedIn(ctx); err != nil {
		return deflt, err
	}
	rarg := chat1.GetMessagesRemoteArg{
		ConversationID: arg.ConversationID,
		MessageIDs:     arg.MessageIDs,
	}
	boxed, err := h.remoteClient().GetMessagesRemote(ctx, rarg)
	if err != nil {
		return deflt, err
	}

	messages, breaks, err := h.boxer.UnboxMessages(ctx, boxed.Msgs, arg.IdentifyBehavior)
	if err != nil {
		return deflt, err
	}

	var rlimits []chat1.RateLimit
	if boxed.RateLimit != nil {
		rlimits = append(rlimits, *boxed.RateLimit)
	}

	return chat1.GetMessagesLocalRes{
		Messages:   messages,
		RateLimits: utils.AggRateLimits(rlimits),
		Breaks:     breaks,
	}, nil
}

func (h *chatLocalHandler) SetConversationStatusLocal(ctx context.Context, arg chat1.SetConversationStatusLocalArg) (chat1.SetConversationStatusLocalRes, error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}

	scsres, err := h.remoteClient().SetConversationStatus(ctx, chat1.SetConversationStatusArg{
		ConversationID: arg.ConversationID,
		Status:         arg.Status,
	})
	if err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}

	return chat1.SetConversationStatusLocalRes{
		RateLimits: utils.AggRateLimitsP([]*chat1.RateLimit{scsres.RateLimit}),
	}, nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *chatLocalHandler) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (chat1.PostLocalRes, error) {
	err := msgchecker.CheckMessagePlaintext(arg.Msg)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}

	sender := chat.NewBlockingSender(h.G(), h.boxer, h.remoteClient, h.getSecretUI, arg.IdentifyBehavior)

	_, rl, breaks, err := sender.Send(ctx, arg.ConversationID, arg.Msg)
	if err != nil {
		return chat1.PostLocalRes{}, fmt.Errorf("PostLocal: unable to send message: %s", err.Error())
	}
	return chat1.PostLocalRes{
		RateLimits: utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
		Breaks:     breaks,
	}, nil
}

func (h *chatLocalHandler) PostLocalNonblock(ctx context.Context, arg chat1.PostLocalNonblockArg) (chat1.PostLocalNonblockRes, error) {

	// Create non block sender
	sender := chat.NewBlockingSender(h.G(), h.boxer, h.remoteClient, h.getSecretUI, arg.IdentifyBehavior)
	nonblockSender := chat.NewNonblockingSender(h.G(), sender, h.tlf, arg.IdentifyBehavior)

	obid, rl, breaks, err := nonblockSender.Send(ctx, arg.ConversationID, arg.Msg)
	if err != nil {
		return chat1.PostLocalNonblockRes{},
			fmt.Errorf("PostLocalNonblock: unable to send message: err: %s", err.Error())
	}
	return chat1.PostLocalNonblockRes{
		OutboxID:   obid,
		RateLimits: utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
		Breaks:     breaks,
	}, nil
}

// PostAttachmentLocal implements chat1.LocalInterface.PostAttachmentLocal.
func (h *chatLocalHandler) PostAttachmentLocal(ctx context.Context, arg chat1.PostAttachmentLocalArg) (chat1.PostLocalRes, error) {

	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int) {
		parg := chat1.ChatAttachmentUploadProgressArg{
			SessionID:     arg.SessionID,
			BytesComplete: bytesComplete,
			BytesTotal:    bytesTotal,
		}
		chatUI.ChatAttachmentUploadProgress(ctx, parg)
	}

	// get s3 upload params from server
	params, err := h.remoteClient().GetS3Params(ctx, arg.ConversationID)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}

	// upload attachment and (optional) preview concurrently
	var object chat1.Asset
	var preview *chat1.Asset
	var g errgroup.Group

	g.Go(func() error {
		chatUI.ChatAttachmentUploadStart(ctx)
		var err error
		object, err = h.uploadAsset(ctx, arg.SessionID, params, arg.Attachment, progress)
		chatUI.ChatAttachmentUploadDone(ctx)
		return err
	})

	if arg.Preview != nil {
		g.Go(func() error {
			chatUI.ChatAttachmentPreviewUploadStart(ctx)
			// copy the params so as not to mess with the main params above
			previewParams := params

			// add preview suffix to object key (P in hex)
			// the s3path in gregor is expecting hex here
			previewParams.ObjectKey += "50"
			prev, err := h.uploadAsset(ctx, arg.SessionID, previewParams, *arg.Preview, nil)
			chatUI.ChatAttachmentPreviewUploadDone(ctx)
			if err == nil {
				preview = &prev
			}
			return err
		})
	}

	if err := g.Wait(); err != nil {
		return chat1.PostLocalRes{}, err
	}

	// note that we only want to set the Title to what the user entered,
	// even if that is nothing.
	object.Title = arg.Title
	if preview != nil {
		preview.Title = arg.Title
	}

	// send an attachment message
	attachment := chat1.MessageAttachment{
		Object:   object,
		Preview:  preview,
		Metadata: arg.Metadata,
	}
	postArg := chat1.PostLocalArg{
		ConversationID: arg.ConversationID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: arg.ClientHeader,
			MessageBody:  chat1.NewMessageBodyWithAttachment(attachment),
		},
	}
	return h.PostLocal(ctx, postArg)
}

// DownloadAttachmentLocal implements chat1.LocalInterface.DownloadAttachmentLocal.
func (h *chatLocalHandler) DownloadAttachmentLocal(ctx context.Context, arg chat1.DownloadAttachmentLocalArg) (chat1.DownloadAttachmentLocalRes, error) {
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int) {
		parg := chat1.ChatAttachmentDownloadProgressArg{
			SessionID:     arg.SessionID,
			BytesComplete: bytesComplete,
			BytesTotal:    bytesTotal,
		}
		chatUI.ChatAttachmentDownloadProgress(ctx, parg)
	}

	// get s3 params from server
	params, err := h.remoteClient().GetS3Params(ctx, arg.ConversationID)
	if err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}

	marg := chat1.GetMessagesLocalArg{
		ConversationID: arg.ConversationID,
		MessageIDs:     []chat1.MessageID{arg.MessageID},
	}
	msgs, err := h.GetMessagesLocal(ctx, marg)
	if err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}
	if len(msgs.Messages) == 0 {
		return chat1.DownloadAttachmentLocalRes{}, libkb.NotFoundError{}
	}
	first := msgs.Messages[0]
	st, err := first.State()
	if err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}
	if st == chat1.MessageUnboxedState_ERROR {
		em := first.Error().ErrMsg
		// XXX temporary to fix master:
		// (wanted to return ChatUnboxingError)
		return chat1.DownloadAttachmentLocalRes{}, errors.New(em)
	}

	cli := h.getStreamUICli()
	sink := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)

	msg := first.Valid()
	body := msg.MessageBody
	if t, err := body.MessageType(); err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	} else if t != chat1.MessageType_ATTACHMENT {
		return chat1.DownloadAttachmentLocalRes{}, errors.New("not an attachment message")
	}

	attachment := msg.MessageBody.Attachment()
	obj := attachment.Object
	if arg.Preview {
		if attachment.Preview == nil {
			return chat1.DownloadAttachmentLocalRes{}, errors.New("no preview in attachment")
		}
		h.G().Log.Debug("downloading preview attachment asset")
		obj = *attachment.Preview
	}
	chatUI.ChatAttachmentDownloadStart(ctx)
	if err := chat.DownloadAsset(ctx, h.G().Log, params, obj, sink, h, progress); err != nil {
		sink.Close()
		return chat1.DownloadAttachmentLocalRes{}, err
	}
	chatUI.ChatAttachmentDownloadDone(ctx)

	if err := sink.Close(); err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}

	return chat1.DownloadAttachmentLocalRes{RateLimits: msgs.RateLimits}, nil
}

// getSecretUI returns a SecretUI, preferring a delegated SecretUI if
// possible.
func (h *chatLocalHandler) getSecretUI() libkb.SecretUI {
	ui, err := h.G().UIRouter.GetSecretUI(0)
	if err == nil && ui != nil {
		h.G().Log.Debug("chatLocalHandler: using delegated SecretUI")
		return ui
	}
	h.G().Log.Debug("chatLocalHandler: using local SecretUI")
	return h.BaseHandler.getSecretUI(0, h.G())
}

// remoteClient returns a client connection to gregord.
func (h *chatLocalHandler) remoteClient() chat1.RemoteInterface {
	if h.rc != nil {
		return h.rc
	}
	return &chat1.RemoteClient{Cli: h.gh.cli}
}

func (h *chatLocalHandler) setTestRemoteClient(ri chat1.RemoteInterface) {
	h.rc = ri
}

func (h *chatLocalHandler) assertLoggedIn(ctx context.Context) error {
	ok, err := h.G().LoginState().LoggedInProvisionedLoad()
	if err != nil {
		return err
	}
	if !ok {
		return libkb.LoginRequiredError{}
	}
	return nil
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (h *chatLocalHandler) Sign(payload []byte) ([]byte, error) {
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return h.remoteClient().S3Sign(context.Background(), arg)
}

func (h *chatLocalHandler) uploadAsset(ctx context.Context, sessionID int, params chat1.S3Params, local chat1.LocalSource, progress chat.ProgressReporter) (chat1.Asset, error) {
	// create a buffered stream
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(local.Source, cli, sessionID)

	// encrypt the stream
	enc := chat.NewSignEncrypter()
	len := enc.EncryptedLen(local.Size)
	encReader, err := enc.Encrypt(src)
	if err != nil {
		return chat1.Asset{}, err
	}

	// compute hash
	hash := sha256.New()
	tee := io.TeeReader(encReader, hash)

	// post to s3
	upRes, err := chat.PutS3(ctx, h.G().Log, tee, int64(len), params, h, progress)
	if err != nil {
		return chat1.Asset{}, err
	}
	h.G().Log.Debug("chat attachment upload: %+v", upRes)

	asset := chat1.Asset{
		Filename:  filepath.Base(local.Filename),
		Region:    upRes.Region,
		Endpoint:  upRes.Endpoint,
		Bucket:    upRes.Bucket,
		Path:      upRes.Path,
		Size:      int(upRes.Size),
		Key:       enc.EncryptKey(),
		VerifyKey: enc.VerifyKey(),
		EncHash:   hash.Sum(nil),
	}
	return asset, nil

}
