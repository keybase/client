package chat

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/flip"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func consumeFlipToResult(t *testing.T, ui *kbtest.ChatUI, listener *serverChatListener,
	gameID string, numUsers int) string {
	timeout := 20 * time.Second
	consumeNewMsgRemote(t, listener, chat1.MessageType_FLIP) // host msg
	for {
		select {
		case updates := <-ui.CoinFlipUpdates:
			require.Equal(t, 1, len(updates))
			t.Logf("update: %v gameID: %s", updates[0].Phase, updates[0].GameID)
			if updates[0].Phase == chat1.UICoinFlipPhase_COMPLETE {
				if updates[0].GameID != gameID {
					// it is possible for a game to produce more than one complete update
					// so if we get one for a different game, just skip it
					t.Logf("skipping complete: looking: %s found: %s", gameID, updates[0].GameID)
					continue
				}
				require.Equal(t, numUsers, len(updates[0].Participants))
				return updates[0].ResultText
			}
		case <-time.After(timeout):
			require.Fail(t, "no complete")
		}
	}
}
func assertNoFlip(t *testing.T, ui *kbtest.ChatUI) {
	select {
	case <-ui.CoinFlipUpdates:
		require.Fail(t, "unexpected coinflip update")
	default:
	}
}

func TestFlipManagerStartFlip(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		runWithEphemeral(t, mt, func(ephemeralLifetime *gregor1.DurationSec) {
			ctc := makeChatTestContext(t, "FlipManagerStartFlip", 3)
			defer ctc.cleanup()

			users := ctc.users()
			numUsers := 3
			flip.DefaultCommitmentWindowMsec = 2000

			var ui0, ui1, ui2 *kbtest.ChatUI
			ui0 = kbtest.NewChatUI()
			ui1 = kbtest.NewChatUI()
			ui2 = kbtest.NewChatUI()
			ctc.as(t, users[0]).h.mockChatUI = ui0
			ctc.as(t, users[1]).h.mockChatUI = ui1
			ctc.as(t, users[2]).h.mockChatUI = ui2
			ctc.world.Tcs[users[0].Username].G.UIRouter = &fakeUIRouter{ui: ui0}
			ctc.world.Tcs[users[1].Username].G.UIRouter = &fakeUIRouter{ui: ui1}
			ctc.world.Tcs[users[2].Username].G.UIRouter = &fakeUIRouter{ui: ui2}
			listener0 := newServerChatListener()
			listener1 := newServerChatListener()
			listener2 := newServerChatListener()
			ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
			ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
			ctc.as(t, users[2]).h.G().NotifyRouter.AddListener(listener2)

			t.Logf("uid0: %s", users[0].GetUID())
			t.Logf("uid1: %s", users[1].GetUID())
			t.Logf("uid2: %s", users[2].GetUID())
			conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())
			consumeNewConversation(t, listener0, conv.Id)
			consumeNewConversation(t, listener1, conv.Id)
			consumeNewConversation(t, listener2, conv.Id)
			var policy *chat1.RetentionPolicy
			if ephemeralLifetime != nil {
				p := chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{Age: *ephemeralLifetime})
				policy = &p
				mustSetConvRetentionLocal(t, ctc, users[0], conv.Id, p)
				consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
				consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)
				consumeNewMsgRemote(t, listener2, chat1.MessageType_SYSTEM)
			}

			expectedDevConvs := 0
			// bool
			expectedDevConvs++
			mustPostLocalForTest(t, ctc, users[0], conv,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "/flip",
				}))
			flipMsg := consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
			require.True(t, flipMsg.IsValid())
			require.NotNil(t, flipMsg.Valid().FlipGameID)
			gameID := *flipMsg.Valid().FlipGameID
			consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
			consumeNewMsgRemote(t, listener2, chat1.MessageType_FLIP)
			res0 := consumeFlipToResult(t, ui0, listener0, gameID, numUsers)
			t.Logf("res0 (coin): %s", res0)
			require.True(t, res0 == "HEADS" || res0 == "TAILS")
			res1 := consumeFlipToResult(t, ui1, listener1, gameID, numUsers)
			require.Equal(t, res0, res1)
			res2 := consumeFlipToResult(t, ui2, listener2, gameID, numUsers)
			require.Equal(t, res0, res2)

			// limit
			expectedDevConvs++
			mustPostLocalForTest(t, ctc, users[0], conv,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "/flip 10",
				}))
			flipMsg = consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
			require.True(t, flipMsg.IsValid())
			require.NotNil(t, flipMsg.Valid().FlipGameID)
			gameID = *flipMsg.Valid().FlipGameID
			consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
			consumeNewMsgRemote(t, listener2, chat1.MessageType_FLIP)
			res0 = consumeFlipToResult(t, ui0, listener0, gameID, numUsers)
			found := false
			t.Logf("res0 (limit): %s", res0)
			for i := 1; i <= 10; i++ {
				if res0 == fmt.Sprintf("%d", i) {
					found = true
					break
				}
			}
			require.True(t, found)
			res1 = consumeFlipToResult(t, ui1, listener1, gameID, numUsers)
			require.Equal(t, res0, res1)
			res2 = consumeFlipToResult(t, ui2, listener2, gameID, numUsers)
			require.Equal(t, res0, res2)

			// range
			expectedDevConvs++
			mustPostLocalForTest(t, ctc, users[0], conv,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "/flip 10..15",
				}))
			flipMsg = consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
			require.True(t, flipMsg.IsValid())
			require.NotNil(t, flipMsg.Valid().FlipGameID)
			gameID = *flipMsg.Valid().FlipGameID
			consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
			consumeNewMsgRemote(t, listener2, chat1.MessageType_FLIP)
			res0 = consumeFlipToResult(t, ui0, listener0, gameID, numUsers)
			t.Logf("res0 (range): %s", res0)
			found = false
			for i := 10; i <= 15; i++ {
				if res0 == fmt.Sprintf("%d", i) {
					found = true
					break
				}
			}
			require.True(t, found)
			res1 = consumeFlipToResult(t, ui1, listener1, gameID, numUsers)
			require.Equal(t, res0, res1)
			res2 = consumeFlipToResult(t, ui2, listener2, gameID, numUsers)
			require.Equal(t, res0, res2)

			// shuffle
			ref := []string{"mike", "karen", "lisa", "sara", "anna"}
			refMap := make(map[string]bool)
			for _, r := range ref {
				refMap[r] = true
			}
			expectedDevConvs++
			mustPostLocalForTest(t, ctc, users[0], conv,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: fmt.Sprintf("/flip %s", strings.Join(ref, ",")),
				}))
			flipMsg = consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
			require.True(t, flipMsg.IsValid())
			require.NotNil(t, flipMsg.Valid().FlipGameID)
			gameID = *flipMsg.Valid().FlipGameID
			consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
			consumeNewMsgRemote(t, listener2, chat1.MessageType_FLIP)
			res0 = consumeFlipToResult(t, ui0, listener0, gameID, numUsers)
			t.Logf("res0 (shuffle): %s", res0)
			toks := strings.Split(res0, ",")
			for _, t := range toks {
				delete(refMap, strings.Trim(t, " "))
			}
			require.Zero(t, len(refMap))
			require.True(t, found)
			res1 = consumeFlipToResult(t, ui1, listener1, gameID, numUsers)
			require.Equal(t, res0, res1)
			res2 = consumeFlipToResult(t, ui2, listener2, gameID, numUsers)
			require.Equal(t, res0, res2)

			uid := users[0].User.GetUID().ToBytes()
			ttype := chat1.TopicType_DEV
			ctx := ctc.as(t, users[0]).startCtx
			ibox, _, err := ctc.as(t, users[0]).h.G().InboxSource.Read(ctx, uid,
				types.ConversationLocalizerBlocking, types.InboxSourceDataSourceAll, nil,
				&chat1.GetInboxLocalQuery{
					TopicType: &ttype,
				}, nil)
			require.NoError(t, err)
			numConvs := 0
			for _, conv := range ibox.Convs {
				if strings.HasPrefix(conv.Info.TopicName, gameIDTopicNamePrefix) {
					numConvs++
					require.Equal(t, policy, conv.ConvRetention)
				}
			}
			require.Equal(t, expectedDevConvs, numConvs)
		})
	})
}

