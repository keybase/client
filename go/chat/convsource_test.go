package chat

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestGetThreadSupersedes(t *testing.T) {
	testGetThreadSupersedes(t, false)
	testGetThreadSupersedes(t, true)
}

func testGetThreadSupersedes(t *testing.T, deleteHistory bool) {
	t.Logf("stage deleteHistory:%v", deleteHistory)
	ctx, world, ri, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	trip := newConvTriple(ctx, t, tc, u.Username)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, _, _, _, err := sender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_KBFS, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)

	t.Logf("basic test")
	_, msgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
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
	}, 0, nil)
	require.NoError(t, err)
	msgID := msgBoxed.GetMessageID()
	thread, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[0].GetMessageID(), "wrong msgID")

	_, editMsgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
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
	}, 0, nil)
	require.NoError(t, err)
	editMsgID := editMsgBoxed.GetMessageID()

	t.Logf("testing an edit")
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[0].GetMessageID(), "wrong msgID")
	require.Equal(t, editMsgID, thread.Messages[0].Valid().ServerHeader.SupersededBy, "wrong super")
	require.Equal(t, "EDITED", thread.Messages[0].Valid().MessageBody.Text().Body, "wrong body")

	t.Logf("testing a delete")
	delTyp := chat1.MessageType_DELETE
	delBody := chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
		MessageIDs: []chat1.MessageID{msgID, editMsgID},
	})
	delSupersedes := msgID
	var delHeader *chat1.MessageDeleteHistory
	if deleteHistory {
		delTyp = chat1.MessageType_DELETEHISTORY
		delHeader = &chat1.MessageDeleteHistory{
			Upto: editMsgID + 1,
		}
		delBody = chat1.NewMessageBodyWithDeletehistory(*delHeader)
		delSupersedes = 0
	}
	_, deleteMsgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:          trip,
			Sender:        u.User.GetUID().ToBytes(),
			TlfName:       u.Username,
			TlfPublic:     false,
			MessageType:   delTyp,
			Supersedes:    delSupersedes,
			DeleteHistory: delHeader,
		},
		MessageBody: delBody,
	}, 0, nil)
	require.NoError(t, err)
	deleteMsgID := deleteMsgBoxed.GetMessageID()
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 0, len(thread.Messages), "wrong length")

	t.Logf("testing disabling resolve")
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{
				chat1.MessageType_TEXT,
				chat1.MessageType_EDIT,
				chat1.MessageType_DELETE,
				chat1.MessageType_DELETEHISTORY,
			},
			DisableResolveSupersedes: true,
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 3, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[2].GetMessageID(), "wrong msgID")
	require.Equal(t, deleteMsgID, thread.Messages[2].Valid().ServerHeader.SupersededBy, "wrong super")
}

func TestExplodeNow(t *testing.T) {
	ctx, world, ri, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	trip := newConvTriple(ctx, t, tc, u.Username)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, _, _, _, err := sender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_TEAM, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)

	t.Logf("basic test")
	ephemeralMetadata := chat1.MsgEphemeralMetadata{
		Lifetime: 30,
	}
	_, msgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:              trip,
			Sender:            u.User.GetUID().ToBytes(),
			TlfName:           u.Username,
			TlfPublic:         false,
			MessageType:       chat1.MessageType_TEXT,
			EphemeralMetadata: &ephemeralMetadata,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "30s ephemeral",
		}),
	}, 0, nil)
	require.NoError(t, err)

	msgID := msgBoxed.GetMessageID()
	thread, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)

	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	msg1 := thread.Messages[0]
	require.Equal(t, msgID, msg1.GetMessageID(), "wrong msgID")
	require.True(t, msg1.IsValid())
	require.True(t, msg1.Valid().IsEphemeral())
	require.False(t, msg1.Valid().IsEphemeralExpired(time.Now()))
	require.Nil(t, msg1.Valid().ExplodedBy())

	_, editMsgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:              trip,
			Sender:            u.User.GetUID().ToBytes(),
			TlfName:           u.Username,
			TlfPublic:         false,
			MessageType:       chat1.MessageType_EDIT,
			Supersedes:        msgID,
			EphemeralMetadata: &ephemeralMetadata,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
			MessageID: msgID,
			Body:      "EDITED ephemeral",
		}),
	}, 0, nil)
	require.NoError(t, err)
	editMsgID := editMsgBoxed.GetMessageID()

	t.Logf("testing an edit")
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	msg2 := thread.Messages[0]
	require.Equal(t, msgID, msg2.GetMessageID(), "wrong msgID")
	require.Equal(t, editMsgID, msg2.Valid().ServerHeader.SupersededBy, "wrong super")
	require.Equal(t, "EDITED ephemeral", msg2.Valid().MessageBody.Text().Body, "wrong body")
	require.True(t, msg2.Valid().IsEphemeral())
	require.False(t, msg2.Valid().IsEphemeralExpired(time.Now()))
	require.Nil(t, msg2.Valid().ExplodedBy())

	t.Logf("testing a delete")
	delBody := chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
		MessageIDs: []chat1.MessageID{msgID, editMsgID},
	})
	delSupersedes := msgID
	_, deleteMsgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_DELETE,
			Supersedes:  delSupersedes,
		},
		MessageBody: delBody,
	}, 0, nil)
	require.NoError(t, err)

	deleteMsgID := deleteMsgBoxed.GetMessageID()
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	// Since we deleted an exploding message, it will still show up in the
	// thread with the deleter set as "explodedBy"
	msg3 := thread.Messages[0]
	require.Equal(t, msgID, msg3.GetMessageID(), "wrong msgID")
	require.Equal(t, deleteMsgID, msg3.Valid().ServerHeader.SupersededBy, "wrong super")
	require.Equal(t, chat1.MessageBody{}, msg3.Valid().MessageBody, "wrong body")
	require.True(t, msg3.Valid().IsEphemeral())
	// This is true since we did an explode now!
	require.True(t, msg3.Valid().IsEphemeralExpired(time.Now()))
	require.Equal(t, u.Username, *msg3.Valid().ExplodedBy())
}

