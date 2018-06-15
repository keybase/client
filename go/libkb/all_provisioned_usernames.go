package libkb

func getUsernameIfProvisioned(m MetaContext, uc UserConfig) (ret NormalizedUsername, err error) {
	m.CDebugf("getUsernameIfProvisioned(%+v)", uc)
	did := uc.GetDeviceID()
	if did.IsNil() {
		m.CDebugf("- no valid username since nil deviceID")
		return ret, nil
	}
	err = checkDeviceValidForUID(m.Ctx(), m.G().GetUPAKLoader(), uc.GetUID(), did)
	switch err.(type) {
	case nil:
		m.CDebugf("- checks out")
		return uc.GetUsername(), nil
	case DeviceNotFoundError:
		m.CDebugf("- user was likely reset (%s)", err)
		return ret, nil
	case KeyRevokedError:
		m.CDebugf("- device was revoked (s)", err)
		return ret, nil
	default:
		m.CDebugf("- unexpected error; propagating (%s)", err)
		return ret, err
	}
}

// GetAllProvisionedUsernames looks into the current config.json file, and finds all usernames
// that are currently provisioned on this device. That is, it filters out those that are on revoked
// devices or have reset their accounts. It uses UPAK loading for verifying the current user/device
// statuses, so should be fast if everything is cached recently.
func GetAllProvisionedUsernames(m MetaContext) (current NormalizedUsername, all []NormalizedUsername, err error) {

	m = m.WithLogTag("GAPU")
	defer m.CTrace("GetAllProvisionedUsernames", func() error { return err })()

	currentUC, allUCs, err := m.G().Env.GetConfig().GetAllUserConfigs()
	if err != nil {
		return current, nil, err
	}

	if currentUC != nil {
		current, err = getUsernameIfProvisioned(m, *currentUC)
		if err != nil {
			return current, nil, err
		}
	}

	for _, u := range allUCs {
		tmp, err := getUsernameIfProvisioned(m, u)
		if err != nil {
			return current, nil, err
		}
		if !tmp.IsNil() {
			all = append(all, tmp)
		}
	}

	return current, all, nil
}
