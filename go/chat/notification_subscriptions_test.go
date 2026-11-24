package chat

import (
	"context"
	"encoding/json"
	"strconv"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// setActiveUserForTest makes username the active device's user, with keys, and
// returns its chat uid.
func setActiveUserForTest(t *testing.T, tc libkb.TestContext, username libkb.NormalizedUsername) gregor1.UID {
	require.NoError(t, tc.G.ActiveDevice.Clear())
	uid := libkb.UsernameToUID(username.String())
	deviceID, err := libkb.NewDeviceID()
	require.NoError(t, err)
	sigKey, err := libkb.GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	encKey, err := libkb.GenerateNaclDHKeyPair()
	require.NoError(t, err)
	require.NoError(t, tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc),
		keybase1.UserVersion{Uid: uid, EldestSeqno: 1}, deviceID, sigKey, encKey, "testuser-mac", 0,
		libkb.KeychainModeNone))
	require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
		libkb.NewUserConfig(uid, username, nil, deviceID), true))
	return gregor1.UID(uid.ToBytes())
}

// subscribeAPI stands in for the API server's account/subscribe endpoint.
type subscribeAPI struct {
	libkb.API
	onPost func()
}

func (a *subscribeAPI) PostJSON(libkb.MetaContext, libkb.APIArg) (*libkb.APIRes, error) {
	a.onPost()
	return &libkb.APIRes{}, nil
}

// globalSettingsRemote records the chat server's global settings writes.
type globalSettingsRemote struct {
	chat1.RemoteInterface
	saved []chat1.GlobalAppNotificationSettings
}

func (r *globalSettingsRemote) SetGlobalAppNotificationSettings(_ context.Context, s chat1.GlobalAppNotificationSettings) error {
	r.saved = append(r.saved, s)
	return nil
}

func TestSetNotificationSettingsStopsOnAccountSwitch(t *testing.T) {
	tc := libkb.SetupTest(t, "SetNotificationSettingsAccountSwitch", 0)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	remote := &globalSettingsRemote{}
	ri := func() chat1.RemoteInterface { return remote }
	arg := chat1.SetNotificationSettingsLocalArg{
		ChatGlobal: map[string]bool{strconv.Itoa(int(chat1.GlobalAppNotificationSetting_PLAINTEXTMOBILE)): true},
	}
	uid := setActiveUserForTest(t, tc, "testuser")

	tc.G.API = &subscribeAPI{onPost: func() {}}
	require.NoError(t, setNotificationSettings(context.TODO(), g, ri, uid, arg))
	require.Len(t, remote.saved, 1)

	// another account becomes active while the subscriptions save
	tc.G.API = &subscribeAPI{onPost: func() { setActiveUserForTest(t, tc, "testuser2") }}
	require.Error(t, setNotificationSettings(context.TODO(), g, ri, uid, arg))
	require.Len(t, remote.saved, 1, "testuser's chat settings were written while testuser2 was active")

	// another account is already active when the save starts: nothing is posted for it
	posted := false
	tc.G.API = &subscribeAPI{onPost: func() { posted = true }}
	require.Error(t, setNotificationSettings(context.TODO(), g, ri, uid, arg))
	require.False(t, posted, "testuser's subscriptions were posted while testuser2 was active")
	require.Len(t, remote.saved, 1)
}

func TestNotificationSubscriptionGroupsFromServer(t *testing.T) {
	body := `{
		"status": {"code": 0},
		"notifications": {
			"email": {
				"settings": [
					{"name": "newmessages", "description": "New messages", "description_h": "x", "subscribed": true},
					{"name": "followers", "description": "Followers", "description_h": "y", "subscribed": false}
				],
				"unsub": false
			},
			"app_push": {
				"settings": [{"name": "newmessages", "description": "Chat", "subscribed": false}],
				"unsub": true
			}
		}
	}`
	var res subscriptionsResponse
	require.NoError(t, json.Unmarshal([]byte(body), &res))
	require.Equal(t, []chat1.NotificationSubscriptionGroup{
		{
			Name:     "app_push",
			Settings: []chat1.NotificationSubscription{{Name: "newmessages", Description: "Chat"}},
			Unsub:    true,
		},
		{
			Name: "email",
			Settings: []chat1.NotificationSubscription{
				{Name: "newmessages", Description: "New messages", Subscribed: true},
				{Name: "followers", Description: "Followers"},
			},
		},
	}, res.subscriptionGroups())
}

func TestNotificationSubscribePayload(t *testing.T) {
	require.Equal(t, libkb.JSONPayload{
		"newmessages|email":    1,
		"followers|email":      0,
		"unsub|email":          0,
		"newmessages|app_push": 0,
		"unsub|app_push":       1,
	}, subscribePayload([]chat1.NotificationSubscriptionGroup{
		{
			Name: "email",
			Settings: []chat1.NotificationSubscription{
				{Name: "newmessages", Subscribed: true},
				{Name: "followers"},
			},
		},
		{
			Name:     "app_push",
			Settings: []chat1.NotificationSubscription{{Name: "newmessages"}},
			Unsub:    true,
		},
	}))
}