func TestReactions(t *testing.T) {
	ctx, world, ri, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	trip := newConvTriple(ctx, t, tc, u.Username)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, _, _, _, err := sender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_TEAM, nil)
	require.NoError(t, err)

	res, err := ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)

	verifyThread := func(msgID, supersededBy chat1.MessageID, body string,
		reactionIDs []chat1.MessageID, reactionMap chat1.ReactionMap) {
		thread, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, uid,
			chat1.GetThreadReason_GENERAL,
			&chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			}, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(thread.Messages), "wrong length")

		msg := thread.Messages[0]
		require.Equal(t, msgID, msg.GetMessageID(), "wrong msgID")
		require.True(t, msg.IsValid())
		require.Equal(t, body, msg.Valid().MessageBody.Text().Body, "wrong body")
		require.Equal(t, supersededBy, msg.Valid().ServerHeader.SupersededBy, "wrong super")
		require.Equal(t, reactionIDs, msg.Valid().ServerHeader.ReactionIDs, "wrong reactionIDs")

		// Verify the ctimes are not zero, but we don't care about the actual
		// value for the test.
		for _, reactions := range msg.Valid().Reactions.Reactions {
			for k, r := range reactions {
				require.NotZero(t, r.Ctime)
				r.Ctime = 0
				reactions[k] = r
			}
		}
		require.Equal(t, reactionMap, msg.Valid().Reactions, "wrong reactions")
	}

	sendText := func(body string) chat1.MessageID {
		_, msgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      uid,
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: body,
			}),
		}, 0, nil)
		require.NoError(t, err)
		return msgBoxed.GetMessageID()
	}

	sendEdit := func(editText string, supersedes chat1.MessageID) chat1.MessageID {
		_, editMsgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      uid,
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_EDIT,
				Supersedes:  supersedes,
			},
			MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
				MessageID: supersedes,
				Body:      editText,
			}),
		}, 0, nil)
		require.NoError(t, err)
		return editMsgBoxed.GetMessageID()
	}

	sendReaction := func(reactionText string, supersedes chat1.MessageID) chat1.MessageID {
		_, reactionMsgboxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      uid,
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_REACTION,
				Supersedes:  supersedes,
			},
			MessageBody: chat1.NewMessageBodyWithReaction(chat1.MessageReaction{
				MessageID: supersedes,
				Body:      reactionText,
			}),
		}, 0, nil)
		require.NoError(t, err)
		return reactionMsgboxed.GetMessageID()
	}

	sendDelete := func(supsersedes chat1.MessageID, deletes []chat1.MessageID) chat1.MessageID {
		delBody := chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
			MessageIDs: deletes,
		})
		_, deleteMsgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      uid,
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_DELETE,
				Supersedes:  supsersedes,
			},
			MessageBody: delBody,
		}, 0, nil)
		require.NoError(t, err)
		return deleteMsgBoxed.GetMessageID()

	}

	t.Logf("send text")
	body := "hi"
	msgID := sendText(body)
	verifyThread(msgID, 0 /* supersededBy */, body, nil, chat1.ReactionMap{})

	// Verify edits can happen around reactions and don't get clobbered
	t.Logf("testing an edit")
	body = "edited"
	editMsgID := sendEdit(body, msgID)
	verifyThread(msgID, editMsgID, body, nil, chat1.ReactionMap{})

	t.Logf("test +1 reaction")
	reactionMsgID := sendReaction(":+1:", msgID)
	expectedReactionMap := chat1.ReactionMap{
		Reactions: map[string]map[string]chat1.Reaction{
			":+1:": map[string]chat1.Reaction{
				u.Username: chat1.Reaction{
					ReactionMsgID: reactionMsgID,
				},
			},
		},
	}
	verifyThread(msgID, editMsgID, body, []chat1.MessageID{reactionMsgID}, expectedReactionMap)

	t.Logf("test -1 reaction")
	reactionMsgID2 := sendReaction(":-1:", msgID)
	expectedReactionMap.Reactions[":-1:"] = map[string]chat1.Reaction{
		u.Username: chat1.Reaction{
			ReactionMsgID: reactionMsgID2,
		},
	}
	verifyThread(msgID, editMsgID, body, []chat1.MessageID{reactionMsgID, reactionMsgID2}, expectedReactionMap)

	t.Logf("testing an edit2")
	body = "edited2"
	editMsgID2 := sendEdit(body, msgID)
	verifyThread(msgID, editMsgID2, body, []chat1.MessageID{reactionMsgID, reactionMsgID2}, expectedReactionMap)

	t.Logf("test multiple pulls")
	// Verify pulling again returns the correct state
	verifyThread(msgID, editMsgID2, body, []chat1.MessageID{reactionMsgID, reactionMsgID2}, expectedReactionMap)

	t.Logf("test reaction deletion")
	sendDelete(reactionMsgID2, []chat1.MessageID{reactionMsgID2})
	delete(expectedReactionMap.Reactions, ":-1:")
	verifyThread(msgID, editMsgID2, body, []chat1.MessageID{reactionMsgID}, expectedReactionMap)

	t.Logf("testing an edit3")
	body = "edited3"
	editMsgID3 := sendEdit(body, msgID)
	verifyThread(msgID, editMsgID3, body, []chat1.MessageID{reactionMsgID}, expectedReactionMap)

	t.Logf("test reaction after delete")
	reactionMsgID3 := sendReaction(":-1:", msgID)

	expectedReactionMap.Reactions[":-1:"] = map[string]chat1.Reaction{
		u.Username: chat1.Reaction{
			ReactionMsgID: reactionMsgID3,
		},
	}
	verifyThread(msgID, editMsgID3, body, []chat1.MessageID{reactionMsgID, reactionMsgID3}, expectedReactionMap)

	t.Logf("testing a delete")
	sendDelete(msgID, []chat1.MessageID{msgID, reactionMsgID, reactionMsgID3})

	thread, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, uid,
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 0, len(thread.Messages), "wrong length")

	// Post illegal supersedes=0, fails on send
	_, _, err = sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      uid,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_REACTION,
			Supersedes:  0,
		},
		MessageBody: chat1.NewMessageBodyWithReaction(chat1.MessageReaction{
			MessageID: 0,
			Body:      ":wave:",
		}),
	}, 0, nil)
	require.Error(t, err)
}

