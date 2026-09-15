package libkb

import (
	"sync"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type hangingAPI struct {
	NullMockAPI
	started chan struct{}
	once    sync.Once
}

func (h *hangingAPI) PostDecode(MetaContext, APIArg, APIResponseWrapper) error {
	h.once.Do(func() { close(h.started) })
	return nil
}

func TestGetAllProvisionedUsernamesDoesNotWaitOnServer(t *testing.T) {
	tc := SetupTest(t, "gapu", 1)
	defer tc.Cleanup()

	hanging := &hangingAPI{started: make(chan struct{})}
	tc.G.API = hanging

	uid, err := UIDFromHex("d17a826a3b5420dc5c7d2b7afd31d819")
	require.NoError(t, err)
	deviceID, err := keybase1.DeviceIDFromString("c548e9e7e58f8397b2dd0d8c622af818")
	require.NoError(t, err)
	require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
		NewUserConfig(uid, NewNormalizedUsername("zoomua"), []byte("salt"), deviceID), true))

	start := time.Now()
	current, all, err := GetAllProvisionedUsernames(NewMetaContextForTest(tc))
	require.NoError(t, err)
	require.Less(t, time.Since(start), 200*time.Millisecond)
	require.Equal(t, NewNormalizedUsername("zoomua"), current)
	require.Equal(t, []NormalizedUsername{NewNormalizedUsername("zoomua")}, all)

	select {
	case <-hanging.started:
		t.Fatal("GetAllProvisionedUsernames must not call device/for_users")
	case <-time.After(50 * time.Millisecond):
	}
}
