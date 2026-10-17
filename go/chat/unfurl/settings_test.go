package unfurl

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
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

	require.NoError(t, settings.WhitelistAdd(ctx, uid, "foo.com"))
	require.NoError(t, settings.WhitelistRemove(ctx, uid, "foo.com"))
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

func TestUnfurlSettingGetResolvesOverlap(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.TODO()

	// a client that predates the block list can allow a domain without unblocking it
	uid := gregor1.UID([]byte{0, 1})
	storage := newMemConversationBackedStorage()
	require.NoError(t, storage.Put(ctx, uid, settingsWhitelistName, whitelistRecord{
		Whitelist: map[string]bool{"a.com": true, "b.com": true},
	}))
	require.NoError(t, storage.Put(ctx, uid, settingsBlocklistName, blocklistRecord{
		Blocklist: map[string]bool{"b.com": true},
	}))
	settings := NewSettings(g, storage)
	res, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, map[string]bool{"a.com": true}, res.Whitelist)
	require.Equal(t, map[string]bool{"b.com": true}, res.Blocklist)

	require.NoError(t, settings.Set(ctx, uid, res))
	after, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, res, after)
}

func TestUnfurlSettingAddRejectsAutoAllowed(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.TODO()

	uid := gregor1.UID([]byte{0, 1})
	settings := NewSettings(g, newMemConversationBackedStorage())
	for _, domain := range []string{"giphy.com", types.MapsDomain} {
		require.Error(t, settings.BlocklistAdd(ctx, uid, domain))
		require.Error(t, settings.WhitelistAdd(ctx, uid, domain))
	}
	res, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Empty(t, res.Whitelist)
	require.Empty(t, res.Blocklist)
	require.NoError(t, settings.Set(ctx, uid, res))
}

func TestUnfurlSettingGetCleansLegacyEntries(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.TODO()

	// entries written before the lists were validated
	uid := gregor1.UID([]byte{0, 1})
	storage := newMemConversationBackedStorage()
	require.NoError(t, storage.Put(ctx, uid, settingsWhitelistName, whitelistRecord{
		Whitelist: map[string]bool{
			"giphy.com": true, "localhost": true, "::1": true, "A.com": true,
			"https://www.a.com/x": true, "https://WWW.C.com/y": true, "d.com": false,
			"b.com": true,
		},
	}))
	require.NoError(t, storage.Put(ctx, uid, settingsBlocklistName, blocklistRecord{
		Blocklist: map[string]bool{"WWW.B.com": true, types.MapsDomain: true, "not a domain": true},
	}))
	settings := NewSettings(g, storage)
	res, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, map[string]bool{"a.com": true, "c.com": true}, res.Whitelist)
	require.Equal(t, map[string]bool{"b.com": true}, res.Blocklist)

	require.NoError(t, settings.Set(ctx, uid, res))
	after, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, res, after)

	// allowing a domain also clears a legacy spelling of it from the block list
	require.NoError(t, storage.Put(ctx, uid, settingsBlocklistName, blocklistRecord{
		Blocklist: map[string]bool{"WWW.E.com": true},
	}))
	require.NoError(t, settings.WhitelistAdd(ctx, uid, "e.com"))
	res, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.True(t, res.Whitelist["e.com"])
	require.Empty(t, res.Blocklist)
}

func TestUnfurlSettingConcurrentAdds(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.TODO()

	uid := gregor1.UID([]byte{0, 1})
	settings := NewSettings(g, newMemConversationBackedStorage())
	const n = 50
	errs := make([]error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			domain := fmt.Sprintf("d%d.com", i)
			if i%2 == 0 {
				errs[i] = settings.BlocklistAdd(ctx, uid, domain)
			} else {
				errs[i] = settings.WhitelistAdd(ctx, uid, domain)
			}
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		require.NoError(t, err)
	}
	res, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Len(t, res.Blocklist, n/2)
	require.Len(t, res.Whitelist, n/2)
}

func TestUnfurlSettingSetKeepsBlocklist(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat_settings", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.TODO()

	uid := gregor1.UID([]byte{0, 1})
	settings := NewSettings(g, newMemConversationBackedStorage())
	require.NoError(t, settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_WHITELISTED,
		Whitelist: map[string]bool{"a.com": true},
	}))
	res, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Empty(t, res.Blocklist)

	require.NoError(t, settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_WHITELISTED,
		Blocklist: map[string]bool{"b.com": true, "c.com": true, "d.com": true},
	}))

	// a nil block list keeps the stored one, minus what the new allow list allows
	require.NoError(t, settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_NEVER,
		Whitelist: map[string]bool{"a.com": true, "https://www.B.com/x": true},
	}))
	res, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_NEVER, res.Mode)
	require.Equal(t, map[string]bool{"a.com": true, "b.com": true}, res.Whitelist)
	require.Equal(t, map[string]bool{"c.com": true, "d.com": true}, res.Blocklist)

	err = settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_WHITELISTED,
		Whitelist: map[string]bool{"c.com": true, "not a domain": true},
	})
	require.Error(t, err)
	after, err := settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, res, after)

	// an empty, non-nil block list clears it
	require.NoError(t, settings.Set(ctx, uid, chat1.UnfurlSettings{
		Mode:      chat1.UnfurlMode_WHITELISTED,
		Blocklist: map[string]bool{},
	}))
	res, err = settings.Get(ctx, uid)
	require.NoError(t, err)
	require.Empty(t, res.Whitelist)
	require.Empty(t, res.Blocklist)
}