type failingRemote struct {
	t *testing.T
}

func newFailingRemote(t *testing.T) failingRemote {
	return failingRemote{
		t: t,
	}
}

var _ chat1.RemoteInterface = (*failingRemote)(nil)

func (f failingRemote) GetInboxRemote(context.Context, chat1.GetInboxRemoteArg) (chat1.GetInboxRemoteRes, error) {
	require.Fail(f.t, "GetInboxRemote call")
	return chat1.GetInboxRemoteRes{}, nil
}
func (f failingRemote) GetThreadRemote(context.Context, chat1.GetThreadRemoteArg) (chat1.GetThreadRemoteRes, error) {

	require.Fail(f.t, "GetThreadRemote call")
	return chat1.GetThreadRemoteRes{}, nil
}
func (f failingRemote) GetPublicConversations(context.Context, chat1.GetPublicConversationsArg) (chat1.GetPublicConversationsRes, error) {
	require.Fail(f.t, "GetPublicConversations call")
	return chat1.GetPublicConversationsRes{}, nil
}
func (f failingRemote) PostRemote(context.Context, chat1.PostRemoteArg) (chat1.PostRemoteRes, error) {

	require.Fail(f.t, "PostRemote call")
	return chat1.PostRemoteRes{}, nil
}
func (f failingRemote) NewConversationRemote(context.Context, chat1.ConversationIDTriple) (chat1.NewConversationRemoteRes, error) {

	require.Fail(f.t, "NewConversationRemote call")
	return chat1.NewConversationRemoteRes{}, nil
}
func (f failingRemote) NewConversationRemote2(context.Context, chat1.NewConversationRemote2Arg) (chat1.NewConversationRemoteRes, error) {

	require.Fail(f.t, "NewConversationRemote2 call")
	return chat1.NewConversationRemoteRes{}, nil
}
func (f failingRemote) GetMessagesRemote(context.Context, chat1.GetMessagesRemoteArg) (chat1.GetMessagesRemoteRes, error) {

	require.Fail(f.t, "GetMessagesRemote call")
	return chat1.GetMessagesRemoteRes{}, nil
}
func (f failingRemote) MarkAsRead(context.Context, chat1.MarkAsReadArg) (chat1.MarkAsReadRes, error) {

	require.Fail(f.t, "MarkAsRead call")
	return chat1.MarkAsReadRes{}, nil
}
func (f failingRemote) SetConversationStatus(context.Context, chat1.SetConversationStatusArg) (chat1.SetConversationStatusRes, error) {

	require.Fail(f.t, "SetConversationStatus call")
	return chat1.SetConversationStatusRes{}, nil
}
func (f failingRemote) SetAppNotificationSettings(context.Context, chat1.SetAppNotificationSettingsArg) (chat1.SetAppNotificationSettingsRes, error) {
	require.Fail(f.t, "SetAppNotificationSettings call")
	return chat1.SetAppNotificationSettingsRes{}, nil
}
func (f failingRemote) GetUnreadUpdateFull(context.Context, chat1.InboxVers) (chat1.UnreadUpdateFull, error) {

	require.Fail(f.t, "GetUnreadUpdateFull call")
	return chat1.UnreadUpdateFull{}, nil
}
func (f failingRemote) GetS3Params(context.Context, chat1.ConversationID) (chat1.S3Params, error) {

	require.Fail(f.t, "GetS3Params call")
	return chat1.S3Params{}, nil
}
func (f failingRemote) S3Sign(context.Context, chat1.S3SignArg) ([]byte, error) {

	require.Fail(f.t, "S3Sign call")
	return nil, nil
}
func (f failingRemote) GetInboxVersion(context.Context, gregor1.UID) (chat1.InboxVers, error) {

	require.Fail(f.t, "GetInboxVersion call")
	return chat1.InboxVers(0), nil
}
func (f failingRemote) TlfFinalize(context.Context, chat1.TlfFinalizeArg) error {

	require.Fail(f.t, "TlfFinalize call")
	return nil
}
func (f failingRemote) TlfResolve(context.Context, chat1.TlfResolveArg) error {

	require.Fail(f.t, "TlfResolve call")
	return nil
}
func (f failingRemote) SyncInbox(ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
	require.Fail(f.t, "SyncInbox")
	return chat1.SyncInboxRes{}, nil
}

