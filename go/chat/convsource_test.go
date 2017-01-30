package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestGetThreadSupersedes(t *testing.T) {
	world, ri, _, sender, _, _, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]

	cres, err := tlf.CryptKeys(context.TODO(), keybase1.TLFQuery{
		TlfName: u.Username,
	})
	require.NoError(t, err)

	trip := chat1.ConversationIDTriple{
		Tlfid:     cres.NameIDBreaks.TlfID.ToBytes(),
		TopicType: chat1.TopicType_CHAT,
		TopicID:   []byte{0},
	}
	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple: trip,
		TLFMessage: chat1.MessageBoxed{
			ClientHeader: chat1.MessageClientHeader{
				TlfName:   u.Username,
				TlfPublic: false,
			},
			KeyGeneration: 1,
		},
	})
	require.NoError(t, err)

	t.Logf("basic test")
	_, msgID, _, err := sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HIHI",
		}),
	}, 0)
	require.NoError(t, err)
	thread, _, err := tc.G.ConvSource.Pull(context.TODO(), res.ConvID, u.User.GetUID().ToBytes(),
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[0].GetMessageID(), "wrong msgID")

	_, editMsgID, _, err := sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  msgID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
			MessageID: msgID,
			Body:      "EDITED",
		}),
	}, 0)
	require.NoError(t, err)

	t.Logf("testing an edit")
	thread, _, err = tc.G.ConvSource.Pull(context.TODO(), res.ConvID, u.User.GetUID().ToBytes(),
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[0].GetMessageID(), "wrong msgID")
	require.Equal(t, editMsgID, thread.Messages[0].Valid().ServerHeader.SupersededBy, "wrong super")
	require.Equal(t, "EDITED", thread.Messages[0].Valid().MessageBody.Text().Body, "wrong body")

	t.Logf("testing a delete")
	_, deleteMsgID, _, err := sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_DELETE,
			Supersedes:  msgID,
		},
		MessageBody: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
			MessageIDs: []chat1.MessageID{msgID, editMsgID},
		}),
	}, 0)
	require.NoError(t, err)
	thread, _, err = tc.G.ConvSource.Pull(context.TODO(), res.ConvID, u.User.GetUID().ToBytes(),
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 0, len(thread.Messages), "wrong length")

	t.Logf("testing disabling resolve")
	thread, _, err = tc.G.ConvSource.Pull(context.TODO(), res.ConvID, u.User.GetUID().ToBytes(),
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{
				chat1.MessageType_TEXT,
				chat1.MessageType_EDIT,
				chat1.MessageType_DELETE},
			DisableResolveSupersedes: true,
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 3, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[2].GetMessageID(), "wrong msgID")
	require.Equal(t, deleteMsgID, thread.Messages[2].Valid().ServerHeader.SupersededBy, "wrong super")
}
