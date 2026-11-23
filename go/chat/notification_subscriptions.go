package chat

import (
	"context"
	"fmt"
	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type subscriptionsResponse struct {
	libkb.AppStatusEmbed
	Notifications map[string]struct {
		Settings []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Subscribed  bool   `json:"subscribed"`
		} `json:"settings"`
		Unsub bool `json:"unsub"`
	} `json:"notifications"`
}

// subscriptionGroups returns the server's groups sorted by name.
func (r subscriptionsResponse) subscriptionGroups() (res []chat1.NotificationSubscriptionGroup) {
	for name, group := range r.Notifications {
		settings := make([]chat1.NotificationSubscription, 0, len(group.Settings))
		for _, s := range group.Settings {
			settings = append(settings, chat1.NotificationSubscription{
				Name:        s.Name,
				Description: s.Description,
				Subscribed:  s.Subscribed,
			})
		}
		res = append(res, chat1.NotificationSubscriptionGroup{
			Name:     name,
			Settings: settings,
			Unsub:    group.Unsub,
		})
	}
	sort.Slice(res, func(i, j int) bool { return res[i].Name < res[j].Name })
	return res
}

// subscribePayload is the account/subscribe body: a "setting|group" key per
// setting and an "unsub|group" key per group, each 1 or 0.
func subscribePayload(groups []chat1.NotificationSubscriptionGroup) libkb.JSONPayload {
	flag := func(b bool) int {
		if b {
			return 1
		}
		return 0
	}
	payload := make(libkb.JSONPayload)
	for _, group := range groups {
		for _, s := range group.Settings {
			payload[fmt.Sprintf("%s|%s", s.Name, group.Name)] = flag(s.Subscribed)
		}
		payload[fmt.Sprintf("unsub|%s", group.Name)] = flag(group.Unsub)
	}
	return payload
}

func getNotificationSettings(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface) (
	res chat1.NotificationSettingsLocal, err error,
) {
	mctx := libkb.NewMetaContext(ctx, g.ExternalG())
	var subs subscriptionsResponse
	if err := mctx.G().API.GetDecode(mctx, libkb.APIArg{
		Endpoint:    "account/subscriptions",
		SessionType: libkb.APISessionTypeREQUIRED,
	}, &subs); err != nil {
		return res, err
	}
	chatGlobal, err := getGlobalAppNotificationSettings(ctx, g, ri)
	if err != nil {
		return res, err
	}
	return chat1.NotificationSettingsLocal{
		Subscriptions: subs.subscriptionGroups(),
		ChatGlobal:    chatGlobal,
	}, nil
}

func setNotificationSettings(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface,
	arg chat1.SetNotificationSettingsLocalArg,
) error {
	mctx := libkb.NewMetaContext(ctx, g.ExternalG())
	if _, err := mctx.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "account/subscribe",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: subscribePayload(arg.Subscriptions),
	}); err != nil {
		return err
	}
	return setGlobalAppNotificationSettings(ctx, g, ri, arg.ChatGlobal)
}
