package unfurl

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type memConversationBackedStorage struct {
	sync.Mutex
	storage map[string]string
}

func newMemConversationBackedStorage() *memConversationBackedStorage {
	return &memConversationBackedStorage{
		storage: make(map[string]string),
	}
}

func (s *memConversationBackedStorage) Get(ctx context.Context, uid gregor1.UID, name string, res any) (bool, error) {
	s.Lock()
	defer s.Unlock()
	dat, ok := s.storage[name]
	if !ok {
		return false, nil
	}
	err := json.Unmarshal([]byte(dat), res)
	return true, err
}

func (s *memConversationBackedStorage) Put(ctx context.Context, uid gregor1.UID, name string, src any) error {
	s.Lock()
	defer s.Unlock()
	dat, err := json.Marshal(src)
	if err != nil {
		return err
	}
	s.storage[name] = string(dat)
	return nil
}

func TestUnfurlSetting(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})

	uid := gregor1.UID([]byte{0, 1})
	settings := NewSettings(g, newMemConversationBackedStorage())
	res, err := settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, res.Mode)
	require.Empty(t, res.Whitelist)
	require.NoError(t, settings.WhitelistAdd(context.TODO(), uid, "yahoo.com"))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, res.Mode)
	require.Len(t, res.Whitelist, 1)
	require.True(t, res.Whitelist["yahoo.com"])
	require.NoError(t, settings.WhitelistAdd(context.TODO(), uid, "google.com"))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, res.Mode)
	require.Len(t, res.Whitelist, 2)
	require.True(t, res.Whitelist["google.com"])
	require.True(t, res.Whitelist["yahoo.com"])
	require.NoError(t, settings.SetMode(context.TODO(), uid, chat1.UnfurlMode_NEVER))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_NEVER, res.Mode)
	require.Len(t, res.Whitelist, 2)
	require.True(t, res.Whitelist["google.com"])
	require.True(t, res.Whitelist["yahoo.com"])
	require.NoError(t, settings.WhitelistRemove(context.TODO(), uid, "google.com"))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Len(t, res.Whitelist, 1)
	require.True(t, res.Whitelist["yahoo.com"])
}

func TestUnfurlSettingBlocklist(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.TODO()

	uid := gregor1.UID([]byte{0, 1})
	settings := NewSettings(g, newMemConversationBackedStorage())
	res, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.NotNil(t, res.Blocklist)
	require.Empty(t, res.Blocklist)

	require.NoError(t, settings.BlocklistAdd(ctx, uid, "foo.com"))
	res, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.True(t, res.Blocklist["foo.com"])

	require.NoError(t, settings.WhitelistAdd(ctx, uid, "foo.com"))
	res, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.True(t, res.Whitelist["foo.com"])
	require.Empty(t, res.Blocklist)

	require.NoError(t, settings.BlocklistAdd(ctx, uid, "foo.com"))
	res, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.True(t, res.Blocklist["foo.com"])
	require.Empty(t, res.Whitelist)

	require.NoError(t, settings.BlocklistRemove(ctx, uid, "foo.com"))
	res, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Empty(t, res.Blocklist)
	require.Empty(t, res.Whitelist)

	// old-format storage: only the mode and whitelist keys exist
	old := newMemConversationBackedStorage()
	require.NoError(t, old.Put(ctx, uid, settingsModeName, modeRecord{Mode: chat1.UnfurlMode_ALWAYS}))
	require.NoError(t, old.Put(ctx, uid, settingsWhitelistName, whitelistRecord{
		Whitelist: map[string]bool{"a.com": true},
	}))
	res, err = NewSettings(g, old).Get(ctx, uid)
	require.NoError(t, err)
	require.NotNil(t, res.Blocklist)
	require.Empty(t, res.Blocklist)
	require.True(t, res.Whitelist["a.com"])
}

func TestUnfurlSettingSetNormalizes(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.TODO()

	uid := gregor1.UID([]byte{0, 1})
	settings := NewSettings(g, newMemConversationBackedStorage())
	require.NoError(t, settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_WHITELISTED,
		Whitelist: map[string]bool{"https://www.a.com/x": true, "A.com": true},
		Blocklist: map[string]bool{"WWW.B.com": true},
	}))
	res, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, map[string]bool{"a.com": true}, res.Whitelist)
	require.Equal(t, map[string]bool{"b.com": true}, res.Blocklist)

	err = settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_NEVER,
		Whitelist: map[string]bool{"c.com": true},
		Blocklist: map[string]bool{"www.c.com": true},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "c.com")
	after, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, res, after)

	err = settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_WHITELISTED,
		Blocklist: map[string]bool{"giphy.com": true},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "giphy.com")
	after, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, res, after)
}
