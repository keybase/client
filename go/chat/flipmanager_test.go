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

func TestFlipManagerStartFlip(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "FlipManager", 3)
		defer ctc.cleanup()

		users := ctc.users()
		//uid := users[0].User.GetUID().ToBytes()
		//tc := ctc.world.Tcs[users[0].Username]
		//ctx := ctc.as(t, users[0]).startCtx
		ui0 := kbtest.NewChatUI()
		ui1 := kbtest.NewChatUI()
		ui2 := kbtest.NewChatUI()
		timeout := 10 * time.Second

		ctc.as(t, users[0]).h.mockChatUI = ui0
		ctc.as(t, users[1]).h.mockChatUI = ui1
		ctc.as(t, users[2]).h.mockChatUI = ui2
		ctc.world.Tcs[users[0].Username].G.UIRouter = &fakeUIRouter{ui: ui0}
		ctc.world.Tcs[users[1].Username].G.UIRouter = &fakeUIRouter{ui: ui1}
		ctc.world.Tcs[users[2].Username].G.UIRouter = &fakeUIRouter{ui: ui2}
		consumeToResult := func(ui *kbtest.ChatUI) string {
			for {
				select {
				case updates := <-ui.CoinFlipUpdates:
					require.Equal(t, 1, len(updates))
					if updates[0].Phase == chat1.UICoinFlipPhase_COMPLETE {
						require.Equal(t, 3, len(updates[0].Participants))
						return updates[0].ResultText
					}
				case <-time.After(timeout):
					require.Fail(t, "no complete")
				}
			}
		}

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())

		// bool
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip",
			}))
		res0 := consumeToResult(ui0)
		require.True(t, res0 == "HEADS" || res0 == "TAILS")
		res1 := consumeToResult(ui1)
		require.Equal(t, res0, res1)
		res2 := consumeToResult(ui2)
		require.Equal(t, res0, res2)

		// limit
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip 10",
			}))
		res0 = consumeToResult(ui0)
		found := false
		for i := 0; i < 10; i++ {
			if res0 == fmt.Sprintf("%d", i) {
				found = true
				break
			}
		}
		require.True(t, found)
		res1 = consumeToResult(ui1)
		require.Equal(t, res0, res1)
		res2 = consumeToResult(ui2)
		require.Equal(t, res0, res2)

		// range
		mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/flip 10-15",
			}))
		res0 = consumeToResult(ui0)
		found = false
		for i := 10; i <= 15; i++ {
			if res0 == fmt.Sprintf("%d", i) {
				found = true
				break
			}
		}
		require.True(t, found)
		res1 = consumeToResult(ui1)
		require.Equal(t, res0, res1)
		res2 = consumeToResult(ui2)
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
		res0 = consumeToResult(ui0)
		toks := strings.Split(res0, ",")
		for _, t := range toks {
			delete(refMap, t)
		}
		require.Zero(t, len(refMap))
		require.True(t, found)
		res1 = consumeToResult(ui1)
		require.Equal(t, res0, res1)
		res2 = consumeToResult(ui2)
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
	testCase("/flip 10", flip.FlipType_BIG, "0", nil)
	testCase("/flip 0", flip.FlipType_SHUFFLE, "", []string{"0"})
	testCase("/flip -1", flip.FlipType_SHUFFLE, "", []string{"-1"})
	testCase("/flip 1-5", flip.FlipType_BIG, "1", nil)
	testCase("/flip 1-1", flip.FlipType_BIG, "1", nil)
	testCase("/flip 1-0", flip.FlipType_SHUFFLE, "", []string{"1-0"})
}
