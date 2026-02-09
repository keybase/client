package chat

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestUIInboxLoaderLayout(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIInboxLoaderLayout", 3)
	defer ctc.cleanup()
	timeout := 2 * time.Second

	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	tc.ChatG.UIInboxLoader = NewUIInboxLoader(tc.Context())
	tc.ChatG.UIInboxLoader.Start(ctx, uid)
	defer func() { <-tc.ChatG.UIInboxLoader.Stop(ctx) }()
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).testingLayoutForceMode = true
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).batchDelay = time.Hour
	recvLayout := func() chat1.UIInboxLayout {
		select {
		case layout := <-chatUI.InboxLayoutCb:
			return layout
		case <-time.After(timeout):
			require.Fail(t, "no layout received")
		}
		return chat1.UIInboxLayout{}
	}
	consumeAllLayout := func() chat1.UIInboxLayout {
		var layout chat1.UIInboxLayout
		for {
			select {
			case layout = <-chatUI.InboxLayoutCb:
			case <-time.After(timeout):
				return layout
			}
		}
	}

	var layout chat1.UIInboxLayout
	t.Logf("basic")
	conv1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 1, len(layout.SmallTeams))
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	}
	conv2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[2])
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 2, len(layout.SmallTeams))
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	}
	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}

	// no layout is expected here, since the conv is in the layout (since we created it)
	t.Logf("resmsgID: %d",
		mustPostLocalForTest(t, ctc, users[0], conv2, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HI",
		})))
	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}
	mustPostLocalForTest(t, ctc, users[0], conv1, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	// just one here, since the local update gets this into the top slot (we might get a second, so wait
	// for it a bit (there is a race between the layout sending up to UI, and remote notification coming
	// in)
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	select {
	case layout = <-chatUI.InboxLayoutCb:
		require.Equal(t, 2, len(layout.SmallTeams))
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	case <-time.After(timeout):
		// just don't care if we don't get anything
	}

	// just one here, since we are now on msg ID 3
	t.Logf("resmsgID: %d",
		mustPostLocalForTest(t, ctc, users[0], conv2, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HI",
		})))
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	select {
	case layout = <-chatUI.InboxLayoutCb:
		require.Equal(t, 2, len(layout.SmallTeams))
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	case <-time.After(timeout):
		// just don't care if we don't get anything
	}
	_, err := ctc.as(t, users[0]).chatLocalHandler().SetConversationStatusLocal(ctx,
		chat1.SetConversationStatusLocalArg{
			ConversationID: conv1.Id,
			Status:         chat1.ConversationStatus_IGNORED,
		})
	require.NoError(t, err)
	// get two here
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 1, len(layout.SmallTeams))
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	}
	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}

	t.Logf("big teams")
	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1], users[2])
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, teamConv.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.True(t, layout.SmallTeams[0].IsTeam)
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	topicName := "mike"
	channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
		chat1.NewConversationLocalArg{
			TlfName:       teamConv.TlfName,
			TopicName:     &topicName,
			TopicType:     chat1.TopicType_CHAT,
			TlfVisibility: keybase1.TLFVisibility_PRIVATE,
			MembersType:   chat1.ConversationMembersType_TEAM,
		})
	require.NoError(t, err)

	layout = consumeAllLayout()
	dat, _ := json.Marshal(layout)
	t.Logf("LAYOUT: %s", string(dat))
	require.Equal(t, 1, len(layout.SmallTeams))
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.Equal(t, 3, len(layout.BigTeams))
	st, err := layout.BigTeams[0].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_LABEL, st)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[0].Label().Name)
	require.Equal(t, teamConv.Triple.Tlfid.TLFIDStr(), layout.BigTeams[0].Label().Id)
	st, err = layout.BigTeams[1].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, teamConv.Id.ConvIDStr(), layout.BigTeams[1].Channel().ConvID)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[1].Channel().Teamname)
	st, err = layout.BigTeams[2].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, channel.Conv.GetConvID().ConvIDStr(), layout.BigTeams[2].Channel().ConvID)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[2].Channel().Teamname)
	require.Equal(t, topicName, layout.BigTeams[2].Channel().Channelname)
}

