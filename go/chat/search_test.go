package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

func TestChatSearchConvRegexp(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {

		// Only test against IMPTEAMNATIVE. There is a bug in ChatRemoteMock
		// with using Pagination Next/Prev and we don't need to triple test
		// here.
		switch mt {
		case chat1.ConversationMembersType_IMPTEAMNATIVE:
		default:
			return
		}

		ctc := makeChatTestContext(t, "GetSearchRegexp", 2)
		defer ctc.cleanup()
		users := ctc.users()
		u1 := users[0]
		u2 := users[1]

		conv := mustCreateConversationForTest(t, ctc, u1, chat1.TopicType_CHAT,
			mt, ctc.as(t, u2).user())
		convID := conv.Id

		tc1 := ctc.as(t, u1)
		tc2 := ctc.as(t, u2)

		searchHitCb := make(chan chat1.ChatSearchHitArg, 100)
		searchDoneCb := make(chan chat1.ChatSearchDoneArg, 100)
		chatUI := kbtest.NewChatUI(nil, nil, searchHitCb, searchDoneCb, nil, nil)
		tc1.h.mockChatUI = chatUI

		listener1 := newServerChatListener()
		tc1.h.G().NotifyRouter.SetListener(listener1)
		listener2 := newServerChatListener()
		tc2.h.G().NotifyRouter.SetListener(listener2)

		sendMessage := func(msgBody string, user *kbtest.FakeUser) chat1.MessageID {
			msgID := mustPostLocalForTest(t, ctc, user, conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: msgBody}))
			consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
			consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)
			return msgID
		}

		verifyHit := func(beforeMsgIDs []chat1.MessageID, hitMessageID chat1.MessageID, afterMsgIDs []chat1.MessageID,
			matches []string, searchHit chat1.ChatSearchHit) {
			_verifyHit := func(searchHit chat1.ChatSearchHit) {
				if beforeMsgIDs == nil {
					require.Nil(t, searchHit.BeforeMessages)
				} else {
					require.Equal(t, len(beforeMsgIDs), len(searchHit.BeforeMessages))
					for i, msgID := range beforeMsgIDs {
						msg := searchHit.BeforeMessages[i]
						t.Logf("msg: %v", msg.Valid())
						require.True(t, msg.IsValid())
						require.Equal(t, msgID, msg.GetMessageID())
					}
				}
				require.EqualValues(t, hitMessageID, searchHit.HitMessage.Valid().MessageID)
				require.Equal(t, matches, searchHit.Matches)

				if afterMsgIDs == nil {
					require.Nil(t, searchHit.AfterMessages)
				} else {
					require.Equal(t, len(afterMsgIDs), len(searchHit.AfterMessages))
					for i, msgID := range afterMsgIDs {
						msg := searchHit.AfterMessages[i]
						require.True(t, msg.IsValid())
						require.Equal(t, msgID, msg.GetMessageID())
					}
				}

			}
			_verifyHit(searchHit)
			select {
			case searchHitRes := <-searchHitCb:
				_verifyHit(searchHitRes.SearchHit)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no search result received")
			}
		}
		verifySearchDone := func(numHits int) {
			select {
			case searchDone := <-searchDoneCb:
				require.Equal(t, numHits, searchDone.NumHits)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no search result received")
			}
		}

		search := func(query string, isRegex bool, opts chat1.SearchOpts) chat1.GetSearchRegexpRes {
			res, err := tc1.chatLocalHandler().GetSearchRegexp(tc1.startCtx, chat1.GetSearchRegexpArg{
				ConvID:  convID,
				Query:   query,
				IsRegex: isRegex,
				Opts:    opts,
			})
			require.NoError(t, err)
			t.Logf("query: %v, searchRes: %+v", query, res)
			return res
		}

		isRegex := false
		opts := chat1.SearchOpts{
			MaxHits:       5,
			BeforeContext: 2,
			AfterContext:  2,
			MaxMessages:   1000,
		}

		// Test basic equality match
		query := "hi"
		msgBody := "hi there"
		msgID1 := sendMessage(msgBody, u1)
		res := search(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit(nil, msgID1, nil, []string{query}, res.Hits[0])
		verifySearchDone(1)

		// Test basic no results
		query = "hey"
		res = search(query, isRegex, opts)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0)

		// Test maxHits
		opts.MaxHits = 1
		query = "hi"
		msgID2 := sendMessage(msgBody, u1)
		res = search(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID1}, msgID2, nil, []string{query}, res.Hits[0])
		verifySearchDone(1)

		opts.MaxHits = 5
		res = search(query, isRegex, opts)
		require.Equal(t, 2, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID1}, msgID2, nil, []string{query}, res.Hits[0])
		verifyHit(nil, msgID1, []chat1.MessageID{msgID2}, []string{query}, res.Hits[1])
		verifySearchDone(2)

		msgID3 := sendMessage(msgBody, u1)
		res = search(query, isRegex, opts)
		require.Equal(t, 3, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID1, msgID2}, msgID3, nil, []string{query}, res.Hits[0])
		verifyHit([]chat1.MessageID{msgID1}, msgID2, []chat1.MessageID{msgID3}, []string{query}, res.Hits[1])
		verifyHit(nil, msgID1, []chat1.MessageID{msgID2, msgID3}, []string{query}, res.Hits[2])
		verifySearchDone(3)

		// test sentBy
		// invalid username
		opts.SentBy = u1.Username + "foo"
		res = search(query, isRegex, opts)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0)

		// send from user2 and make sure we can filter
		opts.SentBy = u2.Username
		msgBody = "hi"
		query = "hi"
		msgID4 := sendMessage(msgBody, u2)
		res = search(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID2, msgID3}, msgID4, nil, []string{query}, res.Hits[0])
		verifySearchDone(1)
		opts.SentBy = ""

		// test sentBefore/sentAfter
		msgRes, err := tc1.chatLocalHandler().GetMessagesLocal(tc1.startCtx, chat1.GetMessagesLocalArg{
			ConversationID: convID,
			MessageIDs:     []chat1.MessageID{msgID1, msgID4},
		})
		require.NoError(t, err)
		require.Equal(t, 2, len(msgRes.Messages))
		msg1 := msgRes.Messages[0]
		msg4 := msgRes.Messages[1]

		// nothing sent after msg4
		opts.SentAfter = msg4.GetCtime() + 500
		res = search(query, isRegex, opts)
		require.Zero(t, len(res.Hits))
		opts.SentAfter = msg1.GetCtime()
		res = search(query, isRegex, opts)
		require.Equal(t, 4, len(res.Hits))

		// nothing sent before msg1
		opts.SentAfter = 0
		opts.SentBefore = msg1.GetCtime() - 500
		res = search(query, isRegex, opts)
		require.Zero(t, len(res.Hits))
		opts.SentBefore = msg4.GetCtime()
		res = search(query, isRegex, opts)
		require.Equal(t, 4, len(res.Hits))
		opts.SentBefore = 0
		timeout := 20 * time.Second
		// drain the cbs, 8 hits and 4 dones
		for i := 0; i < 8+4; i++ {
			select {
			case <-searchHitCb:
			case <-searchDoneCb:
			case <-time.After(timeout):
				require.Fail(t, "no search result received")
			}
		}

		// Test regex functionality
		isRegex = true

		// Test utf8
		msgBody = `约书亚和约翰屌爆了`
		query = `约.*`
		msgID5 := sendMessage(msgBody, u1)
		res = search(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID3, msgID4}, msgID5, nil, []string{msgBody}, res.Hits[0])
		verifySearchDone(1)

		query = "h.*"
		lowercase := "abcdefghijklmnopqrstuvwxyz"
		for _, char := range lowercase {
			sendMessage("h."+string(char), u1)
		}
		opts.MaxHits = len(lowercase)
		res = search(query, isRegex, opts)
		require.Equal(t, opts.MaxHits, len(res.Hits))
		verifySearchDone(opts.MaxHits)

		query = `h\..*`
		res = search(query, isRegex, opts)
		require.Equal(t, opts.MaxHits, len(res.Hits))
		verifySearchDone(opts.MaxHits)

		// Test maxMessages
		opts.MaxMessages = 2
		res = search(query, isRegex, opts)
		require.Equal(t, opts.MaxMessages, len(res.Hits))
		verifySearchDone(opts.MaxMessages)

		// Test invalid regex
		_, err = tc1.chatLocalHandler().GetSearchRegexp(tc1.startCtx, chat1.GetSearchRegexpArg{
			ConvID:  convID,
			Query:   "(",
			IsRegex: true,
		})
		require.Error(t, err)
	})
}

