package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
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

		ctc := makeChatTestContext(t, "SearchRegexp", 2)
		defer ctc.cleanup()
		users := ctc.users()
		u1 := users[0]
		u2 := users[1]

		conv := mustCreateConversationForTest(t, ctc, u1, chat1.TopicType_CHAT,
			mt, ctc.as(t, u2).user())
		convID := conv.Id

		tc1 := ctc.as(t, u1)
		tc2 := ctc.as(t, u2)

		chatUI := kbtest.NewChatUI()
		tc1.h.mockChatUI = chatUI

		listener1 := newServerChatListener()
		tc1.h.G().NotifyRouter.AddListener(listener1)
		listener2 := newServerChatListener()
		tc2.h.G().NotifyRouter.AddListener(listener2)

		sendMessage := func(msgBody chat1.MessageBody, user *kbtest.FakeUser) chat1.MessageID {
			msgID := mustPostLocalForTest(t, ctc, user, conv, msgBody)
			typ, err := msgBody.MessageType()
			require.NoError(t, err)
			consumeNewMsgRemote(t, listener1, typ)
			consumeNewMsgRemote(t, listener2, typ)
			return msgID
		}

		verifyHit := func(beforeMsgIDs []chat1.MessageID, hitMessageID chat1.MessageID, afterMsgIDs []chat1.MessageID,
			matches []chat1.ChatSearchMatch, searchHit chat1.ChatSearchHit) {
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
			case searchHitRes := <-chatUI.SearchHitCb:
				_verifyHit(searchHitRes.SearchHit)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no search result received")
			}
		}
		verifySearchDone := func(numHits int) {
			select {
			case searchDone := <-chatUI.SearchDoneCb:
				require.Equal(t, numHits, searchDone.NumHits)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no search result received")
			}
		}

		runSearch := func(query string, isRegex bool, opts chat1.SearchOpts) chat1.SearchRegexpRes {
			res, err := tc1.chatLocalHandler().SearchRegexp(tc1.startCtx, chat1.SearchRegexpArg{
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
		msgID1 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		res := runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit(nil, msgID1, nil, []chat1.ChatSearchMatch{
			chat1.ChatSearchMatch{
				StartIndex: 0,
				EndIndex:   2,
				Match:      query,
			},
		}, res.Hits[0])
		verifySearchDone(1)

		// Test basic no results
		query = "hey"
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0)

		// Test maxHits
		opts.MaxHits = 1
		query = "hi"
		searchMatch := chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   2,
			Match:      query,
		}
		msgID2 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID1}, msgID2, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifySearchDone(1)

		opts.MaxHits = 5
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 2, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID1}, msgID2, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifyHit(nil, msgID1, []chat1.MessageID{msgID2}, []chat1.ChatSearchMatch{searchMatch}, res.Hits[1])
		verifySearchDone(2)

		msgID3 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 3, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID1, msgID2}, msgID3, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifyHit([]chat1.MessageID{msgID1}, msgID2, []chat1.MessageID{msgID3}, []chat1.ChatSearchMatch{searchMatch}, res.Hits[1])
		verifyHit(nil, msgID1, []chat1.MessageID{msgID2, msgID3}, []chat1.ChatSearchMatch{searchMatch}, res.Hits[2])
		verifySearchDone(3)

		// test sentBy
		// invalid username
		opts.SentBy = u1.Username + "foo"
		res = runSearch(query, isRegex, opts)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0)

		// send from user2 and make sure we can filter
		opts.SentBy = u2.Username
		msgBody = "hi"
		msgID4 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u2)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
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
		res = runSearch(query, isRegex, opts)
		require.Zero(t, len(res.Hits))

		opts.SentAfter = msg1.GetCtime()
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 4, len(res.Hits))

		// nothing sent before msg1
		opts.SentAfter = 0
		opts.SentBefore = msg1.GetCtime() - 500
		res = runSearch(query, isRegex, opts)
		require.Zero(t, len(res.Hits))

		opts.SentBefore = msg4.GetCtime()
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 4, len(res.Hits))

		opts.SentBefore = 0

		// drain the cbs, 8 hits and 4 dones
		timeout := 20 * time.Second
		for i := 0; i < 8+4; i++ {
			select {
			case <-chatUI.SearchHitCb:
			case <-chatUI.SearchDoneCb:
			case <-time.After(timeout):
				require.Fail(t, "no search result received")
			}
		}

		query = "edited"
		msgBody = "edited"
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   len(msgBody),
			Match:      msgBody,
		}
		mustEditMsg(tc2.startCtx, t, ctc, u2, conv, msgID4)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_EDIT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_EDIT)

		res = runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifySearchDone(1)

		// Test delete
		mustDeleteMsg(tc2.startCtx, t, ctc, u2, conv, msgID4)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETE)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0)

		// Test request payment
		query = "payment :moneybag:"
		msgBody = "payment :moneybag:"
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   len(msgBody),
			Match:      msgBody,
		}
		msgID7 := sendMessage(chat1.NewMessageBodyWithRequestpayment(chat1.MessageRequestPayment{
			RequestID: stellar1.KeybaseRequestID("dummy id"),
			Note:      msgBody,
		}), u1)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID2, msgID3}, msgID7, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifySearchDone(1)

		// Test regex functionality
		isRegex = true

		// Test utf8
		msgBody = `约书亚和约翰屌爆了`
		query = `约.*`
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   len(msgBody),
			Match:      msgBody,
		}
		msgID8 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID3, msgID7}, msgID8, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifySearchDone(1)

		msgBody = "hihihi"
		query = "hi"
		matches := []chat1.ChatSearchMatch{}
		startIndex := 0
		for i := 0; i < 3; i++ {
			matches = append(matches, chat1.ChatSearchMatch{
				StartIndex: startIndex,
				EndIndex:   startIndex + 2,
				Match:      query,
			})
			startIndex += 2
		}

		opts.MaxHits = 1
		msgID9 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID7, msgID8}, msgID9, nil, matches, res.Hits[0])
		verifySearchDone(1)

		query = "h.*"
		lowercase := "abcdefghijklmnopqrstuvwxyz"
		for _, char := range lowercase {
			sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "h." + string(char),
			}), u1)
		}
		opts.MaxHits = len(lowercase)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, opts.MaxHits, len(res.Hits))
		verifySearchDone(opts.MaxHits)

		// Test maxMessages
		opts.MaxMessages = 2
		res = runSearch(query, isRegex, opts)
		require.Equal(t, opts.MaxMessages, len(res.Hits))
		verifySearchDone(opts.MaxMessages)

		query = `[A-Z]*`
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0)

		// Test invalid regex
		_, err = tc1.chatLocalHandler().SearchRegexp(tc1.startCtx, chat1.SearchRegexpArg{
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

		ctx := context.TODO()
		ctc := makeChatTestContext(t, "SearchInbox", 2)
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

		chatUI := kbtest.NewChatUI()
		tc1.h.mockChatUI = chatUI

		listener1 := newServerChatListener()
		tc1.h.G().NotifyRouter.AddListener(listener1)
		listener2 := newServerChatListener()
		tc2.h.G().NotifyRouter.AddListener(listener2)

		// Create our own Indexer instances so we have access to non-interface methods
		indexer1 := search.NewIndexer(g1)
		consumeCh1 := make(chan chat1.ConversationID, 100)
		reindexCh1 := make(chan chat1.ConversationID, 100)
		indexer1.SetConsumeCh(consumeCh1)
		indexer1.SetReindexCh(reindexCh1)
		// Stop the original
		select {
		case <-g1.Indexer.Stop(ctx):
		case <-time.After(5 * time.Second):
			require.Fail(t, "g1 Indexer did not stop")
		}
		g1.Indexer = indexer1

		indexer2 := search.NewIndexer(g2)
		consumeCh2 := make(chan chat1.ConversationID, 100)
		reindexCh2 := make(chan chat1.ConversationID, 100)
		indexer2.SetConsumeCh(consumeCh2)
		indexer2.SetReindexCh(reindexCh2)
		// Stop the original
		select {
		case <-g2.Indexer.Stop(ctx):
		case <-time.After(5 * time.Second):
			require.Fail(t, "g2 Indexer did not stop")
		}
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
			afterMsgIDs []chat1.MessageID, matches []chat1.ChatSearchMatch, searchHit chat1.ChatSearchHit) {
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
		verifySearchDone := func(numHits int) {
			select {
			case <-chatUI.InboxSearchConvHitsCb:
			case <-time.After(20 * time.Second):
				require.Fail(t, "no name hits")
			}
			select {
			case searchDone := <-chatUI.InboxSearchDoneCb:
				require.Equal(t, numHits, searchDone.Res.NumHits)
				numConvs := 1
				if numHits == 0 {
					numConvs = 0
				}
				require.Equal(t, numConvs, searchDone.Res.NumConvs)
				require.Equal(t, 100, searchDone.Res.PercentIndexed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no search result received")
			}
		}

		verifyIndexConsumption := func(ch chan chat1.ConversationID) {
			select {
			case id := <-ch:
				require.Equal(t, convID, id)
			case <-time.After(5 * time.Second):
				require.Fail(t, "indexer didn't consume")
			}
		}

		verifyIndexNoConsumption := func(ch chan chat1.ConversationID) {
			select {
			case <-ch:
				require.Fail(t, "indexer reindexed")
			default:
			}
		}

		verifyIndex := func(expectedIndex *chat1.ConversationIndex) {
			t.Logf("verify user 1 index")

			verifyIndexConsumption(consumeCh1)
			convIdx1, err := indexer1.GetConvIndex(ctx, convID, uid1)
			require.NoError(t, err)
			require.Equal(t, expectedIndex, convIdx1)

			t.Logf("verify user 2 index")
			verifyIndexConsumption(consumeCh2)
			convIdx2, err := indexer2.GetConvIndex(ctx, convID, uid2)
			require.NoError(t, err)
			require.Equal(t, expectedIndex, convIdx2)
		}

		runSearch := func(query string, opts chat1.SearchOpts, expectedReindex bool) *chat1.ChatSearchInboxResults {
			res, err := tc1.chatLocalHandler().SearchInbox(tc1.startCtx, chat1.SearchInboxArg{
				Query: query,
				Opts:  opts,
			})
			require.NoError(t, err)
			t.Logf("query: %v, searchRes: %+v", query, res)
			if expectedReindex {
				verifyIndexConsumption(reindexCh1)
			} else {
				verifyIndexNoConsumption(reindexCh1)
			}
			return res.Res
		}

		opts := chat1.SearchOpts{
			MaxHits:       5,
			BeforeContext: 2,
			AfterContext:  2,
			MaxMessages:   1000,
		}

		// Test basic equality match
		msgBody := "hello, byE"
		msgID1 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex := &chat1.ConversationIndex{
			Index: map[string]map[chat1.MessageID]chat1.EmptyStruct{
				"hello": map[chat1.MessageID]chat1.EmptyStruct{
					msgID1: chat1.EmptyStruct{},
				},
				"bye": map[chat1.MessageID]chat1.EmptyStruct{
					msgID1: chat1.EmptyStruct{},
				},
			},
			Alias: map[string]map[string]chat1.EmptyStruct{
				"hel": map[string]chat1.EmptyStruct{
					"hello": chat1.EmptyStruct{},
				},
				"hell": map[string]chat1.EmptyStruct{
					"hello": chat1.EmptyStruct{},
				},
			},
			Metadata: chat1.ConversationIndexMetadata{
				SeenIDs: map[chat1.MessageID]chat1.EmptyStruct{
					1:      chat1.EmptyStruct{}, // tlf name
					msgID1: chat1.EmptyStruct{},
				},
				Version: search.IndexVersion,
			},
		}
		verifyIndex(expectedIndex)
		queries := []string{"hello", "hello, ByE"}
		matches := []chat1.ChatSearchMatch{
			chat1.ChatSearchMatch{
				StartIndex: 0,
				EndIndex:   5,
				Match:      "hello",
			},
			chat1.ChatSearchMatch{
				StartIndex: 0,
				EndIndex:   10,
				Match:      "hello, byE",
			},
		}
		for i, query := range queries {
			res := runSearch(query, opts, false /* expectedReindex */)
			require.Equal(t, 1, len(res.Hits))
			convHit := res.Hits[0]
			require.Equal(t, convID, convHit.ConvID)
			require.Equal(t, 1, len(convHit.Hits))
			verifyHit(convID, nil, msgID1, nil, []chat1.ChatSearchMatch{matches[i]}, convHit.Hits[0])
			verifySearchDone(1)
		}

		// We get a hit but without any highlighting highlighting fails
		query := "hell bye"
		res := runSearch(query, opts, false /* expectedReindex */)
		require.Equal(t, 1, len(res.Hits))
		convHit := res.Hits[0]
		verifyHit(convID, nil, msgID1, nil, nil, convHit.Hits[0])
		verifySearchDone(1)

		// Test basic no results
		query = "hey"
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0)

		// Test maxHits
		opts.MaxHits = 1
		query = "hello"
		searchMatch := chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   len(query),
			Match:      query,
		}
		msgID2 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex.Index["hello"][msgID2] = chat1.EmptyStruct{}
		expectedIndex.Index["bye"][msgID2] = chat1.EmptyStruct{}
		expectedIndex.Metadata.SeenIDs[msgID2] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1)

		opts.MaxHits = 5
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 2, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifyHit(convID, nil, msgID1, []chat1.MessageID{msgID2}, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[1])
		verifySearchDone(2)

		msgID3 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex.Index["hello"][msgID3] = chat1.EmptyStruct{}
		expectedIndex.Index["bye"][msgID3] = chat1.EmptyStruct{}
		expectedIndex.Metadata.SeenIDs[msgID3] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 3, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1, msgID2}, msgID3, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, []chat1.MessageID{msgID3}, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[1])
		verifyHit(convID, nil, msgID1, []chat1.MessageID{msgID2, msgID3}, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[2])
		verifySearchDone(3)

		// test sentBy
		// invalid username
		opts.SentBy = u1.Username + "foo"
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0)

		// send from user2 and make sure we can filter
		opts.SentBy = u2.Username
		msgBody = "hello"
		query = "hello"
		msgID4 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u2)
		expectedIndex.Index["hello"][msgID4] = chat1.EmptyStruct{}
		expectedIndex.Metadata.SeenIDs[msgID4] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
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
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Zero(t, len(res.Hits))

		opts.SentAfter = msg1.GetCtime()
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		require.Equal(t, 4, len(res.Hits[0].Hits))

		// nothing sent before msg1
		opts.SentAfter = 0
		opts.SentBefore = msg1.GetCtime() - 500
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Zero(t, len(res.Hits))

		opts.SentBefore = msg4.GetCtime()
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		require.Equal(t, 4, len(res.Hits[0].Hits))
		opts.SentBefore = 0

		// drain the cbs, 8 hits and 4 dones
		timeout := 20 * time.Second
		for i := 0; i < 8+4; i++ {
			select {
			case <-chatUI.InboxSearchHitCb:
			case <-chatUI.InboxSearchDoneCb:
			case <-time.After(timeout):
				require.Fail(t, "no search result received")
			}
		}

		// Test edit
		query = "edited"
		msgBody = "edited"
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   len(msgBody),
			Match:      msgBody,
		}
		msgID5 := mustEditMsg(tc2.startCtx, t, ctc, u2, conv, msgID4)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_EDIT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_EDIT)
		delete(expectedIndex.Index["hello"], msgID4)
		expectedIndex.Index["edited"] = map[chat1.MessageID]chat1.EmptyStruct{msgID4: chat1.EmptyStruct{}}
		expectedIndex.Alias["edi"] = map[string]chat1.EmptyStruct{"edited": chat1.EmptyStruct{}}
		expectedIndex.Alias["edit"] = map[string]chat1.EmptyStruct{"edited": chat1.EmptyStruct{}}
		expectedIndex.Alias["edite"] = map[string]chat1.EmptyStruct{"edited": chat1.EmptyStruct{}}
		expectedIndex.Metadata.SeenIDs[msgID5] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1)

		// Test delete
		msgID6 := mustDeleteMsg(tc2.startCtx, t, ctc, u2, conv, msgID4)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETE)
		delete(expectedIndex.Index["edited"], msgID4)
		delete(expectedIndex.Index, "edited")
		delete(expectedIndex.Alias, "edi")
		delete(expectedIndex.Alias, "edit")
		delete(expectedIndex.Alias, "edite")
		expectedIndex.Metadata.SeenIDs[msgID6] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0)

		// Test request payment
		query = "payment :moneybag:"
		msgBody = "payment :moneybag:"
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   len(msgBody),
			Match:      msgBody,
		}
		msgID7 := sendMessage(chat1.NewMessageBodyWithRequestpayment(chat1.MessageRequestPayment{
			RequestID: stellar1.KeybaseRequestID("dummy id"),
			Note:      msgBody,
		}), u1)
		expectedIndex.Index["payment"] = map[chat1.MessageID]chat1.EmptyStruct{msgID7: chat1.EmptyStruct{}}
		expectedIndex.Alias["pay"] = map[string]chat1.EmptyStruct{"payment": chat1.EmptyStruct{}}
		expectedIndex.Alias["paym"] = map[string]chat1.EmptyStruct{"payment": chat1.EmptyStruct{}}
		expectedIndex.Alias["payme"] = map[string]chat1.EmptyStruct{"payment": chat1.EmptyStruct{}}
		expectedIndex.Alias["paymen"] = map[string]chat1.EmptyStruct{"payment": chat1.EmptyStruct{}}
		expectedIndex.Index[":moneybag:"] = map[chat1.MessageID]chat1.EmptyStruct{msgID7: chat1.EmptyStruct{}}
		expectedIndex.Alias[":mo"] = map[string]chat1.EmptyStruct{":moneybag:": chat1.EmptyStruct{}}
		expectedIndex.Alias[":mon"] = map[string]chat1.EmptyStruct{":moneybag:": chat1.EmptyStruct{}}
		expectedIndex.Alias[":mone"] = map[string]chat1.EmptyStruct{":moneybag:": chat1.EmptyStruct{}}
		expectedIndex.Alias[":money"] = map[string]chat1.EmptyStruct{":moneybag:": chat1.EmptyStruct{}}
		expectedIndex.Alias[":moneyb"] = map[string]chat1.EmptyStruct{":moneybag:": chat1.EmptyStruct{}}
		expectedIndex.Alias[":moneyba"] = map[string]chat1.EmptyStruct{":moneybag:": chat1.EmptyStruct{}}
		expectedIndex.Alias[":moneybag"] = map[string]chat1.EmptyStruct{":moneybag:": chat1.EmptyStruct{}}
		expectedIndex.Metadata.SeenIDs[msgID7] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID7, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1)

		// Test utf8
		msgBody = `约书亚和约翰屌爆了`
		query = `约书亚和约翰屌爆了`
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   len(msgBody),
			Match:      msgBody,
		}
		msgID8 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		expectedIndex.Index[msgBody] = map[chat1.MessageID]chat1.EmptyStruct{msgID8: chat1.EmptyStruct{}}
		expectedIndex.Alias[`约`] = map[string]chat1.EmptyStruct{msgBody: chat1.EmptyStruct{}}
		expectedIndex.Alias[`约书`] = map[string]chat1.EmptyStruct{msgBody: chat1.EmptyStruct{}}
		expectedIndex.Alias[`约书亚`] = map[string]chat1.EmptyStruct{msgBody: chat1.EmptyStruct{}}
		expectedIndex.Alias[`约书亚和`] = map[string]chat1.EmptyStruct{msgBody: chat1.EmptyStruct{}}
		expectedIndex.Alias[`约书亚和约`] = map[string]chat1.EmptyStruct{msgBody: chat1.EmptyStruct{}}
		expectedIndex.Alias[`约书亚和约翰`] = map[string]chat1.EmptyStruct{msgBody: chat1.EmptyStruct{}}
		// NOTE other prefixes are cut off since they exceed the max length
		expectedIndex.Metadata.SeenIDs[msgID8] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID3, msgID7}, msgID8, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1)

		// DB nuke, ensure that we reindex after the search
		g1.LocalChatDb.Nuke()
		opts.ForceReindex = true // force reindex so we're fully up to date.
		res = runSearch(query, opts, true /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID3, msgID7}, msgID8, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1)
		verifyIndex(expectedIndex)
		// since our index is full, we shouldn't fire off any calls to get messages
		runSearch(query, opts, false /* expectedReindex*/)

		// Verify background syncing
		g1.LocalChatDb.Nuke()
		ictx := globals.CtxAddIdentifyMode(ctx, keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil)
		indexer1.SelectiveSync(ictx, uid1, true /* forceReindex */)
		opts.ForceReindex = false
		res = runSearch(query, opts, true /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID3, msgID7}, msgID8, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1)
		verifyIndex(expectedIndex)
		// since our index is full, we shouldn't fire off any calls to get messages
		runSearch(query, opts, false /* expectedReindex*/)

		// Test prefix searching
		query = "pay"
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   3,
			Match:      "pay",
		}
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID7, []chat1.MessageID{msgID8}, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1)

		// Test deletehistory
		msgID9 := mustDeleteHistory(tc2.startCtx, t, ctc, u2, conv, msgID8+1)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETEHISTORY)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETEHISTORY)
		expectedIndex.Index = map[string]map[chat1.MessageID]chat1.EmptyStruct{}
		expectedIndex.Alias = map[string]map[string]chat1.EmptyStruct{}
		expectedIndex.Metadata.SeenIDs[msgID9] = chat1.EmptyStruct{}
		verifyIndex(expectedIndex)
	})
}
