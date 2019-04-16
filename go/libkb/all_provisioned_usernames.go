package libkb

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

// GetAllProvisionedUsernames looks into the current config.json file, and finds all usernames
// that are currently provisioned on this device. That is, it filters out those that are on revoked
// devices or have reset their accounts. It uses UPAK loading for verifying the current user/device
// statuses, so should be fast if everything is cached recently.
func GetAllProvisionedUsernames(m MetaContext) (current NormalizedUsername, all []NormalizedUsername, err error) {

	m = m.WithLogTag("GAPU")
	defer m.Trace("GetAllProvisionedUsernames", func() error { return err })()

	currentUC, allUCs, err := m.G().Env.GetConfig().GetAllUserConfigs()
	if err != nil {
		return current, nil, err
	}

	if currentUC != nil {
		current, err = getUsernameIfProvisioned(m, *currentUC)
		if err != nil {
			m.Error("Error while checking user %q uid=%q, `current` will be nil", currentUC.GetUsername(), currentUC.GetUID())
		}
	}

	for _, uc := range allUCs {
		tmp, err := getUsernameIfProvisioned(m, uc)
		if err != nil {
			m.Error("Error while checking user %q uid=%q, skipping", uc.GetUsername(), uc.GetUID())
			continue
		}
		if !tmp.IsNil() {
			all = append(all, tmp)
		}
	}

	return current, all, nil
}
