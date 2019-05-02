package chat

import (
	"context"
	"strconv"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const disablePlaintextDesktopKey = "disableplaintextdesktop"

func setPlaintextDesktopDisabled(ctx context.Context, g *globals.Context, disabled bool) error {
	_, err := g.GregorState.UpdateCategory(ctx, disablePlaintextDesktopKey,
		[]byte(strconv.FormatBool(disabled)), gregor1.TimeOrOffset{})
	return err
}

func getPlaintextDesktopDisabled(ctx context.Context, g *globals.Context) (bool, error) {
	st, err := g.GregorState.State(ctx)
	if err != nil {
		return false, err
	}
	cat, err := gregor1.ObjFactory{}.MakeCategory(disablePlaintextDesktopKey)
	if err != nil {
		return false, err
	}
	items, err := st.ItemsWithCategoryPrefix(cat)
	if err != nil {
		return false, err
	}
	if len(items) > 0 {
		it := items[0]
		body := string(it.Body().Bytes())
		return strconv.ParseBool(body)
	}
	return false, nil
}

func getGlobalAppNotificationSettings(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface) (
	res chat1.GlobalAppNotificationSettings, err error) {
	settings, err := ri().GetGlobalAppNotificationSettings(ctx)
	if err != nil {
		return res, err
	}
	plaintextDesktopDisabled, err := getPlaintextDesktopDisabled(ctx, g)
	if err != nil {
		return res, err
	}

	settings.Settings[chat1.GlobalAppNotificationSetting_PLAINTEXTDESKTOP] = !plaintextDesktopDisabled
	return settings, nil
}

func setGlobalAppNotificationSettings(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface,
	strSettings map[string]bool) error {

	var settings chat1.GlobalAppNotificationSettings
	settings.Settings = make(map[chat1.GlobalAppNotificationSetting]bool)
	for k, v := range strSettings {
		key, err := strconv.Atoi(k)
		if err != nil {
			g.Log.CDebugf(ctx, "setGlobalAppNotificationSettings: failed to convert key: %s", err.Error())
			continue
		}
		gkey := chat1.GlobalAppNotificationSetting(key)
		g.Log.CDebugf(ctx, "setGlobalAppNotificationSettings: setting typ: %s enabled: %v",
			chat1.GlobalAppNotificationSettingRevMap[gkey], v)
		switch gkey {
		case chat1.GlobalAppNotificationSetting_PLAINTEXTDESKTOP:
			if err := setPlaintextDesktopDisabled(ctx, g, !v); err != nil {
				return err
			}
		default:
			settings.Settings[gkey] = v
		}
	}
	if len(settings.Settings) == 0 {
		return nil
	}
	return ri().SetGlobalAppNotificationSettings(ctx, settings)
}