func TestFlipManagerChannelFlip(t *testing.T) {
	// ensure only members of a channel are included in the flip
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}
		ctc := makeChatTestContext(t, "FlipManagerChannelFlip", 3)
		defer ctc.cleanup()

		users := ctc.users()
		flip.DefaultCommitmentWindowMsec = 500

		var ui0, ui1, ui2 *kbtest.ChatUI
		ui0 = kbtest.NewChatUI()
		ui1 = kbtest.NewChatUI()
		ui2 = kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui0
		ctc.as(t, users[1]).h.mockChatUI = ui1
		ctc.as(t, users[2]).h.mockChatUI = ui2
		ctc.world.Tcs[users[0].Username].G.UIRouter = &fakeUIRouter{ui: ui0}
		ctc.world.Tcs[users[1].Username].G.UIRouter = &fakeUIRouter{ui: ui1}
		ctc.world.Tcs[users[2].Username].G.UIRouter = &fakeUIRouter{ui: ui2}
		listener0 := newServerChatListener()
		listener1 := newServerChatListener()
		listener2 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
		ctc.as(t, users[2]).h.G().NotifyRouter.AddListener(listener2)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())
		consumeNewConversation(t, listener0, conv.Id)
		consumeNewConversation(t, listener1, conv.Id)
		consumeNewConversation(t, listener2, conv.Id)

		topicName := "channel-1"
		channel := mustCreateChannelForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			&topicName, mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_SYSTEM)

		mustJoinConversationByID(t, ctc, users[1], channel.Id)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		mustJoinConversationByID(t, ctc, users[2], channel.Id)
		_, err := ctc.as(t, users[2]).chatLocalHandler().LeaveConversationLocal(
			ctc.as(t, users[0]).startCtx, channel.Id)
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_LEAVE)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_LEAVE)

		mustPostLocalForTest(t, ctc, users[0], channel,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip",
			}))
		flipMsg := consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
		require.True(t, flipMsg.IsValid())
		require.NotNil(t, flipMsg.Valid().FlipGameID)
		gameID := *flipMsg.Valid().FlipGameID
		consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
		res0 := consumeFlipToResult(t, ui0, listener0, gameID, 2)
		require.True(t, res0 == "HEADS" || res0 == "TAILS")
		res1 := consumeFlipToResult(t, ui1, listener1, gameID, 2)
		require.Equal(t, res0, res1)
		assertNoFlip(t, ui2)
	})
}

