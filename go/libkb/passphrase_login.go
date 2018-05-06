package libkb

import ()

func pplPromptCheckPreconditions(m MetaContext, usernameOrEmail string) (err error) {

	if m.LoginContext() == nil {
		return InternalError{"PassphraseLoginPrompt: need a non-nil LoginContext"}
	}
	if m.UIs().SecretUI == nil {
		return NoUIError{"seret"}
	}
	if m.UIs().LoginUI == nil && len(usernameOrEmail) == 0 {
		return NoUIError{"login"}
	}
	return nil
}

func pplGetEmailOrUsername(m MetaContext, usernameOrEmail string) (string, error) {
	var err error

	if len(usernameOrEmail) > 0 {
		return usernameOrEmail, nil
	}
	usernameOrEmail, err = m.UIs().LoginUI.GetEmailOrUsername(m.Ctx(), 0)
	if err != nil {
		return "", err
	}
	if len(usernameOrEmail) == 0 {
		return "", NoUsernameError{}
	}
	return usernameOrEmail, nil
}

func pplGetLoginSession(m MetaContext, usernameOrEmail string) (*LoginSession, error) {
	ret := NewLoginSession(m.G(), usernameOrEmail)
	err := ret.Load(m)
	if err != nil {
		ret = nil
	}
	return ret, err
}

func pplPromptOnce(m MetaContext, usernameOrEmail string, ls *LoginSession, retryMsg string) (err error) {
	defer m.CTrace("pplPromptOnce", func() error { return err })()
	res, err := GetKeybasePassphrase(m, m.UIs().SecretUI, usernameOrEmail, retryMsg)
	if err != nil {
		return err
	}
	salt := ls.salt
	_, pps, err := StretchPassphrase(m.G(), res.Passphrase, ls.salt)
	if err != nil {
		return err
	}
	lp, err := ComputeLoginPackage(m, usernameOrEmail)
	if err != nil {
		return err
	}
	_, err = computeLoginPackageFromEmailOrUsername(usernameOrEmail, pps, ls)
	if err != nil {
		return err
	}

	return nil
}

func pplPromptLoop(m MetaContext, usernameOrEmail string, maxAttempts int, ls *LoginSession) (err error) {
	defer m.CTrace("pplPromptLoop", func() error { return err })()
	retryMsg := ""
	for i := 0; i < maxAttempts; i++ {
		if err = pplPromptOnce(m, usernameOrEmail, ls, retryMsg); err == nil {
			return nil
		}
		if _, badpw := err.(PassphraseError); !badpw {
			return err
		}
		retryMsg = err.Error()
	}
	return err
}

func PassphraseLoginPrompt(m MetaContext, usernameOrEmail string, maxAttempts int) (err error) {

	defer m.CTrace("PassphraseLoginPrompt", func() error { return err })()

	var loginSession *LoginSession

	if err = pplPromptCheckPreconditions(m, usernameOrEmail); err != nil {
		return err
	}
	if usernameOrEmail, err = pplGetEmailOrUsername(m, usernameOrEmail); err != nil {
		return err
	}
	if loginSession, err = pplGetLoginSession(m, usernameOrEmail); err != nil {
		return err
	}
	if err = pplPromptLoop(m, usernameOrEmail, maxAttempts, loginSession); err != nil {
		return err
	}
	return nil
}
