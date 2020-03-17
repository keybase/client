package chat

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestDevConversationBackedStorageTeamAdminOnly(t *testing.T) {
	t.Skip("Y2K-1062")

	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, t.Name(), 2)
	defer ctc.cleanup()

	users := ctc.users()

	alice := users[0]
	tc := ctc.world.Tcs[alice.Username]
	ri := ctc.as(t, alice).ri
	ctx := ctc.as(t, alice).startCtx
	uid := alice.User.GetUID().ToBytes()
	storage := NewTeamDevConversationBackedStorage(tc.Context(),
		true /* adminOnly */, func() chat1.RemoteInterface { return ri })
	var msg string

	bob := users[1]
	readeruid := bob.User.GetUID().ToBytes()
	readertc := ctc.world.Tcs[bob.Username]
	readerri := ctc.as(t, bob).ri
	readerctx := ctc.as(t, bob).startCtx
	readerstorage := NewTeamDevConversationBackedStorage(readertc.Context(),
		true /* adminOnly */, func() chat1.RemoteInterface { return readerri })
	var readermsg string

	conv := mustCreateChannelForTest(t, ctc, alice, chat1.TopicType_CHAT, nil,
		chat1.ConversationMembersType_TEAM, bob)
	teamID, err := keybase1.TeamIDFromString(conv.Triple.Tlfid.String())
	require.NoError(t, err)

	key0 := "mykey"

	found, err := storage.Get(ctx, uid, teamID, key0, &msg)
	require.NoError(t, err)
	require.False(t, found)
	found, err = readerstorage.Get(readerctx, readeruid, teamID, key0, &readermsg)
	require.NoError(t, err)
	require.False(t, found)

	err = storage.Put(ctx, uid, teamID, key0, "hello")
	require.NoError(t, err)

	err = readerstorage.Put(readerctx, readeruid, teamID, key0, "hello")
	require.Error(t, err)
	require.IsType(t, &DevStoragePermissionDeniedError{}, err, "got right error")

	found, err = storage.Get(ctx, uid, teamID, key0, &msg)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, msg, "hello")
	found, err = readerstorage.Get(readerctx, readeruid, teamID, key0, &readermsg)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, msg, "hello")
}

func TestDevConversationBackedStorageTeamAdminOnlyReaderMisbehavior(t *testing.T) {
	t.Skip("Y2K-1062")

	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, t.Name(), 2)
	defer ctc.cleanup()

	users := ctc.users()

	alice := users[0]
	tc := ctc.world.Tcs[alice.Username]
	ri := ctc.as(t, alice).ri
	ctx := ctc.as(t, alice).startCtx
	uid := alice.User.GetUID().ToBytes()
	storage := NewTeamDevConversationBackedStorage(tc.Context(),
		true /* adminOnly */, func() chat1.RemoteInterface { return ri })
	var msg string

	bob := users[1]
	readertc := ctc.world.Tcs[bob.Username]
	readerri := ctc.as(t, bob).ri
	readerctx := ctc.as(t, bob).startCtx
	readeruid := bob.User.GetUID().ToBytes()
	readerstorage := NewTeamDevConversationBackedStorage(readertc.Context(),
		true /* adminOnly */, func() chat1.RemoteInterface { return readerri })
	var readermsg string

	conv := mustCreateChannelForTest(t, ctc, alice, chat1.TopicType_CHAT, nil,
		chat1.ConversationMembersType_TEAM, bob)
	teamID, err := keybase1.TeamIDFromString(conv.Triple.Tlfid.String())
	require.NoError(t, err)
	key0 := "mykey"

	found, err := storage.Get(ctx, uid, teamID, key0, &msg)
	require.NoError(t, err)
	require.False(t, found)
	found, err = readerstorage.Get(readerctx, readeruid, teamID, key0, &readermsg)
	require.NoError(t, err)
	require.False(t, found)

	err = readerstorage.Put(readerctx, readeruid, teamID, key0, "evil")
	require.Error(t, err)
	require.IsType(t, &DevStoragePermissionDeniedError{}, err, "got right error")

	// work around client-side protection and make dev channel/msg anyway
	devconv := mustCreateChannelForTest(t, ctc, bob, chat1.TopicType_DEV, &key0,
		chat1.ConversationMembersType_TEAM, alice)
	larg := chat1.PostLocalArg{
		ConversationID: devconv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        devconv.Triple,
				TlfName:     devconv.TlfName,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "reallyevil"}),
		},
	}
	_, err = ctc.as(t, bob).chatLocalHandler().PostLocal(ctc.as(t, bob).startCtx, larg)
	require.NoError(t, err)

	_, err = storage.Get(ctx, uid, teamID, key0, &msg)
	require.Error(t, err, "got an error after misbehavior")
	require.IsType(t, &DevStorageAdminOnlyError{}, err, "got a permission error")

	_, err = readerstorage.Get(readerctx, readeruid, teamID, key0, &readermsg)
	require.Error(t, err, "got an error after misbehavior")
	require.IsType(t, &DevStorageAdminOnlyError{}, err, "got a permission error")
}