func TestFlipManagerParseEdges(t *testing.T) {
	tc := externalstest.SetupTest(t, "flip", 0)
	defer tc.Cleanup()

	g := globals.NewContext(tc.G, &globals.ChatContext{})
	fm := NewFlipManager(g, nil)
	testCase := func(text string, ftyp flip.FlipType, refMetadata flipTextMetadata) {
		start, metadata := fm.startFromText(text, nil)
		ft, err := start.Params.T()
		require.NoError(t, err)
		require.Equal(t, ftyp, ft)
		require.Equal(t, refMetadata, metadata)
	}
	deck := "2♠️,3♠️,4♠️,5♠️,6♠️,7♠️,8♠️,9♠️,10♠️,J♠️,Q♠️,K♠️,A♠️,2♣️,3♣️,4♣️,5♣️,6♣️,7♣️,8♣️,9♣️,10♣️,J♣️,Q♣️,K♣️,A♣️,2♦️,3♦️,4♦️,5♦️,6♦️,7♦️,8♦️,9♦️,10♦️,J♦️,Q♦️,K♦️,A♦️,2♥️,3♥️,4♥️,5♥️,6♥️,7♥️,8♥️,9♥️,10♥️,J♥️,Q♥️,K♥️,A♥️"
	cards := strings.Split(deck, ",")
	testCase("/flip 10", flip.FlipType_BIG, flipTextMetadata{LowerBound: "1"})
	testCase("/flip 0", flip.FlipType_SHUFFLE, flipTextMetadata{ShuffleItems: []string{"0"}})
	testCase("/flip -1", flip.FlipType_SHUFFLE, flipTextMetadata{ShuffleItems: []string{"-1"}})
	testCase("/flip 1..5", flip.FlipType_BIG, flipTextMetadata{LowerBound: "1"})
	testCase("/flip -20..20", flip.FlipType_BIG, flipTextMetadata{LowerBound: "-20"})
	testCase("/flip -20..20,mike", flip.FlipType_SHUFFLE,
		flipTextMetadata{ShuffleItems: []string{"-20..20", "mike"}})
	testCase("/flip 1..1", flip.FlipType_BIG, flipTextMetadata{LowerBound: "1"})
	testCase("/flip 1..0", flip.FlipType_SHUFFLE, flipTextMetadata{ShuffleItems: []string{"1..0"}})
	testCase("/flip mike, karen,     jim", flip.FlipType_SHUFFLE,
		flipTextMetadata{ShuffleItems: []string{"mike", "karen", "jim"}})
	testCase("/flip mike,    jim bob    j  ,     jim", flip.FlipType_SHUFFLE,
		flipTextMetadata{ShuffleItems: []string{"mike", "jim bob    j", "jim"}})
	testCase("/flip 10...20", flip.FlipType_SHUFFLE, flipTextMetadata{ShuffleItems: []string{"10...20"}})
	testCase("/flip 1,0", flip.FlipType_SHUFFLE, flipTextMetadata{ShuffleItems: []string{"1", "0"}})
	testCase("/flip 1，0", flip.FlipType_SHUFFLE, flipTextMetadata{ShuffleItems: []string{"1", "0"}})
	testCase("/flip cards", flip.FlipType_SHUFFLE, flipTextMetadata{
		ShuffleItems: cards,
		DeckShuffle:  true,
	})
	testCase("/flip cards 5 mikem, joshblum, chris", flip.FlipType_SHUFFLE, flipTextMetadata{
		ShuffleItems:  cards,
		DeckShuffle:   false,
		HandCardCount: 5,
		HandTargets:   []string{"mikem", "joshblum", "chris"},
	})
	testCase("/flip cards 5 mike maxim, lisa maxim, anna ", flip.FlipType_SHUFFLE, flipTextMetadata{
		ShuffleItems:  cards,
		DeckShuffle:   false,
		HandCardCount: 5,
		HandTargets:   []string{"mike maxim", "lisa maxim", "anna"},
	})
	testCase("/flip cards 5     mikem,  ,  ,       joshblum,        chris", flip.FlipType_SHUFFLE,
		flipTextMetadata{
			ShuffleItems:  cards,
			DeckShuffle:   false,
			HandCardCount: 5,
			HandTargets:   []string{"mikem", "joshblum", "chris"},
		})
	testCase("/flip cards 5", flip.FlipType_SHUFFLE, flipTextMetadata{
		ShuffleItems: cards,
		DeckShuffle:  true,
	})
	testCase("/flip cards -5 chris mike", flip.FlipType_SHUFFLE, flipTextMetadata{
		ShuffleItems: cards,
		DeckShuffle:  true,
	})
}

