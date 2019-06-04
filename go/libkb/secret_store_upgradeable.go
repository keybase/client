package libkb

type SecretStoreUpgradeable struct {
	a                              SecretStoreAll
	b                              SecretStoreAll
	shouldUpgradeOpportunistically func() bool
	shouldStoreInFallback          func(*SecretStoreOptions) bool
	options                        *SecretStoreOptions
}

var _ SecretStoreAll = (*SecretStoreUpgradeable)(nil)

func NewSecretStoreUpgradeable(a, b SecretStoreAll, shouldUpgradeOpportunistically func() bool, shouldStoreInFallback func(*SecretStoreOptions) bool) *SecretStoreUpgradeable {
	return &SecretStoreUpgradeable{
		a:                              a,
		b:                              b,
		shouldUpgradeOpportunistically: shouldUpgradeOpportunistically,
		shouldStoreInFallback:          shouldStoreInFallback,
	}
}

func (s *SecretStoreUpgradeable) RetrieveSecret(mctx MetaContext, username NormalizedUsername) (secret LKSecFullSecret, err error) {
	defer mctx.TraceTimed("SecretStoreUpgradeable.RetrieveSecret", func() error { return err })()
	secret, err1 := s.a.RetrieveSecret(mctx, username)
	if err1 == nil {
		return secret, nil
	}

	mctx.Debug("Failed to find secret in system keyring (%s), falling back to file-based secret store.", err1)
	secret, err2 := s.b.RetrieveSecret(mctx, username)
	if !s.shouldUpgradeOpportunistically() || s.shouldStoreInFallback(s.options) {
		// Do not upgrade opportunistically, or we are still in fallback mode
		// and should exclusively use store B - do not try fall through to try
		// to store in A.
		return secret, err2
	}

	if err2 == nil {
		storeAErr := s.a.StoreSecret(mctx, username, secret)
		if storeAErr == nil {
			mctx.Debug("Upgraded secret for %s to secretstore a", username)

			clearBErr := s.b.ClearSecret(mctx, username)
			mctx.Debug("After secret upgrade: clearSecret from store B returned: %v", clearBErr)
		} else {
			mctx.Debug("Failed to upgrade secret for %s to secretstore a: %s", username, storeAErr)
		}
		return secret, nil
	}
	err = CombineErrors(err1, err2)
	return LKSecFullSecret{}, err
}

func (s *SecretStoreUpgradeable) StoreSecret(mctx MetaContext, username NormalizedUsername, secret LKSecFullSecret) (err error) {
	defer mctx.TraceTimed("SecretStoreUpgradeable.StoreSecret", func() error { return err })()

	if s.shouldStoreInFallback(s.options) {
		mctx.Debug("shouldStoreInFallback returned true for options %v, storing in store B", s.options)
		return s.b.StoreSecret(mctx, username, secret)
	}

	err1 := s.a.StoreSecret(mctx, username, secret)
	if err1 == nil {
		mctx.Debug("Stored secret for %s in store A, attempting clear for store B", username)
		clearBErr := s.b.ClearSecret(mctx, username)
		if clearBErr == nil {
			// Store may also return nil error when there was nothing to clear.
			mctx.Debug("ClearSecret error=<nil> for %s from store B", username)
		} else {
			mctx.Debug("Failed to clear secret for %s from secretstore b: %s", username, clearBErr)
		}
		return nil
	}

	mctx.Warning("Failed to reach system keyring (store A: %s), falling back to file-based secret store (store B).", err1)
	err2 := s.b.StoreSecret(mctx, username, secret)
	if err2 == nil {
		return nil
	}
	err = CombineErrors(err1, err2)
	return err
}

func (s *SecretStoreUpgradeable) ClearSecret(mctx MetaContext, username NormalizedUsername) (err error) {
	defer mctx.TraceTimed("SecretStoreUpgradeable.ClearSecret", func() error { return err })()
	err1 := s.a.ClearSecret(mctx, username)
	err2 := s.b.ClearSecret(mctx, username)
	err = CombineErrors(err1, err2)
	if err != nil {
		mctx.Debug("Failed to clear secret in at least one store: %s", err)
	}
	// Only return an error if both failed
	if err1 != nil && err2 != nil {
		return err
	}
	return nil
}

func (s *SecretStoreUpgradeable) GetUsersWithStoredSecrets(mctx MetaContext) (usernames []string, err error) {
	defer mctx.TraceTimed("SecretStoreUpgradeable.GetUsersWithStoredSecrets", func() error { return err })()
	usernameMap := make(map[string]bool)
	usernamesA, err1 := s.a.GetUsersWithStoredSecrets(mctx)
	if err1 == nil {
		for _, u := range usernamesA {
			usernameMap[u] = true
		}
	}
	usernamesB, err2 := s.b.GetUsersWithStoredSecrets(mctx)
	if err2 == nil {
		for _, u := range usernamesB {
			usernameMap[u] = true
		}
	}
	for username := range usernameMap {
		usernames = append(usernames, username)
	}

	err = CombineErrors(err1, err2)
	if err != nil {
		mctx.Debug("Failed to GetUsersWithStoredSecrets in at least one store: %s", err)
	}
	// Only return an error if both failed
	if err1 != nil && err2 != nil {
		return nil, err
	}
	return usernames, nil
}

func (s *SecretStoreUpgradeable) GetOptions(MetaContext) *SecretStoreOptions { return s.options }
func (s *SecretStoreUpgradeable) SetOptions(_ MetaContext, options *SecretStoreOptions) {
	s.options = options
}