func (f failingRemote) SyncChat(ctx context.Context, vers chat1.InboxVers) (chat1.SyncChatRes, error) {
	require.Fail(f.t, "SyncChat")
	return chat1.SyncChatRes{}, nil
}

func (f failingRemote) SyncAll(ctx context.Context, arg chat1.SyncAllArg) (chat1.SyncAllResult, error) {
	require.Fail(f.t, "SyncAll")
	return chat1.SyncAllResult{}, nil
}

func (f failingRemote) UpdateTypingRemote(ctx context.Context, arg chat1.UpdateTypingRemoteArg) error {
	require.Fail(f.t, "UpdateTypingRemote")
	return nil
}

func (f failingRemote) GetTLFConversations(ctx context.Context, arg chat1.GetTLFConversationsArg) (chat1.GetTLFConversationsRes, error) {
	require.Fail(f.t, "GetTLFConversations")
	return chat1.GetTLFConversationsRes{}, nil
}

func (f failingRemote) JoinConversation(ctx context.Context, convID chat1.ConversationID) (chat1.JoinLeaveConversationRemoteRes, error) {
	require.Fail(f.t, "JoinConversation")
	return chat1.JoinLeaveConversationRemoteRes{}, nil
}

func (f failingRemote) LeaveConversation(ctx context.Context, convID chat1.ConversationID) (chat1.JoinLeaveConversationRemoteRes, error) {
	require.Fail(f.t, "LeaveConversation")
	return chat1.JoinLeaveConversationRemoteRes{}, nil
}

func (f failingRemote) PreviewConversation(ctx context.Context, convID chat1.ConversationID) (chat1.JoinLeaveConversationRemoteRes, error) {
	require.Fail(f.t, "PreviewConversation")
	return chat1.JoinLeaveConversationRemoteRes{}, nil
}

func (f failingRemote) DeleteConversation(ctx context.Context, convID chat1.ConversationID) (chat1.DeleteConversationRemoteRes, error) {
	require.Fail(f.t, "DeleteConversation")
	return chat1.DeleteConversationRemoteRes{}, nil
}

func (f failingRemote) GetMessageBefore(ctx context.Context, arg chat1.GetMessageBeforeArg) (chat1.GetMessageBeforeRes, error) {
	require.Fail(f.t, "GetMessageBefore")
	return chat1.GetMessageBeforeRes{}, nil
}

func (f failingRemote) RemoteNotificationSuccessful(ctx context.Context,
	arg chat1.RemoteNotificationSuccessfulArg) error {
	require.Fail(f.t, "RemoteNotificationSuccessful")
	return nil
}

func (f failingRemote) SetGlobalAppNotificationSettings(ctx context.Context, arg chat1.GlobalAppNotificationSettings) error {
	require.Fail(f.t, "SetGlobalAppNotificationSettings")
	return nil
}

func (f failingRemote) GetGlobalAppNotificationSettings(ctx context.Context) (chat1.GlobalAppNotificationSettings, error) {
	require.Fail(f.t, "GetGlobalAppNotificationSettings")
	return chat1.GlobalAppNotificationSettings{}, nil
}

func (f failingRemote) SetConvRetention(ctx context.Context, _ chat1.SetConvRetentionArg) (res chat1.SetRetentionRes, err error) {
	require.Fail(f.t, "SetConvRetention")
	return res, errors.New("SetConvRetention not mocked")
}

func (f failingRemote) SetTeamRetention(ctx context.Context, _ chat1.SetTeamRetentionArg) (res chat1.SetRetentionRes, err error) {
	require.Fail(f.t, "SetTeamRetention")
	return res, errors.New("SetTeamRetention not mocked")
}

func (f failingRemote) SetConvMinWriterRole(ctx context.Context, _ chat1.SetConvMinWriterRoleArg) (res chat1.SetConvMinWriterRoleRes, err error) {
	require.Fail(f.t, "SetConvMinWriterRole")
	return res, errors.New("SetConvMinWriterRole not mocked")
}

