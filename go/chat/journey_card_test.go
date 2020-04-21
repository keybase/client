package chat

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"

	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestJourneycardStorage(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, t.Name(), 1)
	defer ctc.cleanup()

	users := ctc.users()
	tc0 := ctc.world.Tcs[users[0].Username]
	ctx0 := ctc.as(t, users[0]).startCtx
	uid0 := gregor1.UID(users[0].GetUID().ToBytes())
	t.Logf("uid0: %s", uid0)

	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	t.Logf("teamconv: %x", teamConv.Id.DbShortForm())
	teamID, err := keybase1.TeamIDFromString(teamConv.Triple.Tlfid.String())
	require.NoError(t, err)
	convID := teamConv.Id

	t.Logf("setup complete")
	tc0.ChatG.JourneyCardManager.SentMessage(ctx0, uid0, teamID, convID)
	t.Logf("sent message")
	js, err := tc0.ChatG.JourneyCardManager.(*JourneyCardManager).get(ctx0, uid0)
	require.NoError(t, err)
	jcd, err := js.getTeamData(ctx0, teamID)
	require.NoError(t, err)
	require.True(t, jcd.Convs[convID.ConvIDStr()].SentMessage)

	t.Logf("switch users")
	uid2kb, err := keybase1.UIDFromString("295a7eea607af32040647123732bc819")
	require.NoError(t, err)
	uid2 := gregor1.UID(uid2kb.ToBytes())
	js, err = tc0.ChatG.JourneyCardManager.(*JourneyCardManager).get(ctx0, uid2)
	require.NoError(t, err)
	jcd, err = js.getTeamData(ctx0, teamID)
	require.NoError(t, err)
	require.False(t, jcd.Convs[convID.ConvIDStr()].SentMessage)

	t.Logf("switch back")
	js, err = tc0.ChatG.JourneyCardManager.(*JourneyCardManager).get(ctx0, uid0)
	require.NoError(t, err)
	jcd, err = js.getTeamData(ctx0, teamID)
	require.NoError(t, err)
	require.True(t, jcd.Convs[convID.ConvIDStr()].SentMessage)
}

func TestJourneycardDismiss(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, t.Name(), 2)
	defer ctc.cleanup()

	users := ctc.users()
	tc0 := ctc.world.Tcs[users[0].Username]
	ctx0 := ctc.as(t, users[0]).startCtx
	uid0 := gregor1.UID(users[0].GetUID().ToBytes())
	t.Logf("uid0: %s", uid0)
	tc1 := ctc.world.Tcs[users[1].Username]
	ctx1 := ctc.as(t, users[1]).startCtx
	uid1 := gregor1.UID(users[1].GetUID().ToBytes())
	_ = tc1
	_ = ctx1
	t.Logf("uid1: %s", uid1)

	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	t.Logf("teamconv: %x", teamConv.Id.DbShortForm())
	teamID, err := keybase1.TeamIDFromString(teamConv.Triple.Tlfid.String())
	require.NoError(t, err)
	convID := teamConv.Id

	_, err = teams.AddMemberByID(ctx0, tc0.G, teamID, users[1].Username, keybase1.TeamRole_OWNER, nil, nil /* emailInviteMsg */)
	require.NoError(t, err)

	// In real app usage a SYSTEM message is sent to a team on creation. That doesn't seem to happen in this test jig.
	// Journeycard needs a message to glom onto. Send a TEXT message pretending to be the would-be system message.
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "Where there's life there's hope, and need of vittles.",
	}))
	ui := kbtest.NewChatUI()
	ctc.as(t, users[1]).h.mockChatUI = ui
	_, err = ctc.as(t, users[1]).chatLocalHandler().GetThreadNonblock(ctx1,
		chat1.GetThreadNonblockArg{
			ConversationID:   teamConv.Id,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		},
	)
	require.NoError(t, err)

	requireJourneycard := func(toExist bool) {
		thread, err := tc1.ChatG.ConvSource.Pull(ctx1, convID, uid1,
			chat1.GetThreadReason_GENERAL, nil, nil, nil)
		require.NoError(t, err)
		t.Logf("the messages: %v", chat1.MessageUnboxedDebugList(thread.Messages))
		require.True(t, len(thread.Messages) >= 1)
		if toExist {
			require.NotNil(t, thread.Messages[0].Journeycard__)
		} else {
			for _, msg := range thread.Messages {
				require.Nil(t, msg.Journeycard__)
			}
		}
	}

	requireJourneycard(true)
	t.Logf("dismiss arbitrary other type that does not appear")
	err = ctc.as(t, users[1]).chatLocalHandler().DismissJourneycard(ctx1, chat1.DismissJourneycardArg{ConvID: convID, CardType: chat1.JourneycardType_ADD_PEOPLE})
	require.NoError(t, err)
	requireJourneycard(true)
	t.Logf("dismiss welcome card")
	err = ctc.as(t, users[1]).chatLocalHandler().DismissJourneycard(ctx1, chat1.DismissJourneycardArg{ConvID: convID, CardType: chat1.JourneycardType_WELCOME})
	require.NoError(t, err)
	requireJourneycard(false)
}

