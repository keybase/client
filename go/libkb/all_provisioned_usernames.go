package libkb

// GetAllProvisionedUsernames looks into the current config.json file and
// returns every username provisioned on this device.
//
// This is intentionally local. The account list only feeds the switcher and
// the logged-out picker; both must render from disk the way logged-in startup
// already does, without waiting on device/for_users. Revoked sessions for the
// active user are still handled by LogoutAndDeprovisionIfRevoked.
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
