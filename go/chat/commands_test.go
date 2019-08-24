package chat

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type fakeUIRouter struct {
	libkb.UIRouter
	ui libkb.ChatUI
}

func (f *fakeUIRouter) GetChatUI() (libkb.ChatUI, error) {
	return f.ui, nil
}

func (f *fakeUIRouter) DumpUIs() map[libkb.UIKind]libkb.ConnectionID {
	return nil
}

func (f *fakeUIRouter) Shutdown() {}

func TestChatCommands(t *testing.T) {
	ctc := makeChatTestContext(t, "TestChatCommands", 2)
	defer ctc.cleanup()
	users := ctc.users()
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	timeout := 20 * time.Second
	checkMsgText := func(list *serverChatListener, text string) {
		select {
		case msg := <-list.newMessageRemote:
			require.True(t, msg.Message.IsValid())
			require.True(t, msg.Message.Valid().MessageBody.IsType(chat1.MessageType_TEXT))
			require.Equal(t, text, msg.Message.Valid().MessageBody.Text().Body)
		case <-time.After(timeout):
			require.Fail(t, "no msg")
		}
	}
	checkHeadline := func(list *serverChatListener, headline string) {
		select {
		case msg := <-list.newMessageRemote:
			require.True(t, msg.Message.IsValid())
			require.True(t, msg.Message.Valid().MessageBody.IsType(chat1.MessageType_HEADLINE))
			require.Equal(t, "chat about some pointless stuff",
				msg.Message.Valid().MessageBody.Headline().Headline)
		case <-time.After(timeout):
			require.Fail(t, "no msg")
		}
	}

	ctx := ctc.as(t, users[0]).startCtx
	ui := kbtest.NewChatUI()
	listener0 := newServerChatListener()
	listener1 := newServerChatListener()
	ctc.as(t, users[0]).h.mockChatUI = ui
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
	ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
	ctc.world.Tcs[users[0].Username].G.UIRouter = &fakeUIRouter{ui: ui}
	ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true
	ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer).isConnected = true
	impConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	mustCreateConversationForTest(t, ctc, users[0],
		chat1.TopicType_CHAT, chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	topicName := "mike"
	ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
		chat1.NewConversationLocalArg{
			TlfName:       teamConv.TlfName,
			TopicName:     &topicName,
			TopicType:     chat1.TopicType_CHAT,
			TlfVisibility: keybase1.TLFVisibility_PRIVATE,
			MembersType:   chat1.ConversationMembersType_TEAM,
		})
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)
	_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(ctx, ncres.Conv.GetConvID())
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)

	t.Log("test /shrug")
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/shrug whatever",
	}))
	checkMsgText(listener0, `whatever ¯\_(ツ)_/¯`)
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/shrug ",
	}))
	checkMsgText(listener0, `¯\_(ツ)_/¯`)

	t.Logf("test /msg")
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: fmt.Sprintf("/msg %s hi", users[1].Username),
	}))
	checkMsgText(listener0, "hi")
	checkMsgText(listener1, "hi")
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: fmt.Sprintf("/msg %s hi team", teamConv.TlfName),
	}))
	checkMsgText(listener0, "hi team")
	checkMsgText(listener1, "hi team")
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: fmt.Sprintf("/msg %s#%s hi channel", teamConv.TlfName, "mike"),
	}))
	checkMsgText(listener0, "hi channel")
	checkMsgText(listener1, "hi channel")

	t.Logf("test /me")
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/me rises against the tide",
	}))
	checkMsgText(listener0, "_rises against the tide_")

	t.Logf("test /headline")
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/topic chat about some pointless stuff",
	}))
	checkHeadline(listener0, "/topic chat about some pointless stuff")
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/topic chat about some pointless stuff",
	}))
	checkHeadline(listener0, "/topic chat about some pointless stuff")
	checkHeadline(listener1, "/topic chat about some pointless stuff")

	testLeave := func() {
		mustPostLocalForTest(t, ctc, users[0], ncres.Conv.Info,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "/leave",
			}))
		consumeNewMsgRemote(t, listener1, chat1.MessageType_LEAVE)
		select {
		case convID := <-listener0.leftConv:
			require.Equal(t, ncres.Conv.GetConvID(), convID)
		case <-time.After(timeout):
			require.Fail(t, "no leave")
		}
	}
	t.Logf("test /join and /leave")
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/leave",
	}))
	checkMsgText(listener0, "/leave")
	checkMsgText(listener1, "/leave")
	testLeave()
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/join",
	}))
	select {
	case <-ui.ShowManageChannels:
	case <-time.After(timeout):
		require.Fail(t, "no show")
	}
	_, err = ctc.as(t, users[0]).chatLocalHandler().JoinConversationLocal(ctx, chat1.JoinConversationLocalArg{
		TlfName:    teamConv.TlfName,
		TopicType:  chat1.TopicType_CHAT,
		TopicName:  "mike",
		Visibility: keybase1.TLFVisibility_PRIVATE,
	})
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
	testLeave()
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: fmt.Sprintf("/join %s#mike", teamConv.TlfName),
	}))
	checkMsgText(listener0, fmt.Sprintf("/join %s#mike", teamConv.TlfName))

	t.Logf("test /hide and /unhide")
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: fmt.Sprintf("/hide %s", users[0].Username),
	}))
	select {
	case info := <-listener0.setStatus:
		require.Equal(t, impConv.Id, info.ConvID)
		require.Equal(t, chat1.ConversationStatus_IGNORED, info.Status)
	case <-time.After(timeout):
		require.Fail(t, "no set status")
	}
	mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: fmt.Sprintf("/unhide %s", users[0].Username),
	}))
	select {
	case info := <-listener0.setStatus:
		require.Equal(t, impConv.Id, info.ConvID)
		require.Equal(t, chat1.ConversationStatus_UNFILED, info.Status)
	case <-time.After(timeout):
		require.Fail(t, "no set status")
	}
	mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/hide",
	}))
	select {
	case info := <-listener0.setStatus:
		require.Equal(t, impConv.Id, info.ConvID)
		require.Equal(t, chat1.ConversationStatus_IGNORED, info.Status)
	case <-time.After(timeout):
		require.Fail(t, "no set status")
	}
}
