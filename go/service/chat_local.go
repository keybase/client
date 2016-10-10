// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/engine"
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
	boxer *chat.Boxer
}

// newChatLocalHandler creates a chatLocalHandler.
func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	tlf := newTlfHandler(nil, g)
	h := &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		gh:           gh,
		tlf:          tlf,
		boxer:        chat.NewBoxer(g, tlf),
	}
	chat.SetConversationSource(chat.NewHybridConversationSource(g, h.boxer, h.remoteClient()))
	return h
}

func (h *chatLocalHandler) cryptKeysWrapper(ctx context.Context, tlfName string) (tlfID chat1.TLFID, canonicalTlfName string, err error) {
	resp, err := h.tlf.CryptKeys(ctx, keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return nil, "", err
	}
	tlfIDb := resp.NameIDBreaks.TlfID.ToBytes()
	if tlfIDb == nil {
		return nil, "", errors.New("invalid TLF ID acquired")
	}
	tlfID = chat1.TLFID(tlfIDb)
	return tlfID, string(resp.NameIDBreaks.CanonicalName), nil
}

func (h *chatLocalHandler) getInboxQueryLocalToRemote(ctx context.Context, lquery *chat1.GetInboxLocalQuery) (rquery *chat1.GetInboxQuery, err error) {
	if lquery == nil {
		return nil, nil
	}
	rquery = &chat1.GetInboxQuery{}
	if lquery.TlfName != nil {
		tlfID, _, err := h.cryptKeysWrapper(ctx, *lquery.TlfName)
		if err != nil {
			return nil, err
		}
		rquery.TlfID = &tlfID
	}
	rquery.After = lquery.After
	rquery.Before = lquery.Before
	rquery.TlfVisibility = lquery.TlfVisibility
	rquery.TopicType = lquery.TopicType
	rquery.UnreadOnly = lquery.UnreadOnly
	rquery.ReadOnly = lquery.ReadOnly
	rquery.ConvID = lquery.ConvID

	return rquery, nil
}

// GetInboxLocal implements keybase.chatLocal.getInboxLocal protocol.
func (h *chatLocalHandler) GetInboxLocal(ctx context.Context, arg chat1.GetInboxLocalArg) (inbox chat1.GetInboxLocalRes, err error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxLocalRes{}, err
	}

	rquery, err := h.getInboxQueryLocalToRemote(ctx, arg.Query)
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
		ConversationsUnverified: ib.Inbox.Conversations,
		Pagination:              ib.Inbox.Pagination,
		RateLimits:              h.aggRateLimitsP([]*chat1.RateLimit{ib.RateLimit}),
	}, nil
}

// GetInboxAndUnboxLocal implements keybase.chatLocal.getInboxAndUnboxLocal protocol.
func (h *chatLocalHandler) GetInboxAndUnboxLocal(ctx context.Context, arg chat1.GetInboxAndUnboxLocalArg) (inbox chat1.GetInboxAndUnboxLocalRes, err error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxAndUnboxLocalRes{}, err
	}

	rquery, err := h.getInboxQueryLocalToRemote(ctx, arg.Query)
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
		RateLimits: chat.AggRateLimitsP([]*chat1.RateLimit{ib.RateLimit}),
	}

	ctx, _ = chat.GetUserInfoMapper(ctx, h.G())
	convLocals, err := h.localizeConversationsPipeline(ctx, ib.Inbox.Conversations)
	if err != nil {
		return chat1.GetInboxAndUnboxLocalRes{}, err
	}
	for _, convLocal := range convLocals {
		if rquery != nil && rquery.TlfID != nil {
			// verify using signed TlfName to make sure server returned genuine conversation
			signedTlfID, _, err := h.cryptKeysWrapper(ctx, convLocal.Info.TlfName)
			if err != nil {
				return chat1.GetInboxAndUnboxLocalRes{}, err
			}
			if !signedTlfID.Eq(*rquery.TlfID) {
				return chat1.GetInboxAndUnboxLocalRes{}, errors.New("server returned conversations for different TLF than query")
			}
		}

		// server can't query on topic name, so we'd have to do it ourselves in the loop
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
	thread, rl, err := chat.GetConversationSource().Pull(ctx, arg.ConversationID,
		gregor1.UID(uid.ToBytes()), arg.Query, arg.Pagination)
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
	thread.Messages = chat.FilterByType(thread.Messages, arg.Query)

	return chat1.GetThreadLocalRes{
		Thread:     thread,
		RateLimits: chat.AggRateLimitsP(rl),
	}, nil
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, arg chat1.NewConversationLocalArg) (res chat1.NewConversationLocalRes, reserr error) {
	h.G().Log.Debug("NewConversationLocal: %+v", arg)
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	tlfID, cname, err := h.cryptKeysWrapper(ctx, arg.TlfName)
	if err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	triple := chat1.ConversationIDTriple{
		Tlfid:     tlfID,
		TopicType: arg.TopicType,
		TopicID:   make(chat1.TopicID, 16),
	}

	for i := 0; i < 3; i++ {
		if triple.TopicType != chat1.TopicType_CHAT {
			// We only set topic ID if it's not CHAT. We are supporting only one
			// conversation per TLF now. A topic ID of 0s is intentional as it would
			// cause insertion failure in database.

			if triple.TopicID, err = libkb.NewChatTopicID(); err != nil {
				return chat1.NewConversationLocalRes{}, fmt.Errorf("error creating topic ID: %s", err)
			}
		}

		firstMessageBoxed, err := h.makeFirstMessage(ctx, triple, cname, arg.TlfVisibility, arg.TopicName)
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
			if cerr, ok := reserr.(libkb.ChatConvExistsError); ok {
				if triple.TopicType != chat1.TopicType_CHAT {
					// Not a chat conversation. Multiples are fine. Just retry with a
					// different topic ID.
					continue
				}
				// A chat conversation already exists; just reuse it.
				convID = cerr.ConvID
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

		return res, nil
	}

	return chat1.NewConversationLocalRes{}, reserr
}

func (h *chatLocalHandler) makeFirstMessage(ctx context.Context, triple chat1.ConversationIDTriple, tlfName string, tlfVisibility chat1.TLFVisibility, topicName *string) (*chat1.MessageBoxed, error) {
	var v1 chat1.MessagePlaintextV1
	if topicName != nil {
		v1 = chat1.MessagePlaintextV1{
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
		v1 = chat1.MessagePlaintextV1{
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
	return h.prepareMessageForRemote(ctx, chat1.NewMessagePlaintextWithV1(v1), nil)
}

func (h *chatLocalHandler) localizeConversationsPipeline(ctx context.Context, convs []chat1.Conversation) ([]chat1.ConversationLocal, error) {
	// Fetch conversation local information in parallel
	ctx, _ = chat.GetUserInfoMapper(ctx, h.G())
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
				convLocal, err := h.localizeConversation(ctx, conv.conv)
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
		after, err = chat.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.After)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.After, err)
		}
	}
	var before time.Time
	if len(arg.Before) > 0 {
		before, err = chat.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.Before)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.Before, err)
		}
	}

	var queryBase chat1.GetInboxLocalQuery
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

		more := chat.Collar(
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

	res.RateLimits = chat.AggRateLimits(res.RateLimits)

	return res, nil
}

