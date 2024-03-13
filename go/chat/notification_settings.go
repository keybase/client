package chat

import (
	"context"
	"strconv"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
)

func getGlobalAppNotificationSettings(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface) (
	res chat1.GlobalAppNotificationSettings, err error) {
	settings, err := ri().GetGlobalAppNotificationSettings(ctx)
	if err != nil {
		return res, err
	}
	plaintextDesktopDisabled, err := utils.GetGregorBool(ctx, g, utils.DisablePlaintextDesktopGregorKey, false)
	if err != nil {
		return res, err
	}
	settings.Settings[chat1.GlobalAppNotificationSetting_PLAINTEXTDESKTOP] = !plaintextDesktopDisabled

	convertHeic, err := utils.GetGregorBool(ctx, g, utils.ConvertHEICGregorKey, true)
	if err != nil {
		return res, err
	}
	settings.Settings[chat1.GlobalAppNotificationSetting_CONVERTHEIC] = convertHeic
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
			err = utils.SetGregorBool(ctx, g, utils.DisablePlaintextDesktopGregorKey, !v)
			if err != nil {
				return err
			}
		case chat1.GlobalAppNotificationSetting_CONVERTHEIC:
			err = utils.SetGregorBool(ctx, g, utils.ConvertHEICGregorKey, v)
			if err != nil {
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