func (f failingRemote) RetentionSweepConv(ctx context.Context, convID chat1.ConversationID) (res chat1.SweepRes, err error) {
	require.Fail(f.t, "UpgradeKBFSToImpteam")
	return res, nil
}

func (f failingRemote) UpgradeKBFSToImpteam(ctx context.Context, tlfID chat1.TLFID) error {
	require.Fail(f.t, "UpgradeKBFSToImpteam")
	return nil
}

type failingTlf struct {
	t *testing.T
}

func newFailingTlf(t *testing.T) failingTlf {
	return failingTlf{
		t: t,
	}
}

func (f failingTlf) CryptKeys(context.Context, string) (keybase1.GetTLFCryptKeysRes, error) {
	require.Fail(f.t, "CryptKeys call")
	return keybase1.GetTLFCryptKeysRes{}, nil
}

func (f failingTlf) PublicCanonicalTLFNameAndID(context.Context, string) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	require.Fail(f.t, "PublicCanonicalTLFNameAndID call")
	return keybase1.CanonicalTLFNameAndIDWithBreaks{}, nil
}

func (f failingTlf) CompleteAndCanonicalizePrivateTlfName(context.Context, string) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	require.Fail(f.t, "CompleteAndCanonicalizePrivateTlfName call")
	return keybase1.CanonicalTLFNameAndIDWithBreaks{}, nil
}

func (f failingTlf) LookupIDUntrusted(context.Context, string, bool) (*types.NameInfoUntrusted, error) {
	require.Fail(f.t, "LookupUnstrusted call")
	return nil, nil
}

func (f failingTlf) LookupID(context.Context, string, bool) (*types.NameInfo, error) {
	require.Fail(f.t, "Lookup call")
	return nil, nil
}

func (f failingTlf) LookupName(context.Context, chat1.TLFID, bool) (*types.NameInfo, error) {
	require.Fail(f.t, "Lookup call")
	return nil, nil
}

func (f failingTlf) AllCryptKeys(context.Context, string, bool) (types.AllCryptKeys, error) {
	require.Fail(f.t, "AllCryptKeys call")
	return nil, nil
}

func (f failingTlf) EncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (types.CryptKey, *types.NameInfo, error) {
	require.Fail(f.t, "EncryptionKey call")
	return nil, nil, nil
}

func (f failingTlf) DecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (types.CryptKey, error) {
	require.Fail(f.t, "DecryptionKey call")
	return nil, nil
}

func (f failingTlf) EphemeralEncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (keybase1.TeamEk, error) {
	panic("unimplemented")
}

func (f failingTlf) EphemeralDecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	generation keybase1.EkGeneration) (keybase1.TeamEk, error) {
	panic("unimplemented")
}

func (f failingTlf) ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error) {
	panic("unimplemented")
}

type failingUpak struct {
	t *testing.T
}

var _ libkb.UPAKLoader = (*failingUpak)(nil)

func newFailingUpak(t *testing.T) failingUpak {
	return failingUpak{
		t: t,
	}
}

func (f failingUpak) ClearMemory() {
	require.Fail(f.t, "ClearMemory call")
}
func (f failingUpak) Load(arg libkb.LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *libkb.User, err error) {
	require.Fail(f.t, "Load call")
	return nil, nil, nil
}
func (f failingUpak) LoadV2(arg libkb.LoadUserArg) (ret *keybase1.UserPlusKeysV2AllIncarnations, user *libkb.User, err error) {
	require.Fail(f.t, "LoadV2 call")
	return nil, nil, nil
}
func (f failingUpak) LoadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (*keybase1.UserPlusKeysV2, *keybase1.UserPlusKeysV2AllIncarnations, *keybase1.PublicKeyV2NaCl, error) {
	require.Fail(f.t, "LoadKeyV2")
	return nil, nil, nil, nil
}
func (f failingUpak) CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error) {
	require.Fail(f.t, "ChceckKIDForUID call")
	return false, nil, false, nil
}
func (f failingUpak) LoadUserPlusKeys(ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID) (keybase1.UserPlusKeys, error) {
	require.Fail(f.t, "LoadUserPlusKeys call")
	return keybase1.UserPlusKeys{}, nil
}
func (f failingUpak) Invalidate(ctx context.Context, uid keybase1.UID) {
	require.Fail(f.t, "Invalidate call")
}
func (f failingUpak) LoadDeviceKey(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (upk *keybase1.UserPlusAllKeys, deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error) {
	require.Fail(f.t, "LoadDeviceKey call")
	return nil, nil, nil, nil
}
func (f failingUpak) LoadUPAKWithDeviceID(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (*keybase1.UserPlusKeysV2AllIncarnations, error) {
	require.Fail(f.t, "LoadUPAKWithDeviceID call")
	return nil, nil
}
func (f failingUpak) LookupUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	require.Fail(f.t, "LookupUsername call")
	return "", nil
}
func (f failingUpak) LookupUsernameUPAK(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	require.Fail(f.t, "LookupUsernameUPAK call")
	return "", nil
}
func (f failingUpak) LookupUID(ctx context.Context, un libkb.NormalizedUsername) (keybase1.UID, error) {
	require.Fail(f.t, "LookupUID call")
	return keybase1.UID(""), nil
}
func (f failingUpak) LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID) (username libkb.NormalizedUsername, deviceName string, deviceType string, err error) {
	require.Fail(f.t, "LookupUsernameAndDevice call")
	return "", "", "", nil
}
func (f failingUpak) ListFollowedUIDs(ctx context.Context, uid keybase1.UID) ([]keybase1.UID, error) {
	require.Fail(f.t, "ListFollowedUIDs call")
	return nil, nil
}
func (f failingUpak) PutUserToCache(ctx context.Context, user *libkb.User) error {
	require.Fail(f.t, "PutUserToCache call")
	return nil
}
func (f failingUpak) LoadV2WithKID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (*keybase1.UserPlusKeysV2AllIncarnations, error) {
	require.Fail(f.t, "LoadV2WithKID call")
	return nil, nil
}
func (f failingUpak) CheckDeviceForUIDAndUsername(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID, n libkb.NormalizedUsername) error {
	require.Fail(f.t, "CheckDeviceForUIDAndUsername call")
	return nil
}
func (f failingUpak) Batcher(ctx context.Context, getArg func(int) *libkb.LoadUserArg, processResult func(int, *keybase1.UserPlusKeysV2AllIncarnations), window int) (err error) {
	require.Fail(f.t, "Batcher call")
	return nil
}

