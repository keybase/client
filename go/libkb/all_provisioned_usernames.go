package libkb

// GetAllProvisionedUsernames looks into the current config.json file and
// returns every username provisioned on this device.
//
// This is local on purpose so the switcher and logged-out picker are not
// gated on device/for_users. LogoutAndDeprovisionIfRevoked still covers the
// active session. A reset or revoked *other* account stays in the list until
// that user tries to log in and deprovision runs.
func GetAllProvisionedUsernames(mctx MetaContext) (current NormalizedUsername, all []NormalizedUsername, err error) {
	mctx = mctx.WithLogTag("GAPU")
	defer mctx.Trace("GetAllProvisionedUsernames", &err)()

	currentUC, otherUCs, err := mctx.G().Env.GetConfig().GetAllUserConfigs()
	if err != nil {
		return current, nil, err
	}

	if currentUC != nil && !currentUC.GetUsername().IsNil() {
		current = currentUC.GetUsername()
		all = append(all, current)
	}
	for i := range otherUCs {
		nu := otherUCs[i].GetUsername()
		if !nu.IsNil() {
			all = append(all, nu)
		}
	}
	if len(all) == 0 {
		mctx.Debug("GAPU: no userConfigs to lookup")
	}
	return current, all, nil
}