func TestFlipManagerLoadFlip(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "FlipManager", 2)
		defer ctc.cleanup()

		users := ctc.users()
		ui0 := kbtest.NewChatUI()
		ui1 := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui0
		ctc.as(t, users[1]).h.mockChatUI = ui1
		ctc.world.Tcs[users[0].Username].G.UIRouter = &fakeUIRouter{ui: ui0}
		ctc.world.Tcs[users[1].Username].G.UIRouter = &fakeUIRouter{ui: ui1}
		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		listener0 := newServerChatListener()
		listener1 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
		flip.DefaultCommitmentWindowMsec = 500
		timeout := 20 * time.Second
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip",
			}))
		flipMsg := consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
		require.True(t, flipMsg.IsValid())
		require.NotNil(t, flipMsg.Valid().FlipGameID)
		strGameID := *flipMsg.Valid().FlipGameID
		consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
		res := consumeFlipToResult(t, ui0, listener0, strGameID, 2)
		require.True(t, res == "HEADS" || res == "TAILS")
		res1 := consumeFlipToResult(t, ui1, listener1, strGameID, 2)
		require.Equal(t, res, res1)

		hostMsg, err := GetMessage(ctx, tc.Context(), uid, conv.Id, 2, true, nil)
		require.NoError(t, err)
		require.True(t, hostMsg.IsValid())
		body := hostMsg.Valid().MessageBody
		require.True(t, body.IsType(chat1.MessageType_FLIP))
		gameID := body.Flip().GameID

		testLoadFlip := func() {
			tc.Context().CoinFlipManager.LoadFlip(ctx, uid, conv.Id, hostMsg.GetMessageID(),
				body.Flip().FlipConvID, gameID)
			select {
			case updates := <-ui0.CoinFlipUpdates:
				require.Equal(t, 1, len(updates))
				require.Equal(t, chat1.UICoinFlipPhase_COMPLETE, updates[0].Phase)
				require.Equal(t, res, updates[0].ResultText)
			case <-time.After(timeout):
				require.Fail(t, "no updates")
			}
		}
		testLoadFlip()
		tc.Context().ConvSource.Clear(ctx, conv.Id, uid)
		tc.Context().CoinFlipManager.(*FlipManager).clearGameCache()
		testLoadFlip()
	})
}

