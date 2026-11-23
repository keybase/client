package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type teamChangedByIDListener struct {
	libkb.NoopNotifyListener
	ch chan keybase1.TeamChangedByIDArg
}

func (l *teamChangedByIDListener) TeamChangedByID(teamID keybase1.TeamID, _ keybase1.Seqno, _ bool,
	changes keybase1.TeamChangeSet, _ keybase1.Seqno, source keybase1.TeamChangedSource,
) {
	select {
	case l.ch <- keybase1.TeamChangedByIDArg{TeamID: teamID, Changes: changes, Source: source}:
	default:
	}
}

func (l *teamChangedByIDListener) drain() {
	for {
		select {
		case <-l.ch:
		default:
			return
		}
	}
}

// requireChannelsChanged waits for the empty, locally sourced change set that a
// channel change sends; server team.change notices for the team are skipped.
func (l *teamChangedByIDListener) requireChannelsChanged(t *testing.T, teamID keybase1.TeamID, what string) {
	timeout := time.After(20 * time.Second)
	for {
		select {
		case arg := <-l.ch:
			if arg.TeamID.Eq(teamID) && arg.Source == keybase1.TeamChangedSource_LOCAL &&
				arg.Changes == (keybase1.TeamChangeSet{}) {
				return
			}
		case <-timeout:
			require.Fail(t, "no teamChangedByID after "+what)
		}
	}
}

func TestChatSrvTeamChannelChangesNotifyTeam(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestChatSrvTeamChannelChangesNotifyTeam", 1)
	defer ctc.cleanup()
	users := ctc.users()
	tc := ctc.as(t, users[0])
	ctx := tc.startCtx

	listener := &teamChangedByIDListener{ch: make(chan keybase1.TeamChangedByIDArg, 100)}
	tc.h.G().NotifyRouter.AddListener(listener)

	general := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	teamID, err := keybase1.TeamIDFromString(general.Triple.Tlfid.String())
	require.NoError(t, err)

	listener.drain()
	topicName := "notifyme"
	channel, err := tc.chatLocalHandler().NewConversationLocal(ctx, chat1.NewConversationLocalArg{
		TlfName:       general.TlfName,
		TopicName:     &topicName,
		TopicType:     chat1.TopicType_CHAT,
		TlfVisibility: keybase1.TLFVisibility_PRIVATE,
		MembersType:   chat1.ConversationMembersType_TEAM,
	})
	require.NoError(t, err)
	listener.requireChannelsChanged(t, teamID, "create")
	channelID := channel.Conv.GetConvID()

	listener.drain()
	_, err = tc.chatLocalHandler().PostMetadata(ctx, chat1.PostMetadataArg{
		ConversationID:   channelID,
		TlfName:          general.TlfName,
		ChannelName:      "notifyme2",
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	require.NoError(t, err)
	listener.requireChannelsChanged(t, teamID, "rename")

	listener.drain()
	_, err = tc.chatLocalHandler().PostHeadline(ctx, chat1.PostHeadlineArg{
		ConversationID:   channelID,
		TlfName:          general.TlfName,
		Headline:         "about",
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	require.NoError(t, err)
	listener.requireChannelsChanged(t, teamID, "headline")

	listener.drain()
	_, err = tc.chatLocalHandler().DeleteConversationLocal(ctx, chat1.DeleteConversationLocalArg{
		ConvID:    channelID,
		Confirmed: true,
	})
	require.NoError(t, err)
	listener.requireChannelsChanged(t, teamID, "delete")
}

type blockingTeamChangedByIDListener struct {
	libkb.NoopNotifyListener
	release chan struct{}
	done    chan struct{}
}

func (l *blockingTeamChangedByIDListener) TeamChangedByID(keybase1.TeamID, keybase1.Seqno, bool,
	keybase1.TeamChangeSet, keybase1.Seqno, keybase1.TeamChangedSource,
) {
	<-l.release
	close(l.done)
}

// The notice goes out from the outbox loop and chat RPCs, and delivery waits on
// every team listener: a slow one must not hold the caller.
func TestNotifyTeamChannelsChangedDoesNotBlock(t *testing.T) {
	tc := libkb.SetupTest(t, "notifyTeamChannelsChanged", 0)
	defer tc.Cleanup()
	tc.G.ConnectionManager = libkb.NewConnectionManager()
	tc.G.NotifyRouter = libkb.NewNotifyRouter(tc.G)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	listener := &blockingTeamChangedByIDListener{release: make(chan struct{}), done: make(chan struct{})}
	g.NotifyRouter.AddListener(listener)

	teamID := keybase1.MakeTestTeamID(1, false)
	ctx, cancel := context.WithCancel(context.Background())
	returned := make(chan struct{})
	go func() {
		notifyTeamChannelsChanged(ctx, g, chat1.ConversationMembersType_TEAM, chat1.TopicType_CHAT,
			chat1.TLFID(teamID.ToBytes()))
		close(returned)
	}()
	select {
	case <-returned:
	case <-time.After(10 * time.Second):
		close(listener.release)
		require.Fail(t, "notifyTeamChannelsChanged waited on a listener")
	}
	// the caller's context ending must not drop the notice
	cancel()
	close(listener.release)
	select {
	case <-listener.done:
	case <-time.After(10 * time.Second):
		require.Fail(t, "the notice was never delivered")
	}
}
