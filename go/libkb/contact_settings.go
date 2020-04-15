package libkb

import (
	"github.com/keybase/client/go/protocol/keybase1"
)

type GetContactSettingsResponse struct {
	AppStatusEmbed
	Settings keybase1.ContactSettings `json:"settings"`
}

func GetContactSettings(mctx MetaContext) (ret keybase1.ContactSettings, err error) {
	defer mctx.Trace("GetContactSettings", &err)()
	apiArg := APIArg{
		Endpoint:    "account/contact_settings",
		SessionType: APISessionTypeREQUIRED,
	}
	var response GetContactSettingsResponse
	err = mctx.G().API.GetDecode(mctx, apiArg, &response)
	if err != nil {
		return ret, err
	}
	ret = response.Settings
	return ret, nil
}

func SetContactSettings(mctx MetaContext, arg keybase1.ContactSettings) (err error) {
	defer mctx.Trace("SetContactSettings", &err)()
	payload := make(JSONPayload)
	payload["settings"] = arg
	apiArg := APIArg{
		Endpoint:    "account/contact_settings",
		SessionType: APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}
