package libkb

import (
	"time"

	"github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

type deviceForUsersRet struct {
	AppStatusEmbed
	UserConfigs []deviceForUser `json:"user_configs"`
}
type deviceForUser struct {
	UID      keybase1.UID      `json:"uid"`
	DeviceID keybase1.DeviceID `json:"device_id"`
	OK       bool              `json:"ok"`
	Username string            `json:"username"`
}

// GetAllProvisionedUsernames looks into the current config.json file, and
// finds all usernames that are currently provisioned on this device. Then, it
// asks the server to filter out revoked devices or reset users.
func GetAllProvisionedUsernames(mctx MetaContext) (current NormalizedUsername, all []NormalizedUsername, err error) {
	mctx = mctx.WithLogTag("GAPU")
	defer mctx.Trace("GetAllProvisionedUsernames", &err)()

	currentUC, otherUCs, err := mctx.G().Env.GetConfig().GetAllUserConfigs()
	if err != nil {
		return current, nil, err
	}

	var userConfigs []deviceForUser
	if currentUC != nil {
		userConfigs = append(userConfigs, deviceForUser{UID: currentUC.GetUID(), DeviceID: currentUC.GetDeviceID()})
	}
	for _, uc := range otherUCs {
		userConfigs = append(userConfigs, deviceForUser{UID: uc.GetUID(), DeviceID: uc.GetDeviceID()})
	}

	if len(userConfigs) == 0 {
		mctx.Debug("GAPU: no userConfigs to lookup")
		return current, nil, nil
	}

	payload := make(JSONPayload)
	payload["user_configs"] = userConfigs
	arg := APIArg{
		Endpoint:       "device/for_users",
		JSONPayload:    payload,
		SessionType:    APISessionTypeNONE,
		InitialTimeout: 5 * time.Second,
		RetryCount:     3,
	}

	resp := deviceForUsersRet{}
	err = mctx.G().API.PostDecode(mctx, arg, &resp)
	var configsForReturn []deviceForUser
	if _, ok := err.(APINetError); ok {
		// We got a network error but we can still return offline results.
		mctx.Info("Failed to check server for revoked in GAPU: %+v", err)
		// Put together a fake response from the offline data:
		if currentUC != nil {
			configsForReturn = append(configsForReturn, deviceForUser{Username: string(currentUC.Name), OK: true})
		}
		for _, uc := range otherUCs {
			configsForReturn = append(configsForReturn, deviceForUser{Username: string(uc.Name), OK: true})
		}
	} else if err != nil {
		return "", nil, err
	} else {
		configsForReturn = resp.UserConfigs
	}

	for _, userConfig := range configsForReturn {
		if userConfig.OK {
			nu := kbun.NewNormalizedUsername(userConfig.Username)
			all = append(all, nu)
			if currentUC != nil && nu == currentUC.GetUsername() {
				current = nu
			}
		}
	}

	return current, all, nil
}