func (h *chatLocalHandler) localizeConversation(
	ctx context.Context, conversationRemote chat1.Conversation) (
	conversationLocal chat1.ConversationLocal, err error) {

	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id: conversationRemote.Metadata.ConversationID,
	}

	if len(conversationRemote.MaxMsgs) == 0 {
		errMsg := "conversation has an empty MaxMsgs field"
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}
	if conversationLocal.MaxMessages, err = h.boxer.UnboxMessages(ctx, conversationRemote.MaxMsgs); err != nil {
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
		if mm.Message != nil {
			messagePlaintext := mm.Message.MessagePlaintext
			version, err := messagePlaintext.Version()
			if err != nil {
				return chat1.ConversationLocal{}, err
			}
			switch version {
			case chat1.MessagePlaintextVersion_V1:
				body := messagePlaintext.V1().MessageBody

				if t, err := body.MessageType(); err != nil {
					return chat1.ConversationLocal{}, err
				} else if t == chat1.MessageType_METADATA {
					conversationLocal.Info.TopicName = body.Metadata().ConversationTitle
				}

				if mm.Message.ServerHeader.MessageID >= maxValidID {
					conversationLocal.Info.TlfName = messagePlaintext.V1().ClientHeader.TlfName
					maxValidID = mm.Message.ServerHeader.MessageID
				}
				conversationLocal.Info.Triple = messagePlaintext.V1().ClientHeader.Conv
			default:
				errMsg := libkb.NewChatMessageVersionError(version).Error()
				return chat1.ConversationLocal{Error: &errMsg}, nil
			}
		}
	}

	if len(conversationLocal.Info.TlfName) == 0 {
		errMsg := "no valid message in the conversation"
		return chat1.ConversationLocal{Error: &errMsg}, nil
	}

	if _, conversationLocal.Info.TlfName, err = h.cryptKeysWrapper(ctx, conversationLocal.Info.TlfName); err != nil {
		return chat1.ConversationLocal{}, err
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
		since, err = chat.ParseTimeFromRFC3339OrDurationFromPast(h.G(), *arg.Since)
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
	var messages []chat1.MessageFromServerOrError
	for _, m := range tv.Thread.Messages {
		messages = append(messages, m)

		arg.Limit.AtMost--
		arg.Limit.AtLeast--
		if m.Message.ServerHeader.MessageID <= convLocal.ReaderInfo.ReadMsgid {
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
		RateLimits:   chat.AggRateLimits(rlimits),
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

	messages, err := h.boxer.UnboxMessages(ctx, boxed.Msgs)
	if err != nil {
		return deflt, err
	}

	var rlimits []chat1.RateLimit
	if boxed.RateLimit != nil {
		rlimits = append(rlimits, *boxed.RateLimit)
	}

	return chat1.GetMessagesLocalRes{
		Messages:   messages,
		RateLimits: chat.AggRateLimits(rlimits),
	}, nil
}

func (h *chatLocalHandler) addSenderToMessage(msg chat1.MessagePlaintext) (chat1.MessagePlaintext, error) {
	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		return chat1.MessagePlaintext{}, libkb.LoginRequiredError{}
	}
	did := h.G().Env.GetDeviceID()
	if did.IsNil() {
		return chat1.MessagePlaintext{}, libkb.DeviceRequiredError{}
	}

	huid := uid.ToBytes()
	if huid == nil {
		return chat1.MessagePlaintext{}, errors.New("invalid UID")
	}

	hdid := make([]byte, libkb.DeviceIDLen)
	if err := did.ToBytes(hdid); err != nil {
		return chat1.MessagePlaintext{}, err
	}

	version, err := msg.Version()
	if err != nil {
		return chat1.MessagePlaintext{}, err
	}

	switch version {
	case chat1.MessagePlaintextVersion_V1:
		header := msg.V1().ClientHeader
		header.Sender = gregor1.UID(huid)
		header.SenderDevice = gregor1.DeviceID(hdid)
		updated := chat1.MessagePlaintextV1{
			ClientHeader: header,
			MessageBody:  msg.V1().MessageBody,
		}
		return chat1.NewMessagePlaintextWithV1(updated), nil
	default:
		return chat1.MessagePlaintext{}, libkb.NewChatMessageVersionError(version)
	}

}

func (h *chatLocalHandler) addPrevPointersToMessage(msg chat1.MessagePlaintext, convID chat1.ConversationID) (chat1.MessagePlaintext, error) {
	// Make sure the caller hasn't already assembled this list. For now, this
	// should never happen, and we'll return an error just in case we make a
	// mistake in the future. But if there's some use case in the future where
	// a caller wants to specify custom prevs, we can relax this.
	if len(msg.V1().ClientHeader.Prev) != 0 {
		return chat1.MessagePlaintext{}, fmt.Errorf("chatLocalHandler expects an empty prev list")
	}

	// Currently we do a very inefficient fetch here. Eventually we will do
	// this using the local cache.
	arg := chat1.GetThreadLocalArg{
		ConversationID: convID,
	}
	res, err := h.GetThreadLocal(context.TODO(), arg)
	if err != nil {
		return chat1.MessagePlaintext{}, err
	}

	prevs, err := chat.CheckPrevPointersAndGetUnpreved(&res.Thread)
	if err != nil {
		return chat1.MessagePlaintext{}, err
	}

	// Make an attempt to avoid changing anything in the input message. There
	// are a lot of shared pointers though, so this is
	header := msg.V1().ClientHeader
	header.Prev = prevs
	updated := chat1.MessagePlaintextV1{
		ClientHeader: header,
		MessageBody:  msg.V1().MessageBody,
	}
	return chat1.NewMessagePlaintextWithV1(updated), nil
}

func (h *chatLocalHandler) prepareMessageForRemote(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error) {
	msg, err := h.addSenderToMessage(plaintext)
	if err != nil {
		return nil, err
	}

	// convID will be nil in makeFirstMessage, for example
	if convID != nil {
		msg, err = h.addPrevPointersToMessage(msg, *convID)
		if err != nil {
			return nil, err
		}
	}

	// encrypt the message
	skp, err := h.getSigningKeyPair()
	if err != nil {
		return nil, err
	}

	// For now, BoxMessage canonicalizes the TLF name. We should try to refactor
	// it a bit to do it here.
	boxed, err := h.boxer.BoxMessage(ctx, msg, skp)
	if err != nil {
		return nil, err
	}

	// TODO: populate plaintext.ClientHeader.Conv

	return boxed, nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *chatLocalHandler) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (chat1.PostLocalRes, error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.PostLocalRes{}, err
	}
	boxed, err := h.prepareMessageForRemote(ctx, arg.MessagePlaintext, &arg.ConversationID)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}

	// post to remote gregord
	rarg := chat1.PostRemoteArg{
		ConversationID: arg.ConversationID,
		MessageBoxed:   *boxed,
	}

	plres, err := h.remoteClient().PostRemote(ctx, rarg)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}
	return chat1.PostLocalRes{
		RateLimits: chat.AggRateLimitsP([]*chat1.RateLimit{plres.RateLimit}),
	}, nil
}

func (h *chatLocalHandler) getSigningKeyPair() (kp libkb.NaclSigningKeyPair, err error) {
	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(h.G(), h.getSecretUI, libkb.DeviceSigningKeyType, "sign chat message")
	if err != nil {
		return libkb.NaclSigningKeyPair{}, err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.NaclSigningKeyPair{}, libkb.KeyCannotSignError{}
	}

	return kp, nil
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
	return &chat1.RemoteClient{Cli: h.gh.cli}
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
