package chat

import (
	"encoding/json"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

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
