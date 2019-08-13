package chat

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
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
			opts.IsRegex = isRegex
			res, err := tc1.chatLocalHandler().SearchRegexp(tc1.startCtx, chat1.SearchRegexpArg{
				ConvID: convID,
				Query:  query,
				Opts:   opts,
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
		msgBody := "hi @here"
		msgID1 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)
		searchMatch := chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   2,
			Match:      query,
		}
		res := runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit(nil, msgID1, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifySearchDone(1)

		// Test basic no results
		query = "hey"
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0)

		// Test maxHits
		opts.MaxHits = 1
		query = "hi"
		msgBody = "hi there"
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

		// send from user2 and make sure we can filter, @mention user1 to test
		// SentTo later.
		opts.SentBy = u2.Username
		msgBody = fmt.Sprintf("hi @%s", u1.Username)
		msgID4 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u2)
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 1, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifySearchDone(1)
		opts.SentBy = ""

		// test sentTo
		// invalid username
		opts.SentTo = u1.Username + "foo"
		res = runSearch(query, isRegex, opts)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0)

		opts.SentTo = u1.Username
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 2, len(res.Hits))
		verifyHit([]chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, res.Hits[0])
		verifyHit(nil, msgID1, []chat1.MessageID{msgID2, msgID3}, []chat1.ChatSearchMatch{searchMatch}, res.Hits[1])
		verifySearchDone(2)
		opts.SentTo = ""

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
		opts.SentAfter = msg4.Ctime() + 500
		res = runSearch(query, isRegex, opts)
		require.Zero(t, len(res.Hits))

		opts.SentAfter = msg1.Ctime()
		res = runSearch(query, isRegex, opts)
		require.Equal(t, 4, len(res.Hits))

		// nothing sent before msg1
		opts.SentAfter = 0
		opts.SentBefore = msg1.Ctime() - 500
		res = runSearch(query, isRegex, opts)
		require.Zero(t, len(res.Hits))

		opts.SentBefore = msg4.Ctime()
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
			ConvID: convID,
			Query:  "(",
			Opts: chat1.SearchOpts{
				IsRegex: true,
			},
		})
		require.Error(t, err)
	})
}