func TestUIInboxLoaderReselect(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIInboxLoaderReselect", 2)
	defer ctc.cleanup()
	timeout := 2 * time.Second

	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	tc.ChatG.UIInboxLoader = NewUIInboxLoader(tc.Context())
	tc.ChatG.UIInboxLoader.Start(ctx, uid)
	defer func() { <-tc.ChatG.UIInboxLoader.Stop(ctx) }()
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).testingLayoutForceMode = true
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).batchDelay = time.Hour

	recvLayout := func() chat1.UIInboxLayout {
		select {
		case layout := <-chatUI.InboxLayoutCb:
			return layout
		case <-time.After(timeout):
			require.Fail(t, "no layout received")
		}
		return chat1.UIInboxLayout{}
	}
	consumeAllLayout := func() chat1.UIInboxLayout {
		var layout chat1.UIInboxLayout
		for {
			select {
			case layout = <-chatUI.InboxLayoutCb:
			case <-time.After(timeout):
				return layout
			}
		}
	}

	var layout chat1.UIInboxLayout
	conv1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 1, len(layout.SmallTeams))
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	}
	tc.Context().Syncer.SelectConversation(ctx, conv1.Id)

	topicName := "mike"
	channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
		chat1.NewConversationLocalArg{
			TlfName:     conv1.TlfName,
			TopicType:   chat1.TopicType_CHAT,
			TopicName:   &topicName,
			MembersType: chat1.ConversationMembersType_TEAM,
		})
	require.NoError(t, err)

	// there is a race where sometimes we need a third or fourth of these
	layout = consumeAllLayout()
	require.Nil(t, layout.ReselectInfo)
	require.Equal(t, 3, len(layout.BigTeams))
	st, err := layout.BigTeams[0].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_LABEL, st)
	require.Equal(t, conv1.TlfName, layout.BigTeams[0].Label().Name)
	require.Equal(t, conv1.Triple.Tlfid.TLFIDStr(), layout.BigTeams[0].Label().Id)
	st, err = layout.BigTeams[1].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, conv1.Id.ConvIDStr(), layout.BigTeams[1].Channel().ConvID)
	require.Equal(t, conv1.TlfName, layout.BigTeams[1].Channel().Teamname)
	st, err = layout.BigTeams[2].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, channel.Conv.GetConvID().ConvIDStr(), layout.BigTeams[2].Channel().ConvID)
	require.Equal(t, conv1.TlfName, layout.BigTeams[2].Channel().Teamname)
	require.Equal(t, topicName, layout.BigTeams[2].Channel().Channelname)

	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}
	tc.Context().Syncer.SelectConversation(ctx, channel.Conv.GetConvID())
	_, err = ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx,
		chat1.DeleteConversationLocalArg{
			ConvID:      channel.Conv.GetConvID(),
			ChannelName: channel.Conv.GetTopicName(),
			Confirmed:   true,
		})
	require.NoError(t, err)

	layout = consumeAllLayout()
	require.Equal(t, 1, len(layout.SmallTeams))
	require.Zero(t, len(layout.BigTeams))
	require.NotNil(t, layout.ReselectInfo)
	require.NotNil(t, layout.ReselectInfo.NewConvID)
	require.Equal(t, conv1.Id.ConvIDStr(), *layout.ReselectInfo.NewConvID)
}

// TestHashSortedConvs verifies the rolling hash is order-independent, stable, and includes LastSendTime.
func TestHashSortedConvs(t *testing.T) {
	share := func(convID string, lastSendTime gregor1.Time) types.ShareConversation {
		return types.ShareConversation{ConvID: convID, Name: "", LastSendTime: lastSendTime}
	}

	// Empty slice => 0
	require.Equal(t, uint64(0), hashSortedConvs(nil))
	require.Equal(t, uint64(0), hashSortedConvs([]types.ShareConversation{}))

	// Same set in different order => same hash
	h1 := hashSortedConvs([]types.ShareConversation{share("convA", 100), share("convB", 200)})
	h2 := hashSortedConvs([]types.ShareConversation{share("convB", 200), share("convA", 100)})
	require.Equal(t, h1, h2, "hash should be order-independent")

	// Same conv IDs but different LastSendTime => different hash (so we re-donate when send time changes)
	h3 := hashSortedConvs([]types.ShareConversation{share("convA", 100), share("convB", 200)})
	h4 := hashSortedConvs([]types.ShareConversation{share("convA", 999), share("convB", 200)})
	require.NotEqual(t, h3, h4, "hash should change when LastSendTime changes")

	// Different sets => different hashes
	h5 := hashSortedConvs([]types.ShareConversation{share("convC", 0)})
	require.NotEqual(t, h1, h5)
	require.NotEqual(t, hashSortedConvs([]types.ShareConversation{share("x", 0)}), hashSortedConvs([]types.ShareConversation{share("y", 0)}))
}