func TestGetThreadCaching(t *testing.T) {
	ctx, world, ri, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	trip := newConvTriple(ctx, t, tc, u.Username)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, _, _, _, err := sender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_KBFS, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)

	_, msgBoxed, err := sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
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
	}, 0, nil)
	require.NoError(t, err)
	msgID := msgBoxed.GetMessageID()

	tc.ChatG.ConvSource.Clear(context.TODO(), res.ConvID, u.User.GetUID().ToBytes())
	tc.ChatG.ConvSource.Disconnected(ctx)
	tc.ChatG.InboxSource.Disconnected(ctx)
	t.Logf("make sure we get offline error")
	thread, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.Error(t, err)
	require.IsType(t, OfflineError{}, err, "wrong error type")

	t.Logf("read to populate caches")
	tc.ChatG.ConvSource.Connected(ctx)
	tc.ChatG.InboxSource.Connected(ctx)
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[0].GetMessageID(), "wrong msgID")

	t.Logf("reading thread again for total cache hit")
	failingRI := newFailingRemote(t)
	failingTI := newFailingTlf(t)
	tc.ChatG.ConvSource.Disconnected(ctx)
	tc.ChatG.InboxSource.Disconnected(ctx)
	tc.ChatG.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface { return failingRI })
	tc.ChatG.InboxSource.SetRemoteInterface(func() chat1.RemoteInterface { return failingRI })

	tc.G.OverrideUPAKLoader(newFailingUpak(t))

	ctx = newTestContextWithTlfMock(tc, failingTI)
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(thread.Messages), "wrong length")
	require.Equal(t, msgID, thread.Messages[0].GetMessageID(), "wrong msgID")
}

type noGetThreadRemote struct {
	*kbtest.ChatRemoteMock
}

func newNoGetThreadRemote(mock *kbtest.ChatRemoteMock) *noGetThreadRemote {
	return &noGetThreadRemote{
		ChatRemoteMock: mock,
	}
}

func (n *noGetThreadRemote) GetThreadRemote(ctx context.Context, arg chat1.GetThreadRemoteArg) (chat1.GetThreadRemoteRes, error) {
	return chat1.GetThreadRemoteRes{}, errors.New("GetThreadRemote banned")
}

func TestGetThreadHoleResolution(t *testing.T) {
	ctx, world, ri2, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	syncer := NewSyncer(tc.Context())
	syncer.isConnected = true
	<-tc.ChatG.ConvLoader.Stop(context.Background())

	conv := newConv(ctx, t, tc, uid, ri, sender, u.Username)
	convID := conv.GetConvID()
	pt := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HIHI",
		}),
	}

	var msg *chat1.MessageBoxed
	var err error
	holes := 3
	for i := 0; i < holes; i++ {
		pt.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: fmt.Sprintf("MIKE: %d", i),
		})
		msg, _, _, _, _, err = sender.Prepare(ctx, pt, chat1.ConversationMembersType_KBFS, &conv)
		require.NoError(t, err)
		require.NotNil(t, msg)

		res, err := ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: conv.GetConvID(),
			MessageBoxed:   *msg,
		})
		require.NoError(t, err)
		msg.ServerHeader = &res.MsgHeader
	}

	conv.MaxMsgs = []chat1.MessageBoxed{*msg}
	conv.MaxMsgSummaries = []chat1.MessageSummary{msg.Summary()}
	conv.ReaderInfo.MaxMsgid = msg.GetMessageID()
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		return chat1.NewSyncInboxResWithIncremental(chat1.SyncIncrementalRes{
			Vers:  vers + 1,
			Convs: []chat1.Conversation{conv},
		}), nil
	}
	doSync(t, syncer, ri, uid)

	localThread, err := tc.Context().ConvSource.PullLocalOnly(ctx, convID, uid, nil, nil, 0)
	require.NoError(t, err)
	require.Equal(t, 2, len(localThread.Messages))

	tc.Context().ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
		return newNoGetThreadRemote(ri)
	})
	thread, err := tc.Context().ConvSource.Pull(ctx, convID, uid, chat1.GetThreadReason_GENERAL, nil, nil)
	require.NoError(t, err)
	require.Equal(t, holes+2, len(thread.Messages))
	require.Equal(t, msg.GetMessageID(), thread.Messages[0].GetMessageID())
	require.Equal(t, "MIKE: 2", thread.Messages[0].Valid().MessageBody.Text().Body)

	// Make sure we don't consider it a hit if we end the fetch with a hole
	require.NoError(t, tc.Context().ConvSource.Clear(ctx, convID, uid))
	_, err = tc.Context().ConvSource.Pull(ctx, convID, uid, chat1.GetThreadReason_GENERAL, nil, nil)
	require.Error(t, err)
}

