package chat

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/flip"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func consumeFlipToResult(t *testing.T, ui *kbtest.ChatUI, numUsers int) string {
	timeout := 20 * time.Second
	for {
		select {
		case updates := <-ui.CoinFlipUpdates:
			require.Equal(t, 1, len(updates))
			if updates[0].Phase == chat1.UICoinFlipPhase_COMPLETE {
				require.Equal(t, numUsers, len(updates[0].Participants))
				return updates[0].ResultText
			}
		case <-time.After(timeout):
			require.Fail(t, "no complete")
		}
	}
}

func TestFlipManagerStartFlip(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "FlipManager", 3)
		defer ctc.cleanup()

		users := ctc.users()
		ui0 := kbtest.NewChatUI()
		ui1 := kbtest.NewChatUI()
		ui2 := kbtest.NewChatUI()
		numUsers := 3
		flip.DefaultCommitmentWindowMsec = 500

		ctc.as(t, users[0]).h.mockChatUI = ui0
		ctc.as(t, users[1]).h.mockChatUI = ui1
		ctc.as(t, users[2]).h.mockChatUI = ui2
		ctc.world.Tcs[users[0].Username].G.UIRouter = &fakeUIRouter{ui: ui0}
		ctc.world.Tcs[users[1].Username].G.UIRouter = &fakeUIRouter{ui: ui1}
		ctc.world.Tcs[users[2].Username].G.UIRouter = &fakeUIRouter{ui: ui2}

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())

		// bool
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip",
			}))
		res0 := consumeFlipToResult(t, ui0, numUsers)
		require.True(t, res0 == "HEADS" || res0 == "TAILS")
		res1 := consumeFlipToResult(t, ui1, numUsers)
		require.Equal(t, res0, res1)
		res2 := consumeFlipToResult(t, ui2, numUsers)
		require.Equal(t, res0, res2)

		// limit
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip 10",
			}))
		res0 = consumeFlipToResult(t, ui0, numUsers)
		found := false
		for i := 1; i <= 10; i++ {
			if res0 == fmt.Sprintf("%d", i) {
				found = true
				break
			}
		}
		require.True(t, found)
		res1 = consumeFlipToResult(t, ui1, numUsers)
		require.Equal(t, res0, res1)
		res2 = consumeFlipToResult(t, ui2, numUsers)
		require.Equal(t, res0, res2)

		// range
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip 10-15",
			}))
		res0 = consumeFlipToResult(t, ui0, numUsers)
		found = false
		for i := 10; i <= 15; i++ {
			if res0 == fmt.Sprintf("%d", i) {
				found = true
				break
			}
		}
		require.True(t, found)
		res1 = consumeFlipToResult(t, ui1, numUsers)
		require.Equal(t, res0, res1)
		res2 = consumeFlipToResult(t, ui2, numUsers)
		require.Equal(t, res0, res2)

		// shuffle
		ref := []string{"mike", "karen", "lisa", "sara", "anna"}
		refMap := make(map[string]bool)
		for _, r := range ref {
			refMap[r] = true
		}
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: fmt.Sprintf("/flip %s", strings.Join(ref, ",")),
			}))
		res0 = consumeFlipToResult(t, ui0, numUsers)
		toks := strings.Split(res0, ",")
		for _, t := range toks {
			delete(refMap, t)
		}
		require.Zero(t, len(refMap))
		require.True(t, found)
		res1 = consumeFlipToResult(t, ui1, numUsers)
		require.Equal(t, res0, res1)
		res2 = consumeFlipToResult(t, ui2, numUsers)
		require.Equal(t, res0, res2)
	})
}

func TestFlipManagerParseEdges(t *testing.T) {
	tc := externalstest.SetupTest(t, "flip", 0)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	fm := NewFlipManager(g, nil)
	testCase := func(text string, ftyp flip.FlipType, lowerBound string, shuffleItems []string) {
		start, lb, si := fm.startFromText(text)
		ft, err := start.Params.T()
		require.NoError(t, err)
		require.Equal(t, ftyp, ft)
		require.Equal(t, lowerBound, lb)
		require.Equal(t, shuffleItems, si)
	}
	testCase("/flip 10", flip.FlipType_BIG, "1", nil)
	testCase("/flip 0", flip.FlipType_SHUFFLE, "", []string{"0"})
	testCase("/flip -1", flip.FlipType_SHUFFLE, "", []string{"-1"})
	testCase("/flip 1-5", flip.FlipType_BIG, "1", nil)
	testCase("/flip 1-1", flip.FlipType_BIG, "1", nil)
	testCase("/flip 1-0", flip.FlipType_SHUFFLE, "", []string{"1-0"})
	testCase("/flip mike, karen,     jim", flip.FlipType_SHUFFLE, "", []string{"mike", "karen", "jim"})
	testCase("/flip mike,    jim bob    j  ,     jim", flip.FlipType_SHUFFLE, "",
		[]string{"mike", "jim bob    j", "jim"})
	testCase("/flip 10...20", flip.FlipType_SHUFFLE, "", []string{"10...20"})
	testCase("/flip 1,0", flip.FlipType_SHUFFLE, "", []string{"1", "0"})
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
		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
		flip.DefaultCommitmentWindowMsec = 500
		timeout := 20 * time.Second
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip",
			}))
		consumeNewMsgRemote(t, listener, chat1.MessageType_FLIP)
		res := consumeFlipToResult(t, ui0, 2)
		require.True(t, res == "HEADS" || res == "TAILS")
		res1 := consumeFlipToResult(t, ui1, 2)
		require.Equal(t, res, res1)

		hostMsg, err := GetMessage(ctx, tc.Context(), uid, conv.Id, 2, true, nil)
		require.NoError(t, err)
		require.True(t, hostMsg.IsValid())
		body := hostMsg.Valid().MessageBody
		require.True(t, body.IsType(chat1.MessageType_FLIP))
		gameID := body.Flip().GameID

		testLoadFlip := func() {
			tc.Context().CoinFlipManager.LoadFlip(ctx, uid, conv.Id, gameID)
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