func TestChatSearchInbox(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {

		// Only test against IMPTEAMNATIVE. There is a bug in ChatRemoteMock
		// with using Pagination Next/Prev and we don't need to triple test
		// here.
		switch mt {
		case chat1.ConversationMembersType_IMPTEAMNATIVE:
		default:
			return
		}

		ctc := makeChatTestContext(t, "InboxSearch", 2)
		defer ctc.cleanup()
		users := ctc.users()
		u1 := users[0]
		u2 := users[1]

		conv := mustCreateConversationForTest(t, ctc, u1, chat1.TopicType_CHAT,
			mt, ctc.as(t, u2).user())
		convID := conv.Id

		tc1 := ctc.as(t, u1)
		tc2 := ctc.as(t, u2)
		uid1 := u1.User.GetUID().ToBytes()
		uid2 := u2.User.GetUID().ToBytes()
		g1 := ctc.world.Tcs[u1.Username].Context()
		g2 := ctc.world.Tcs[u2.Username].Context()

		inboxSearchHitCb := make(chan chat1.ChatInboxSearchHitArg, 100)
		inboxSearchDoneCb := make(chan chat1.ChatInboxSearchDoneArg, 100)
		chatUI := kbtest.NewChatUI(nil, nil, nil, nil, inboxSearchHitCb, inboxSearchDoneCb)
		tc1.h.mockChatUI = chatUI

		listener1 := newServerChatListener()
		tc1.h.G().NotifyRouter.SetListener(listener1)
		listener2 := newServerChatListener()
		tc2.h.G().NotifyRouter.SetListener(listener2)

		indexer1 := search.NewIndexer(g1)
		indexConsumeCh1 := make(chan bool, 100)
		indexer1.SetConsumeCh(indexConsumeCh1)
		g1.Indexer = indexer1

		indexer2 := search.NewIndexer(g2)
		indexConsumeCh2 := make(chan bool, 100)
		indexer2.SetConsumeCh(indexConsumeCh2)
		g2.Indexer = indexer2

		sendMessage := func(msgBody chat1.MessageBody, user *kbtest.FakeUser) chat1.MessageID {
			msgID := mustPostLocalForTest(t, ctc, user, conv, msgBody)
			typ, err := msgBody.MessageType()
			require.NoError(t, err)
			consumeNewMsgRemote(t, listener1, typ)
			consumeNewMsgRemote(t, listener2, typ)
			return msgID
		}

		verifyHit := func(convID chat1.ConversationID, beforeMsgIDs []chat1.MessageID, hitMessageID chat1.MessageID,
			afterMsgIDs []chat1.MessageID, matches []string, searchHit chat1.ChatSearchHit) {
			if beforeMsgIDs == nil {
				require.Nil(t, searchHit.BeforeMessages)
			} else {
				require.Equal(t, len(beforeMsgIDs), len(searchHit.BeforeMessages))
				for i, msgID := range beforeMsgIDs {
					msg := searchHit.BeforeMessages[i]
					require.True(t, msg.IsValid())
					require.Equal(t, msgID, msg.GetMessageID())
				}
			}
			require.EqualValues(t, hitMessageID, searchHit.HitMessage.Valid().MessageID)
			require.Equal(t, matches, searchHit.Matches)

			if afterMsgIDs == nil {
				require.Nil(t, searchHit.AfterMessages)
			} else {
				require.Equal(t, len(afterMsgIDs), len(searchHit.AfterMessages))
				for i, msgID := range afterMsgIDs {
					msg := searchHit.AfterMessages[i]
					require.True(t, msg.IsValid())
					require.Equal(t, msgID, msg.GetMessageID())
				}
			}
		}

		search := func(query string, opts chat1.SearchOpts) chat1.InboxSearchRes {
			res, err := tc1.chatLocalHandler().InboxSearch(tc1.startCtx, chat1.InboxSearchArg{
				Query: query,
				Opts:  opts,
			})
			require.NoError(t, err)
			t.Logf("query: %v, searchRes: %+v", query, res)
			return res
		}

		verifyIndexConsumption := func(consumeCh chan bool) {
			select {
			case <-consumeCh:
			case <-time.After(5 * time.Minute):
				require.Fail(t, "indexer didn't consume")
			}
		}

		verifyIndex := func(expectedIndex *chat1.ConversationIndex) {
			ctx := context.TODO()
			t.Logf("verify user 1 index")

			verifyIndexConsumption(indexConsumeCh1)
			convIdx1, err := indexer1.GetConvIndex(ctx, convID, uid1)
			require.NoError(t, err)
			require.Equal(t, expectedIndex, convIdx1)

			t.Logf("verify user 2 index")
			verifyIndexConsumption(indexConsumeCh2)
			convIdx2, err := indexer2.GetConvIndex(ctx, convID, uid2)
			require.NoError(t, err)
			require.Equal(t, expectedIndex, convIdx2)
		}

		opts := chat1.SearchOpts{
			MaxHits:       5,
			BeforeContext: 2,
			AfterContext:  2,
			MaxMessages:   1000,
		}

		// Test basic equality match
		msgBody := "hi, byE"
		msgID1 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex := &chat1.ConversationIndex{
			Index: map[string]map[chat1.MessageID]bool{
				"hi": map[chat1.MessageID]bool{
					msgID1: true,
				},
				"bye": map[chat1.MessageID]bool{
					msgID1: true,
				},
			},
			Metadata: chat1.ConversationIndexMetadata{
				SeenIDs: map[chat1.MessageID]bool{
					1:      true, // tlf name
					msgID1: true,
				},
				Version: 1,
			},
		}
		verifyIndex(expectedIndex)
		queries := []string{"hi", "hi, ByE"}
		matchText := []string{"hi", "hi, byE"}
		for i, query := range queries {
			res := search(query, opts)
			require.Equal(t, 1, len(res.Hits))
			convHit := res.Hits[0]
			require.Equal(t, convID, convHit.ConvID)
			require.Equal(t, 1, len(convHit.Hits))
			verifyHit(convID, nil, msgID1, nil, []string{matchText[i]}, convHit.Hits[0])
		}

		// No match since highlighting fails
		query := "hi bye"
		res := search(query, opts)
		require.Equal(t, 0, len(res.Hits))

		// Test basic no results
		query = "hey"
		res = search(query, opts)
		require.Equal(t, 0, len(res.Hits))

		// Test maxHits
		opts.MaxHits = 1
		query = "hi"
		msgID2 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex.Index["hi"][msgID2] = true
		expectedIndex.Index["bye"][msgID2] = true
		expectedIndex.Metadata.SeenIDs[msgID2] = true
		verifyIndex(expectedIndex)

		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		convHit := res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, nil, []string{query}, convHit.Hits[0])

		opts.MaxHits = 5
		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 2, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, nil, []string{query}, convHit.Hits[0])
		verifyHit(convID, nil, msgID1, []chat1.MessageID{msgID2}, []string{query}, convHit.Hits[1])

		msgID3 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex.Index["hi"][msgID3] = true
		expectedIndex.Index["bye"][msgID3] = true
		expectedIndex.Metadata.SeenIDs[msgID3] = true
		verifyIndex(expectedIndex)

		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 3, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1, msgID2}, msgID3, nil, []string{query}, convHit.Hits[0])
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, []chat1.MessageID{msgID3}, []string{query}, convHit.Hits[1])
		verifyHit(convID, nil, msgID1, []chat1.MessageID{msgID2, msgID3}, []string{query}, convHit.Hits[2])

		// test sentBy
		// invalid username
		opts.SentBy = u1.Username + "foo"
		res = search(query, opts)
		require.Zero(t, len(res.Hits))

		// send from user2 and make sure we can filter
		opts.SentBy = u2.Username
		msgBody = "hi"
		query = "hi"
		msgID4 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u2)
		expectedIndex.Index["hi"][msgID4] = true
		expectedIndex.Metadata.SeenIDs[msgID4] = true
		verifyIndex(expectedIndex)

		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID4, nil, []string{query}, convHit.Hits[0])
		opts.SentBy = ""

		// test sentBefore/sentAfter
		msgRes, err := tc1.chatLocalHandler().GetMessagesLocal(tc1.startCtx, chat1.GetMessagesLocalArg{
			ConversationID: convID,
			MessageIDs:     []chat1.MessageID{msgID1, msgID4},
		})
		require.NoError(t, err)
		require.Equal(t, 2, len(msgRes.Messages))
		msg1 := msgRes.Messages[0]
		msg4 := msgRes.Messages[1]

		// nothing sent after msg4
		opts.SentAfter = msg4.GetCtime() + 500
		res = search(query, opts)
		require.Zero(t, len(res.Hits))

		opts.SentAfter = msg1.GetCtime()
		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		require.Equal(t, 4, len(res.Hits[0].Hits))

		// nothing sent before msg1
		opts.SentAfter = 0
		opts.SentBefore = msg1.GetCtime() - 500
		res = search(query, opts)
		require.Zero(t, len(res.Hits))

		opts.SentBefore = msg4.GetCtime()
		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		require.Equal(t, 4, len(res.Hits[0].Hits))
		opts.SentBefore = 0

		// Test edit
		query = "edited"
		msgBody = "edited"
		msgID5 := mustEditMsg(tc2.startCtx, t, ctc, u2, conv, msgID4)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_EDIT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_EDIT)
		delete(expectedIndex.Index["hi"], msgID4)
		expectedIndex.Index["edited"] = map[chat1.MessageID]bool{msgID4: true}
		expectedIndex.Metadata.SeenIDs[msgID5] = true

		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID4, nil, []string{query}, convHit.Hits[0])

		// Test delete
		msgID6 := mustDeleteMsg(tc2.startCtx, t, ctc, u2, conv, msgID4)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETE)
		delete(expectedIndex.Index["edited"], msgID4)
		delete(expectedIndex.Index, "edited")
		expectedIndex.Metadata.SeenIDs[msgID6] = true
		verifyIndex(expectedIndex)

		res = search(query, opts)
		require.Equal(t, 0, len(res.Hits))

		// Test request payment
		query = "payment :moneybag:"
		msgBody = "payment :moneybag:"
		msgID7 := sendMessage(chat1.NewMessageBodyWithRequestpayment(chat1.MessageRequestPayment{
			RequestID: stellar1.KeybaseRequestID("dummy id"),
			Note:      msgBody,
		}), u1)
		expectedIndex.Index["payment"] = map[chat1.MessageID]bool{msgID7: true}
		expectedIndex.Index[":moneybag:"] = map[chat1.MessageID]bool{msgID7: true}
		expectedIndex.Metadata.SeenIDs[msgID7] = true
		verifyIndex(expectedIndex)

		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID7, nil, []string{query}, convHit.Hits[0])

		// Test utf8
		msgBody = `约书亚和约翰屌爆了`
		query = `约书亚和约翰屌爆了`
		msgID8 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex.Index[msgBody] = map[chat1.MessageID]bool{msgID8: true}
		expectedIndex.Metadata.SeenIDs[msgID8] = true
		verifyIndex(expectedIndex)
		res = search(query, opts)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID3, msgID7}, msgID8, nil, []string{query}, convHit.Hits[0])

		// Test deletehistory
		msgID9 := mustDeleteHistory(tc2.startCtx, t, ctc, u2, conv, msgID8+1)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETEHISTORY)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETEHISTORY)
		expectedIndex.Index = map[string]map[chat1.MessageID]bool{}
		expectedIndex.Metadata.SeenIDs[msgID9] = true
		verifyIndex(expectedIndex)
	})
}
