package libkb

import (
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

func getUsernameIfProvisioned(m MetaContext, uc UserConfig) (ret NormalizedUsername, err error) {
	m.Debug("getUsernameIfProvisioned(%+v)", uc)
	did := uc.GetDeviceID()
	if did.IsNil() {
		m.Debug("- no valid username since nil deviceID")
		return ret, nil
	}
	err = checkDeviceValidForUID(m.Ctx(), m.G().GetUPAKLoader(), uc.GetUID(), did)
	switch err.(type) {
	case nil:
		m.Debug("- checks out")
		return uc.GetUsername(), nil
	case DeviceNotFoundError:
		m.Debug("- user was likely reset (%s)", err)
		return ret, nil
	case KeyRevokedError:
		m.Debug("- device was revoked (%s)", err)
		return ret, nil
	case UserDeletedError:
		m.Debug(" - user was deleted (%s)", err)
		return ret, nil
	case NotFoundError:
		// This can happen in development if the dev db is nuked or a mobile
		// device is connected to dev servers.
		m.Debug(" - user wasn't found (%s)", err)
		return ret, nil
	default:
		m.Debug("- unexpected error; propagating (%s)", err)
		return ret, err
	}
}

type deviceForUsersRet struct {
	AppStatusEmbed
	UserConfigs []deviceForUser `json:"user_configs"`
}
type deviceForUser struct {
	UID      keybase1.UID       `json:"uid"`
	DeviceID keybase1.DeviceID  `json:"device_id"`
	OK       bool               `json:"ok"`
	Username NormalizedUsername `json:"username"`
}

// GetAllProvisionedUsernames looks into the current config.json file, and
// finds all usernames that are currently provisioned on this device. Then, it
// asks the server to filter out revoked devices or reset users.
func GetAllProvisionedUsernames(mctx MetaContext) (current NormalizedUsername, all []NormalizedUsername, err error) {
	mctx = mctx.WithLogTag("GAPU")
	defer mctx.Trace("GetAllProvisionedUsernames", func() error { return err })()

	currentUC, allUCs, err := mctx.G().Env.GetConfig().GetAllUserConfigs()
	if err != nil {
		return current, nil, err
	}

	var userConfigs []deviceForUser
	if currentUC != nil {
		userConfigs = append(userConfigs, deviceForUser{UID: currentUC.GetUID(), DeviceID: currentUC.GetDeviceID()})
	}
	for _, uc := range allUCs {
		userConfigs = append(userConfigs, deviceForUser{UID: uc.GetUID(), DeviceID: uc.GetDeviceID()})
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
	if err != nil {
		return "", nil, err
	}

	for _, userConfig := range resp.UserConfigs {
		if userConfig.OK {
			all = append(all, userConfig.Username)
			if userConfig.Username == currentUC.GetUsername() {
				current = userConfig.Username
			}
		}
	}

	return current, all, nil
}