func TestChatSearchRemoveMsg(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestChatSearchRemoveMsg", 2)
	defer ctc.cleanup()

	users := ctc.users()
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	chatUI := kbtest.NewChatUI()
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	ctc.as(t, users[0]).h.mockChatUI = chatUI
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	conv1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])

	msgID0 := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "MIKEMAXIM",
	}))
	msgID1 := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "MIKEMAXIM",
	}))
	msgID2 := mustPostLocalForTest(t, ctc, users[0], conv1, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "MIKEMAXIM",
	}))
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "CRICKETS",
	}))
	res, err := ctc.as(t, users[0]).chatLocalHandler().SearchInbox(ctx, chat1.SearchInboxArg{
		Query: "MIKEM",
		Opts: chat1.SearchOpts{
			MaxConvsHit: 5,
			MaxHits:     5,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, res.Res)
	require.Equal(t, 2, len(res.Res.Hits))
	if res.Res.Hits[0].ConvID.Eq(conv.Id) {
		require.Equal(t, 2, len(res.Res.Hits[0].Hits))
		require.Equal(t, 1, len(res.Res.Hits[1].Hits))
	} else {
		require.Equal(t, 1, len(res.Res.Hits[0].Hits))
		require.Equal(t, 2, len(res.Res.Hits[1].Hits))
	}

	mustDeleteMsg(ctx, t, ctc, users[0], conv1, msgID2)

	res, err = ctc.as(t, users[0]).chatLocalHandler().SearchInbox(ctx, chat1.SearchInboxArg{
		Query: "MIKEM",
		Opts: chat1.SearchOpts{
			MaxConvsHit: 5,
			MaxHits:     5,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, res.Res)
	require.Equal(t, 1, len(res.Res.Hits))
	require.Equal(t, 2, len(res.Res.Hits[0].Hits))

	mustDeleteMsg(ctx, t, ctc, users[0], conv, msgID0)
	mustDeleteMsg(ctx, t, ctc, users[0], conv, msgID1)

	hres, err := tc.ChatG.Indexer.(*search.Indexer).GetStoreHits(ctx, uid, conv.Id, "MIKEM")
	require.NoError(t, err)
	require.Zero(t, len(hres))
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
		indexer1.SetStartSyncDelay(0)
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
		indexer2.SetStartSyncDelay(0)
		// Stop the original
		select {
		case <-g2.Indexer.Stop(ctx):
		case <-time.After(5 * time.Second):
			require.Fail(t, "g2 Indexer did not stop")
		}
		g2.Indexer = indexer2

		conv := mustCreateConversationForTest(t, ctc, u1, chat1.TopicType_CHAT,
			mt, ctc.as(t, u2).user())
		convID := conv.Id

		// verify zero messages case
		fi, err := indexer1.FullyIndexed(ctx, conv.Id, uid1)
		require.NoError(t, err)
		require.True(t, fi)
		pi, err := indexer1.PercentIndexed(ctx, conv.Id, uid1)
		require.NoError(t, err)
		require.Equal(t, 100, pi)

		fi, err = indexer2.FullyIndexed(ctx, conv.Id, uid2)
		require.NoError(t, err)
		require.True(t, fi)
		pi, err = indexer2.PercentIndexed(ctx, conv.Id, uid2)
		require.NoError(t, err)
		require.Equal(t, 100, pi)

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
		verifySearchDone := func(numHits int, delegated bool) {
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
				if delegated {
					require.True(t, searchDone.Res.Delegated)
				} else {
					require.Equal(t, 100, searchDone.Res.PercentIndexed)
				}
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

		verifyIndex := func() {
			t.Logf("verify user 1 index")
			verifyIndexConsumption(consumeCh1)
			t.Logf("verify user 2 index")
			verifyIndexConsumption(consumeCh2)
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
			MaxNameConvs:  1,
		}

		// Test basic equality match
		msgBody := "hello, byE"
		msgID1 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)

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
			verifySearchDone(1, false)
		}

		// We get a hit but without any highlighting highlighting fails
		query := "hell bye"
		res := runSearch(query, opts, false /* expectedReindex */)
		require.Equal(t, 1, len(res.Hits))
		convHit := res.Hits[0]
		verifyHit(convID, nil, msgID1, nil, nil, convHit.Hits[0])
		verifySearchDone(1, false)

		// Test basic no results
		query = "hey"
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0, false)

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
		verifyIndex()

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)

		opts.MaxHits = 5
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 2, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifyHit(convID, nil, msgID1, []chat1.MessageID{msgID2}, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[1])
		verifySearchDone(2, false)

		msgID3 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u1)

		verifyIndex()

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 3, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID1, msgID2}, msgID3, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifyHit(convID, []chat1.MessageID{msgID1}, msgID2, []chat1.MessageID{msgID3}, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[1])
		verifyHit(convID, nil, msgID1, []chat1.MessageID{msgID2, msgID3}, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[2])
		verifySearchDone(3, false)

		// test sentBy
		// invalid username
		opts.SentBy = u1.Username + "foo"
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0, false)

		// send from user2 and make sure we can filter
		opts.SentBy = u2.Username
		msgBody = "hello"
		query = "hello"
		msgID4 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u2)
		verifyIndex()

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)
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
		opts.SentAfter = msg4.Ctime() + 500
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0, false)

		opts.SentAfter = msg1.Ctime()
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		require.Equal(t, 4, len(res.Hits[0].Hits))
		verifySearchDone(4, false)

		// nothing sent before msg1
		opts.SentAfter = 0
		opts.SentBefore = msg1.Ctime() - 500
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0, false)

		opts.SentBefore = msg4.Ctime()
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		require.Equal(t, 4, len(res.Hits[0].Hits))
		verifySearchDone(4, false)
		opts.SentBefore = 0

		// Test edit
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
		verifyIndex()

		res = runSearch(query, opts, false /* expectedReindex*/)
		t.Logf("%+v", res)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID4, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)

		// Test delete
		mustDeleteMsg(tc2.startCtx, t, ctc, u2, conv, msgID4)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETE)
		verifyIndex()

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0, false)

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
		verifyIndex()

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID2, msgID3}, msgID7, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)

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
		// NOTE other prefixes are cut off since they exceed the max length
		verifyIndex()
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID3, msgID7}, msgID8, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)

		// DB nuke, ensure that we reindex after the search
		g1.LocalChatDb.Nuke()
		opts.ReindexMode = chat1.ReIndexingMode_PRESEARCH_SYNC // force reindex so we're fully up to date.
		res = runSearch(query, opts, true /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID3, msgID7}, msgID8, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)
		verifyIndex()

		// since our index is full, we shouldn't fire off any calls to get messages
		runSearch(query, opts, false /* expectedReindex*/)
		verifySearchDone(1, false)

		// Verify POSTSEARCH_SYNC
		ictx := globals.CtxAddIdentifyMode(ctx, keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil)
		g1.LocalChatDb.Nuke()
		err = indexer1.SelectiveSync(ictx, uid1)
		require.NoError(t, err)
		opts.ReindexMode = chat1.ReIndexingMode_POSTSEARCH_SYNC
		res = runSearch(query, opts, true /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID3, msgID7}, msgID8, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)
		verifyIndex()

		// since our index is full, we shouldn't fire off any calls to get messages
		runSearch(query, opts, false /* expectedReindex*/)
		verifySearchDone(1, false)

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
		verifySearchDone(1, false)

		query = "payments"
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 0, len(res.Hits))
		verifySearchDone(0, false)

		// Test deletehistory
		mustDeleteHistory(tc2.startCtx, t, ctc, u2, conv, msgID8+1)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETEHISTORY)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETEHISTORY)
		verifyIndex()

		// test sentTo
		msgBody = "hello @" + u1.Username
		query = "hello"
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   5,
			Match:      "hello",
		}
		msgID10 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}), u2)

		// invalid username
		opts.SentTo = u1.Username + "foo"
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Zero(t, len(res.Hits))
		verifySearchDone(0, false)

		opts.SentTo = u1.Username
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{}, msgID10, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, false)
		opts.SentTo = ""

		// Test canceling sync loop
		syncLoopCh := make(chan struct{})
		indexer1.SetSyncLoopCh(syncLoopCh)
		go indexer1.SyncLoop(ctx, uid1)
		indexer1.CancelSync(ctx)
		select {
		case <-time.After(5 * time.Second):
			require.Fail(t, "indexer SyncLoop never finished")
		case <-syncLoopCh:
		}
		indexer1.PokeSync(ctx)
		indexer1.CancelSync(ctx)
		select {
		case <-time.After(5 * time.Second):
			require.Fail(t, "indexer SyncLoop never finished")
		case <-syncLoopCh:
		}

		// test search delegation with a specific conv
		// delegate on queries shorter than search.MinTokenLength
		opts.ConvID = &convID
		// delegate if a single conv is not fully indexed
		query = "hello"
		g1.LocalChatDb.Nuke()
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{}, msgID10, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, true)

		// delegate on regexp searches
		query = "/hello/"
		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{}, msgID10, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, true)

		query = "hi"
		searchMatch = chat1.ChatSearchMatch{
			StartIndex: 0,
			EndIndex:   2,
			Match:      "hi",
		}
		msgID11 := sendMessage(chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: query,
		}), u1)

		res = runSearch(query, opts, false /* expectedReindex*/)
		require.Equal(t, 1, len(res.Hits))
		convHit = res.Hits[0]
		require.Equal(t, convID, convHit.ConvID)
		require.Equal(t, 1, len(convHit.Hits))
		verifyHit(convID, []chat1.MessageID{msgID10}, msgID11, nil, []chat1.ChatSearchMatch{searchMatch}, convHit.Hits[0])
		verifySearchDone(1, true)

	})
}