type acquireRes struct {
	blocked bool
	err     error
}

func timedAcquire(ctx context.Context, t *testing.T, hcs *HybridConversationSource, uid gregor1.UID, convID chat1.ConversationID) (ret bool, err error) {
	cb := make(chan struct{})
	go func() {
		ret, err = hcs.lockTab.Acquire(ctx, uid, convID)
		close(cb)
	}()
	select {
	case <-cb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "acquire timeout")
	}
	return ret, err
}

func TestConversationLocking(t *testing.T) {
	ctx, world, ri2, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	syncer := NewSyncer(tc.Context())
	syncer.isConnected = true
	<-tc.Context().ConvLoader.Stop(context.TODO())
	hcs := tc.Context().ConvSource.(*HybridConversationSource)
	if hcs == nil {
		t.Skip()
	}

	conv := newConv(ctx, t, tc, uid, ri, sender, u.Username)

	t.Logf("Trace 1 can get multiple locks")
	var breaks []keybase1.TLFIdentifyFailure
	ctx = Context(context.TODO(), tc.Context(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &breaks,
		NewCachingIdentifyNotifier(tc.Context()))
	acquires := 5
	for i := 0; i < acquires; i++ {
		_, err := timedAcquire(ctx, t, hcs, uid, conv.GetConvID())
		require.NoError(t, err)
	}
	for i := 0; i < acquires; i++ {
		hcs.lockTab.Release(ctx, uid, conv.GetConvID())
	}
	require.Zero(t, len(hcs.lockTab.convLocks))

	t.Logf("Trace 2 properly blocked by Trace 1")
	ctx2 := Context(context.TODO(), tc.Context(), keybase1.TLFIdentifyBehavior_CHAT_CLI,
		&breaks, NewCachingIdentifyNotifier(tc.Context()))
	blockCb := make(chan struct{}, 5)
	hcs.lockTab.blockCb = &blockCb
	cb := make(chan acquireRes)
	blocked, err := timedAcquire(ctx, t, hcs, uid, conv.GetConvID())
	require.NoError(t, err)
	require.False(t, blocked)
	go func() {
		blocked, err = timedAcquire(ctx2, t, hcs, uid, conv.GetConvID())
		cb <- acquireRes{blocked: blocked, err: err}
	}()
	select {
	case <-cb:
		require.Fail(t, "should have blocked")
	default:
	}
	// Wait for the thread to get blocked
	select {
	case <-blockCb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "not blocked")
	}

	require.True(t, hcs.lockTab.Release(ctx, uid, conv.GetConvID()))
	select {
	case res := <-cb:
		require.NoError(t, res.err)
		require.True(t, res.blocked)
	case <-time.After(20 * time.Second):
		require.Fail(t, "not blocked")
	}
	require.True(t, hcs.lockTab.Release(ctx2, uid, conv.GetConvID()))
	require.Zero(t, len(hcs.lockTab.convLocks))

	t.Logf("No trace")
	blocked, err = timedAcquire(context.TODO(), t, hcs, uid, conv.GetConvID())
	require.NoError(t, err)
	require.False(t, blocked)
	blocked, err = timedAcquire(context.TODO(), t, hcs, uid, conv.GetConvID())
	require.NoError(t, err)
	require.False(t, blocked)
	require.Zero(t, len(hcs.lockTab.convLocks))
}