func TestFlipManagerRateLimit(t *testing.T) {
	t.Skip()
	ctc := makeChatTestContext(t, "TestFlipManagerRateLimit", 2)
	defer ctc.cleanup()
	users := ctc.users()
	useRemoteMock = false
	defer func() { useRemoteMock = true }()

	ui0 := kbtest.NewChatUI()
	ui1 := kbtest.NewChatUI()
	ctc.as(t, users[0]).h.mockChatUI = ui0
	ctc.as(t, users[1]).h.mockChatUI = ui1
	ctc.world.Tcs[users[0].Username].G.UIRouter = &fakeUIRouter{ui: ui0}
	ctc.world.Tcs[users[1].Username].G.UIRouter = &fakeUIRouter{ui: ui1}
	listener0 := newServerChatListener()
	listener1 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
	ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
	flip.DefaultCommitmentWindowMsec = 500
	tc := ctc.world.Tcs[users[0].Username]
	tc1 := ctc.world.Tcs[users[1].Username]
	clock := clockwork.NewFakeClock()
	flipmgr := tc.Context().CoinFlipManager.(*FlipManager)
	flipmgr1 := tc1.Context().CoinFlipManager.(*FlipManager)
	flipmgr.clock = clock
	flipmgr1.clock = clock
	flipmgr.testingServerClock = clock
	flipmgr1.testingServerClock = clock
	flipmgr.maxConvParticipations = 1
	<-flipmgr.Stop(context.TODO())
	<-flipmgr1.Stop(context.TODO())
	flipmgr.Start(context.TODO(), gregor1.UID(users[0].GetUID().ToBytes()))
	flipmgr1.Start(context.TODO(), gregor1.UID(users[1].GetUID().ToBytes()))
	simRealClock := func(stopCh chan struct{}) {
		t := time.NewTicker(100 * time.Millisecond)
		for {
			select {
			case <-t.C:
				clock.Advance(100 * time.Millisecond)
			case <-stopCh:
				return
			}
		}
	}
	t.Logf("uid0: %s", users[0].GetUID())
	t.Logf("uid1: %s", users[1].GetUID())

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, ctc.as(t, users[1]).user())
	mustPostLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "/flip",
		}))
	flipMsg := consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
	require.True(t, flipMsg.IsValid())
	require.NotNil(t, flipMsg.Valid().FlipGameID)
	gameID := *flipMsg.Valid().FlipGameID
	t.Logf("gameID: %s", gameID)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
	stopCh := make(chan struct{})
	go simRealClock(stopCh)
	res := consumeFlipToResult(t, ui0, listener0, gameID, 2)
	require.True(t, res == "HEADS" || res == "TAILS")
	res1 := consumeFlipToResult(t, ui1, listener1, gameID, 2)
	require.Equal(t, res, res1)
	close(stopCh)

	clock.Advance(time.Minute)
	mustPostLocalForTest(t, ctc, users[1], conv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "/flip",
		}))
	select {
	case <-ui0.CoinFlipUpdates:
		require.Fail(t, "no update for 0")
	default:
	}
	flipMsg = consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
	require.True(t, flipMsg.IsValid())
	require.NotNil(t, flipMsg.Valid().FlipGameID)
	gameID = *flipMsg.Valid().FlipGameID
	t.Logf("gameID: %s", gameID)
	stopCh = make(chan struct{})
	go simRealClock(stopCh)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP) // get host msg
	res = consumeFlipToResult(t, ui1, listener1, gameID, 1)
	require.True(t, res == "HEADS" || res == "TAILS")
	close(stopCh)

	clock.Advance(10 * time.Minute)
	mustPostLocalForTest(t, ctc, users[1], conv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "/flip",
		}))
	flipMsg = consumeNewMsgRemote(t, listener0, chat1.MessageType_FLIP)
	require.True(t, flipMsg.IsValid())
	require.NotNil(t, flipMsg.Valid().FlipGameID)
	gameID = *flipMsg.Valid().FlipGameID
	t.Logf("gameID: %s", gameID)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_FLIP)
	stopCh = make(chan struct{})
	go simRealClock(stopCh)
	res = consumeFlipToResult(t, ui0, listener0, gameID, 2)
	require.True(t, res == "HEADS" || res == "TAILS")
	res1 = consumeFlipToResult(t, ui1, listener1, gameID, 2)
	require.Equal(t, res, res1)
	close(stopCh)

}
