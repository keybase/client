package unfurl

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/keybase/client/go/logger"
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

func (s *memConversationBackedStorage) Get(ctx context.Context, uid gregor1.UID, name string, res interface{}) (bool, error) {
	s.Lock()
	defer s.Unlock()
	dat, ok := s.storage[name]
	if !ok {
		return false, nil
	}
	err := json.Unmarshal([]byte(dat), res)
	return true, err
}

func (s *memConversationBackedStorage) Put(ctx context.Context, uid gregor1.UID, name string, src interface{}) error {
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
	uid := gregor1.UID([]byte{0, 1})
	settings := NewSettings(logger.NewTestLogger(t), newMemConversationBackedStorage())
	res, err := settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, res.Mode)
	require.Zero(t, len(res.Whitelist))
	require.NoError(t, settings.WhitelistAdd(context.TODO(), uid, "yahoo.com"))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, res.Mode)
	require.Equal(t, 1, len(res.Whitelist))
	require.True(t, res.Whitelist["yahoo.com"])
	require.NoError(t, settings.WhitelistAdd(context.TODO(), uid, "google.com"))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_WHITELISTED, res.Mode)
	require.Equal(t, 2, len(res.Whitelist))
	require.True(t, res.Whitelist["google.com"])
	require.True(t, res.Whitelist["yahoo.com"])
	require.NoError(t, settings.SetMode(context.TODO(), uid, chat1.UnfurlMode_NEVER))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlMode_NEVER, res.Mode)
	require.Equal(t, 2, len(res.Whitelist))
	require.True(t, res.Whitelist["google.com"])
	require.True(t, res.Whitelist["yahoo.com"])
	require.NoError(t, settings.WhitelistRemove(context.TODO(), uid, "google.com"))
	res, err = settings.Get(context.TODO(), uid)
	require.NoError(t, err)
	require.Equal(t, 1, len(res.Whitelist))
	require.True(t, res.Whitelist["yahoo.com"])
}