// Test that dismissing a CHANNEL_INACTIVE in one conv actually dismisses
// CHANNEL_INACTIVE in all convs in he team.
func TestJourneycardDismissTeamwide(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, t.Name(), 2)
	defer ctc.cleanup()

	users := ctc.users()
	tc0 := ctc.world.Tcs[users[0].Username]
	ctx0 := ctc.as(t, users[0]).startCtx
	uid0 := gregor1.UID(users[0].GetUID().ToBytes())
	t.Logf("uid0: %s", uid0)
	tc1 := ctc.world.Tcs[users[1].Username]
	ctx1 := ctc.as(t, users[1]).startCtx
	uid1 := gregor1.UID(users[1].GetUID().ToBytes())
	_ = tc1
	_ = ctx1
	t.Logf("uid1: %s", uid1)

	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	t.Logf("teamconv: %x", teamConv.Id.DbShortForm())
	teamID, err := keybase1.TeamIDFromString(teamConv.Triple.Tlfid.String())
	_ = teamID
	require.NoError(t, err)

	t.Logf("[User u1] create other channels to make POPULAR_CHANNELS eligible for User u0")
	topicNames := []string{"c-a", "c-b", "c-c"}
	allConvIDs := []chat1.ConversationID{teamConv.Id}
	_ = allConvIDs
	allConvInfos := []chat1.ConversationInfoLocal{teamConv}
	for _, topicName := range topicNames {
		res, err := ctc.as(t, users[1]).chatLocalHandler().NewConversationLocal(ctx1,
			chat1.NewConversationLocalArg{
				TlfName:       teamConv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		allConvIDs = append(allConvIDs, res.Conv.GetConvID())
		allConvInfos = append(allConvInfos, res.Conv.Info)
	}

	// [User u0] Send a message to make POPULAR_CHANNELS eligible later by SentMessage.
	// [User u1] Send a text message for cards to glom onto.
	for i, convInfo := range allConvInfos {
		var whichUser int
		if i > 0 {
			whichUser = 1
		}
		mustPostLocalForTest(t, ctc, users[whichUser], convInfo, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "Fruit flies like a banana.",
		}))
	}

	requireNoJourneycard := func(convID chat1.ConversationID) {
		thread, err := tc0.ChatG.ConvSource.Pull(ctx0, convID, uid0,
			chat1.GetThreadReason_GENERAL, nil, nil, nil)
		require.NoError(t, err)
		t.Logf("the messages: %v", chat1.MessageUnboxedDebugList(thread.Messages))
		require.True(t, len(thread.Messages) >= 1)
		for _, msg := range thread.Messages {
			require.Nil(t, msg.Journeycard__)
		}
	}

	requireJourneycard := func(convID chat1.ConversationID, cardType chat1.JourneycardType) {
		thread, err := tc0.ChatG.ConvSource.Pull(ctx0, convID, uid0,
			chat1.GetThreadReason_GENERAL, nil, nil, nil)
		require.NoError(t, err)
		t.Logf("the messages: %v", chat1.MessageUnboxedDebugList(thread.Messages))
		require.True(t, len(thread.Messages) >= 1)
		msg := thread.Messages[0]
		require.NotNil(t, msg.Journeycard__, "requireJourneycard expects a journeycard")
		require.Equal(t, cardType, msg.Journeycard().CardType, "card type")
	}

	// Wait for journeycardmanager to find out about the team. Calls to SentMessage happen
	// in background goroutines. So sometimes on CI this must be waited for.
	pollFor(t, "hasTeam", 10*time.Second, func(_ int) bool {
		jcm, err := tc0.ChatG.JourneyCardManager.(*JourneyCardManager).get(ctx0, uid0)
		require.NoError(t, err)
		found, nConvs, err := jcm.hasTeam(ctx0, teamID)
		require.NoError(t, err)
		return found && nConvs >= 1
	})

	requireJourneycard(allConvIDs[0], chat1.JourneycardType_POPULAR_CHANNELS)
	t.Logf("POPULAR_CHANNELS appears only in #general")
	for _, convID := range allConvIDs[1:] {
		requireNoJourneycard(convID)
	}

	t.Logf("Dismiss POPULAR_CHANNELS")
	err = ctc.as(t, users[0]).chatLocalHandler().DismissJourneycard(ctx0, chat1.DismissJourneycardArg{ConvID: allConvIDs[0], CardType: chat1.JourneycardType_POPULAR_CHANNELS})
	require.NoError(t, err)
	for _, convID := range allConvIDs {
		requireNoJourneycard(convID)
	}

	t.Logf("Join all conversations")
	for i := 1; i < len(allConvIDs); i++ {
		_, err := ctc.as(t, users[0]).chatLocalHandler().JoinConversationLocal(ctx0, chat1.JoinConversationLocalArg{
			TlfName:    allConvInfos[i].TLFNameExpanded(),
			TopicType:  chat1.TopicType_CHAT,
			Visibility: keybase1.TLFVisibility_PRIVATE,
			TopicName:  allConvInfos[i].TopicName,
		})
		require.NoError(t, err)
	}

	t.Logf("Advanced time forward enough for CHANNEL_INACTIVE to be eligible")
	nTeams, nConvs, err := tc0.ChatG.JourneyCardManager.(*JourneyCardManager).TimeTravel(ctx0, uid0, time.Hour*24*40+1)
	require.NoError(t, err)
	require.GreaterOrEqual(t, nTeams, 1, "expected known teams to time travel")
	require.GreaterOrEqual(t, nConvs, 1, "expected known convs to time travel")
	for _, convID := range allConvIDs {
		requireJourneycard(convID, chat1.JourneycardType_CHANNEL_INACTIVE)
	}

	t.Logf("Dismiss CHANNEL_INACTIVE")
	err = ctc.as(t, users[0]).chatLocalHandler().DismissJourneycard(ctx0, chat1.DismissJourneycardArg{ConvID: allConvIDs[0], CardType: chat1.JourneycardType_CHANNEL_INACTIVE})
	require.NoError(t, err)
	for _, convID := range allConvIDs {
		requireNoJourneycard(convID)
	}
}