// mockShareDonator records donated conversations for tests.
type mockShareDonator struct {
	mu    sync.Mutex
	calls [][]types.ShareConversation
}

func (m *mockShareDonator) DonateShareConversations(conversations []types.ShareConversation) {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Copy so caller can't mutate after the fact
	dup := make([]types.ShareConversation, len(conversations))
	copy(dup, conversations)
	m.calls = append(m.calls, dup)
}

func (m *mockShareDonator) DeleteAllDonations() {}

func (m *mockShareDonator) DeleteDonation(conversationID string) {}

func (m *mockShareDonator) getCalls() [][]types.ShareConversation {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([][]types.ShareConversation, len(m.calls))
	copy(out, m.calls)
	return out
}

func (m *mockShareDonator) reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = nil
}

// noopAvatarLoader implements AvatarLoaderSource but returns empty results (no avatars).
type noopAvatarLoader struct{}

func (noopAvatarLoader) LoadUsers(_ libkb.MetaContext, _ []string, _ []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error) {
	return keybase1.LoadAvatarsRes{Picmap: nil}, nil
}

func (noopAvatarLoader) LoadTeams(_ libkb.MetaContext, _ []string, _ []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error) {
	return keybase1.LoadAvatarsRes{Picmap: nil}, nil
}

func (noopAvatarLoader) ClearCacheForName(_ libkb.MetaContext, _ string, _ []keybase1.AvatarFormat) error {
	return nil
}
func (noopAvatarLoader) OnDbNuke(_ libkb.MetaContext) error       { return nil }
func (noopAvatarLoader) StartBackgroundTasks(_ libkb.MetaContext) {}
func (noopAvatarLoader) StopBackgroundTasks(_ libkb.MetaContext)  {}

