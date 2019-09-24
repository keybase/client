package libkb

func (m MetaContext) Logout() (err error) {
	m = m.WithLogTag("LOGOUT")
	defer m.Trace("GlobalContext#Logout", func() error { return err })()
	return m.LogoutCurrentUserWithSecretKill(true /* killSecrets */)
}

func (m MetaContext) ClearStateForSwitchUsers() (err error) {
	return m.LogoutCurrentUserWithSecretKill(false /* killSecrets */)
}

func (m MetaContext) LogoutCurrentUserWithSecretKill(killSecrets bool) error {
	return m.LogoutUsernameWithSecretKill(m.ActiveDevice().Username(m), killSecrets)
}

func (m MetaContext) LogoutUsernameWithSecretKill(username NormalizedUsername, killSecrets bool) (err error) {

	g := m.G()
	defer g.switchUserMu.Acquire(m, "Logout")()

	m.Debug("GlobalContext#logoutWithSecretKill: after switchUserMu acquisition (username: %s, secretKill: %v)", username, killSecrets)

	var keychainMode KeychainMode
	keychainMode, err = g.ActiveDevice.ClearGetKeychainMode()
	if err != nil {
		return err
	}

	g.LocalSigchainGuard().Clear(m.Ctx(), "Logout")

	m.Debug("+ GlobalContext#logoutWithSecretKill: calling logout hooks")
	g.CallLogoutHooks(m)
	m.Debug("- GlobalContext#logoutWithSecretKill: called logout hooks")

	g.ClearPerUserKeyring()

	// NB: This will acquire and release the cacheMu lock, so we have to make
	// sure nothing holding a cacheMu ever looks for the switchUserMu lock.
	g.FlushCaches()

	if keychainMode == KeychainModeOS {
		m.logoutSecretStore(username, killSecrets)
	} else {
		m.Debug("Not clearing secret store in mode %d", keychainMode)
	}

	// reload config to clear anything in memory
	if err := g.ConfigReload(); err != nil {
		m.Debug("Logout ConfigReload error: %s", err)
	}

	// send logout notification
	g.NotifyRouter.HandleLogout(m.Ctx())

	g.FeatureFlags.Clear()

	g.IdentifyDispatch.OnLogout()

	g.Identify3State.OnLogout()

	err = g.GetUPAKLoader().OnLogout()
	if err != nil {
		return err
	}

	g.Pegboard.OnLogout(m)

	return nil
}

func (m MetaContext) logoutSecretStore(username NormalizedUsername, killSecrets bool) {

	g := m.G()
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()

	if g.secretStore == nil || username.IsNil() {
		return
	}

	if !killSecrets {
		g.switchedUsers[username] = true
		return
	}

	if err := g.secretStore.ClearSecret(m, username); err != nil {
		m.Debug("clear stored secret error: %s", err)
		return
	}

	// If this user had previously switched into his account and wound up in the
	// g.switchedUsers map (see just above), then now it's fine to delete them,
	// since they are deleted from the secret store successfully.
	delete(g.switchedUsers, username)
}

// LogoutSelfCheck checks with the API server to see if this uid+device pair should
// logout.
func (m MetaContext) LogoutSelfCheck() error {
	g := m.G()
	uid := g.ActiveDevice.UID()
	if uid.IsNil() {
		m.Debug("LogoutSelfCheck: no uid")
		return nil
	}
	deviceID := g.ActiveDevice.DeviceID()
	if deviceID.IsNil() {
		m.Debug("LogoutSelfCheck: no device id")
		return nil
	}

	arg := APIArg{
		Endpoint: "selfcheck",
		Args: HTTPArgs{
			"uid":       S{Val: uid.String()},
			"device_id": S{Val: deviceID.String()},
		},
		SessionType: APISessionTypeREQUIRED,
	}
	res, err := g.API.Post(m, arg)
	if err != nil {
		return err
	}

	logout, err := res.Body.AtKey("logout").GetBool()
	if err != nil {
		return err
	}

	m.Debug("LogoutSelfCheck: should log out? %v", logout)
	if logout {
		m.Debug("LogoutSelfCheck: logging out...")
		return m.Logout()
	}

	return nil
}