// A journeycard sticks in its position in the conv.
// And survives a reboot.
func TestJourneycardPersist(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, t.Name(), 2)
	defer ctc.cleanup()

	users := ctc.users()
	tc0 := ctc.world.Tcs[users[0].Username]
	ctx0 := ctc.as(t, users[0]).startCtx
	uid0 := gregor1.UID(users[0].GetUID().ToBytes())
	t.Logf("uid0: %s", uid0)

	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	t.Logf("teamconv: %x", teamConv.Id.DbShortForm())
	teamID, err := keybase1.TeamIDFromString(teamConv.Triple.Tlfid.String())
	_ = teamID
	require.NoError(t, err)

	// Send a text message for cards to glom onto.
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "Henry [Thoreau]’s annual melon party, featuring his own delicious watermelons, was a popular event among his neighbors.",
	}))

	requireJourneycard := func(convID chat1.ConversationID, cardType chat1.JourneycardType, skipMessages int) chat1.MessageUnboxedJourneycard {
		thread, err := tc0.ChatG.ConvSource.Pull(ctx0, convID, uid0,
			chat1.GetThreadReason_GENERAL, nil, nil, nil)
		require.NoError(t, err)
		t.Logf("the messages: %v", chat1.MessageUnboxedDebugList(thread.Messages))
		require.True(t, len(thread.Messages) >= 1+skipMessages)
		msg := thread.Messages[skipMessages]
		require.NotNil(t, msg.Journeycard__, "requireJourneycard expects a journeycard")
		require.Equal(t, cardType, msg.Journeycard().CardType, "card type")
		return msg.Journeycard()
	}

	// Wait for journeycardmanager to find out about the team. Calls to SentMessage happen
	// in background goroutines. So sometimes on CI this must be waited for.
	pollFor(t, "hasTeam", 10*time.Second, func(_ int) bool {
		jcm, err := tc0.ChatG.JourneyCardManager.(*JourneyCardManager).get(ctx0, uid0)
		require.NoError(t, err)
		found, nConvs, err := jcm.hasTeam(ctx0, teamID)
		require.NoError(t, err)
		return found && nConvs >= 1
	})

	t.Logf("Advanced time forward enough for ADD_PEOPLE to be eligible")
	nTeams, nConvs, err := tc0.ChatG.JourneyCardManager.(*JourneyCardManager).TimeTravel(ctx0, uid0, time.Hour*24*4+1)
	require.NoError(t, err)
	require.GreaterOrEqual(t, nTeams, 1, "expected known teams to time travel")
	require.GreaterOrEqual(t, nConvs, 1, "expected known convs to time travel")
	jc1 := requireJourneycard(teamConv.Id, chat1.JourneycardType_ADD_PEOPLE, 0)

	t.Logf("After sending another message the journeycard stays in its original location (ordinal)")
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "Henry does not pretend to be totally isolated, but tells his readers from the start that he was only half a mile (0.8 kilometers) from the railroad station and a fifth of a mile (300 meters) to the main road to Concord.",
	}))
	jc2 := requireJourneycard(teamConv.Id, chat1.JourneycardType_ADD_PEOPLE, 1)
	require.Equal(t, jc1.PrevID, jc2.PrevID)
	require.Equal(t, jc1.Ordinal, jc2.Ordinal)

	t.Logf("After deleting in-memory cache the journeycard statys in its original location")
	js, err := tc0.ChatG.JourneyCardManager.(*JourneyCardManager).get(ctx0, uid0)
	require.NoError(t, err)
	js.lru.Purge()
	jc3 := requireJourneycard(teamConv.Id, chat1.JourneycardType_ADD_PEOPLE, 1)
	require.Equal(t, jc1.PrevID, jc3.PrevID)
	require.Equal(t, jc1.Ordinal, jc3.Ordinal)
}

func pollFor(t *testing.T, label string, totalTime time.Duration, poller func(i int) bool) {
	t.Logf("pollFor '%s'", label)
	clock := clockwork.NewRealClock()
	start := clock.Now()
	endCh := clock.After(totalTime)
	wait := 10 * time.Millisecond
	var i int
	for {
		satisfied := poller(i)
		since := clock.Since(start)
		t.Logf("pollFor '%s' round:%v -> %v running:%v", label, i, satisfied, since)
		if satisfied {
			t.Logf("pollFor '%s' succeeded after %v attempts over %v", label, i, since)
			return
		}
		if since > totalTime {
			// Game over
			msg := fmt.Sprintf("pollFor '%s' timed out after %v attempts over %v", label, i, since)
			t.Logf(msg)
			require.Fail(t, msg)
			require.FailNow(t, msg)
			return
		}
		t.Logf("pollFor '%s' wait:%v", label, wait)
		select {
		case <-endCh:
		case <-clock.After(wait):
		}
		wait *= 2
		i++
	}
}