func TestPrepareShareConversations(t *testing.T) {
	useRemoteMock = true
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestPrepareShareConversations", 1)
	defer ctc.cleanup()

	users := ctc.users()
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	// Build a context that has ShareIntentDonator and an avatar loader so prepareShareConversations runs fully.
	donator := &mockShareDonator{}
	chatG := *tc.ChatG
	chatG.ShareIntentDonator = donator
	g := globals.NewContext(tc.G, &chatG)
	tc.G.SetAvatarLoader(noopAvatarLoader{})

	loader := NewUIInboxLoader(g)

	row := func(convID, name string, isTeam bool, lastSendTime gregor1.Time) chat1.UIInboxSmallTeamRow {
		return chat1.UIInboxSmallTeamRow{
			ConvID:       chat1.ConvIDStr(convID),
			Name:         name,
			Time:         gregor1.Time(0),
			LastSendTime: lastSendTime,
			IsTeam:       isTeam,
		}
	}

	t.Run("nil donator skips", func(t *testing.T) {
		gNoDonator := globals.NewContext(tc.G, &globals.ChatContext{})
		h := NewUIInboxLoader(gNoDonator)
		h.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(0)),
		})
		// No panic; donator is nil so we exit early (no way to assert except no crash)
	})

	t.Run("donates up to 2 convs with correct names", func(t *testing.T) {
		donator.reset()
		loader.lastShareDonationMu.Lock()
		loader.lastShareDonationHash = 0
		loader.lastShareDonationMu.Unlock()

		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(0)),
			row("id2", "bob", false, gregor1.Time(0)),
		})
		calls := donator.getCalls()
		require.Len(t, calls, 1)
		require.Len(t, calls[0], 2)
		require.Equal(t, "id1", calls[0][0].ConvID)
		require.Equal(t, "alice", calls[0][0].Name)
		require.Equal(t, "id2", calls[0][1].ConvID)
		require.Equal(t, "bob", calls[0][1].Name)
	})

	t.Run("donated convs include LastSendTime", func(t *testing.T) {
		donator.reset()
		loader.lastShareDonationMu.Lock()
		loader.lastShareDonationHash = 0
		loader.lastShareDonationMu.Unlock()

		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(100)),
			row("id2", "bob", false, gregor1.Time(200)),
		})
		calls := donator.getCalls()
		require.Len(t, calls, 1)
		require.Len(t, calls[0], 2)
		require.Equal(t, gregor1.Time(100), calls[0][0].LastSendTime)
		require.Equal(t, gregor1.Time(200), calls[0][1].LastSendTime)
	})

	t.Run("same conv set but LastSendTime change donates again", func(t *testing.T) {
		donator.reset()
		loader.lastShareDonationMu.Lock()
		loader.lastShareDonationHash = 0
		loader.lastShareDonationMu.Unlock()

		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(100)),
			row("id2", "bob", false, gregor1.Time(200)),
		})
		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(999)), // same convs, different send time
			row("id2", "bob", false, gregor1.Time(200)),
		})
		calls := donator.getCalls()
		require.Len(t, calls, 2, "second call with different LastSendTime should donate again")
		require.Equal(t, gregor1.Time(999), calls[1][0].LastSendTime)
	})

	t.Run("excludes channels from suggestions", func(t *testing.T) {
		donator.reset()
		loader.lastShareDonationMu.Lock()
		loader.lastShareDonationHash = 0
		loader.lastShareDonationMu.Unlock()

		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("teamid", "team#general", true, gregor1.Time(0)),
			row("id1", "alice", false, gregor1.Time(0)),
			row("id2", "bob", false, gregor1.Time(0)),
			row("id3", "charlie", false, gregor1.Time(0)),
		})
		calls := donator.getCalls()
		require.Len(t, calls, 1)
		require.Len(t, calls[0], 2)
		require.Equal(t, "teamid", calls[0][0].ConvID)
		require.Equal(t, "team#general", calls[0][0].Name)
		require.Equal(t, "id1", calls[0][1].ConvID)
		require.Equal(t, "alice", calls[0][1].Name)
	})

	t.Run("caps at 2 suggested convs", func(t *testing.T) {
		donator.reset()
		loader.lastShareDonationMu.Lock()
		loader.lastShareDonationHash = 0
		loader.lastShareDonationMu.Unlock()

		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(0)),
			row("id2", "bob", false, gregor1.Time(0)),
			row("id3", "charlie", false, gregor1.Time(0)),
		})
		calls := donator.getCalls()
		require.Len(t, calls, 1)
		require.Len(t, calls[0], 2)
		require.Equal(t, "id1", calls[0][0].ConvID)
		require.Equal(t, "id2", calls[0][1].ConvID)
	})

	t.Run("same conv set skips second donate", func(t *testing.T) {
		donator.reset()
		loader.lastShareDonationMu.Lock()
		loader.lastShareDonationHash = 0
		loader.lastShareDonationMu.Unlock()

		widgetList := []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(0)),
			row("id2", "bob", false, gregor1.Time(0)),
		}
		loader.prepareShareConversations(ctx, widgetList)
		loader.prepareShareConversations(ctx, widgetList)
		calls := donator.getCalls()
		require.Len(t, calls, 1, "second call with same conv set should skip donate")
		require.Len(t, calls[0], 2)
	})

	t.Run("different conv set donates again", func(t *testing.T) {
		donator.reset()
		loader.lastShareDonationMu.Lock()
		loader.lastShareDonationHash = 0
		loader.lastShareDonationMu.Unlock()

		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id1", "alice", false, gregor1.Time(0)),
		})
		loader.prepareShareConversations(ctx, []chat1.UIInboxSmallTeamRow{
			row("id2", "bob", false, gregor1.Time(0)),
		})
		calls := donator.getCalls()
		require.Len(t, calls, 2)
		require.Len(t, calls[0], 1)
		require.Equal(t, "id1", calls[0][0].ConvID)
		require.Len(t, calls[1], 1)
		require.Equal(t, "id2", calls[1][0].ConvID)
	})
}