func TestConversationLockingDeadlock(t *testing.T) {
	ctx, world, ri2, _, sender, _ := setupTest(t, 3)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	u := world.GetUsers()[0]
	u2 := world.GetUsers()[1]
	u3 := world.GetUsers()[2]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	syncer := NewSyncer(tc.Context())
	syncer.isConnected = true
	<-tc.Context().ConvLoader.Stop(context.TODO())
	hcs := tc.Context().ConvSource.(*HybridConversationSource)
	if hcs == nil {
		t.Skip()
	}
	conv := newBlankConvWithMembersType(ctx, t, tc, uid, ri, sender, u.Username,
		chat1.ConversationMembersType_KBFS)
	conv2 := newBlankConvWithMembersType(ctx, t, tc, uid, ri, sender, u2.Username+","+u.Username,
		chat1.ConversationMembersType_KBFS)
	conv3 := newBlankConvWithMembersType(ctx, t, tc, uid, ri, sender, u3.Username+","+u.Username,
		chat1.ConversationMembersType_KBFS)

	var breaks []keybase1.TLFIdentifyFailure
	ctx = Context(context.TODO(), tc.Context(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &breaks,
		NewCachingIdentifyNotifier(tc.Context()))
	ctx2 := Context(context.TODO(), tc.Context(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &breaks,
		NewCachingIdentifyNotifier(tc.Context()))
	ctx3 := Context(context.TODO(), tc.Context(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &breaks,
		NewCachingIdentifyNotifier(tc.Context()))

	blocked, err := timedAcquire(ctx, t, hcs, uid, conv.GetConvID())
	require.NoError(t, err)
	require.False(t, blocked)
	blocked, err = timedAcquire(ctx2, t, hcs, uid, conv2.GetConvID())
	require.NoError(t, err)
	require.False(t, blocked)
	blocked, err = timedAcquire(ctx3, t, hcs, uid, conv3.GetConvID())
	require.NoError(t, err)
	require.False(t, blocked)

	blockCb := make(chan struct{}, 5)
	hcs.lockTab.blockCb = &blockCb
	cb := make(chan acquireRes)
	go func() {
		blocked, err = hcs.lockTab.Acquire(ctx, uid, conv2.GetConvID())
		cb <- acquireRes{blocked: blocked, err: err}
	}()
	select {
	case <-blockCb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "not blocked")
	}

	hcs.lockTab.maxAcquireRetries = 1
	cb2 := make(chan acquireRes)
	go func() {
		blocked, err = hcs.lockTab.Acquire(ctx2, uid, conv3.GetConvID())
		cb2 <- acquireRes{blocked: blocked, err: err}
	}()
	select {
	case <-blockCb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "not blocked")
	}

	cb3 := make(chan acquireRes)
	go func() {
		blocked, err = hcs.lockTab.Acquire(ctx3, uid, conv.GetConvID())
		cb3 <- acquireRes{blocked: blocked, err: err}
	}()
	select {
	case <-blockCb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "not blocked")
	}
	select {
	case res := <-cb3:
		require.Error(t, res.err)
		require.IsType(t, errConvLockTabDeadlock, res.err)
	case <-time.After(20 * time.Second):
		require.Fail(t, "never failed")
	}

	require.True(t, hcs.lockTab.Release(ctx, uid, conv.GetConvID()))
	blocked, err = timedAcquire(ctx3, t, hcs, uid, conv.GetConvID())
	require.NoError(t, err)
	require.False(t, blocked)
	require.True(t, hcs.lockTab.Release(ctx2, uid, conv2.GetConvID()))
	select {
	case res := <-cb:
		require.NoError(t, res.err)
		require.True(t, res.blocked)
	case <-time.After(20 * time.Second):
		require.Fail(t, "not blocked")
	}
	require.True(t, hcs.lockTab.Release(ctx3, uid, conv3.GetConvID()))
	select {
	case res := <-cb2:
		require.NoError(t, res.err)
		require.True(t, res.blocked)
	case <-time.After(20 * time.Second):
		require.Fail(t, "not blocked")
	}

	require.True(t, hcs.lockTab.Release(ctx, uid, conv2.GetConvID()))
	require.True(t, hcs.lockTab.Release(ctx2, uid, conv3.GetConvID()))
}

func TestClearFromDelete(t *testing.T) {
	ctx, world, ri2, _, sender, listener := setupTest(t, 1)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	syncer := NewSyncer(tc.Context())
	syncer.isConnected = true
	hcs := tc.Context().ConvSource.(*HybridConversationSource)
	if hcs == nil {
		t.Skip()
	}

	conv := newBlankConv(ctx, t, tc, uid, ri, sender, u.Username)
	select {
	case <-listener.bgConvLoads:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no conv loader")
	}

	require.NoError(t, tc.Context().ChatHelper.SendTextByID(ctx, conv.GetConvID(), conv.Metadata.IdTriple,
		u.Username, "hi"))
	require.NoError(t, tc.Context().ChatHelper.SendTextByID(ctx, conv.GetConvID(), conv.Metadata.IdTriple,
		u.Username, "hi2"))
	_, delMsg, err := sender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_DELETE,
			Supersedes:  3,
		},
		MessageBody: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
			MessageIDs: []chat1.MessageID{3},
		}),
	}, 0, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(4), delMsg.GetMessageID())

	require.NoError(t, hcs.storage.MaybeNuke(context.TODO(), true, nil, conv.GetConvID(), uid))
	_, err = hcs.GetMessages(ctx, conv, uid, []chat1.MessageID{3, 2}, nil)
	require.NoError(t, err)
	tv, err := hcs.PullLocalOnly(ctx, conv.GetConvID(), uid, nil, nil, 0)
	require.NoError(t, err)
	require.Equal(t, 2, len(tv.Messages))

	hcs.numExpungeReload = 1
	hcs.ClearFromDelete(ctx, uid, conv.GetConvID(), 4)
	select {
	case <-listener.bgConvLoads:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no conv loader")
	}
	tv, err = hcs.PullLocalOnly(ctx, conv.GetConvID(), uid, nil, nil, 0)
	require.NoError(t, err)
	require.Equal(t, 1, len(tv.Messages))
	require.Equal(t, chat1.MessageID(4), tv.Messages[0].GetMessageID())
}
