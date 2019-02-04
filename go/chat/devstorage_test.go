package chat

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestDevConversationBackedStorage(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestDevConversationBackedStorage", 1)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ri := ctc.as(t, users[0]).ri
	ctx := ctc.as(t, users[0]).startCtx
	uid := users[0].User.GetUID().ToBytes()

	key0 := "storage0"
	key1 := "storage1"
	storage := NewDevConversationBackedStorage(tc.Context(), func() chat1.RemoteInterface { return ri })
	settings := chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_WHITELISTED,
		Whitelist: make(map[string]bool),
	}
	require.NoError(t, storage.Put(ctx, uid, key0, settings))
	var settingsRes chat1.UnfurlSettings
	found, err := storage.Get(ctx, uid, key0, &settingsRes)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, settingsRes.Mode)
	require.Zero(t, len(settingsRes.Whitelist))

	settings.Mode = chat1.UnfurlMode_NEVER
	require.NoError(t, storage.Put(ctx, uid, key0, settings))
	found, err = storage.Get(ctx, uid, key0, &settingsRes)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, chat1.UnfurlMode_NEVER, settingsRes.Mode)
	require.Zero(t, len(settingsRes.Whitelist))

	settings.Mode = chat1.UnfurlMode_WHITELISTED
	settings.Whitelist["MIKE"] = true
	require.NoError(t, storage.Put(ctx, uid, key1, settings))
	found, err = storage.Get(ctx, uid, key0, &settingsRes)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, chat1.UnfurlMode_NEVER, settingsRes.Mode)
	require.Zero(t, len(settingsRes.Whitelist))
	found, err = storage.Get(ctx, uid, key1, &settingsRes)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, settingsRes.Mode)
	require.Equal(t, 1, len(settingsRes.Whitelist))
	require.True(t, settingsRes.Whitelist["MIKE"])

	found, err = storage.Get(ctx, uid, "AHHHHH CANT FIND ME", &settingsRes)
	require.NoError(t, err)
	require.False(t, found)
}
