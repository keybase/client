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
		a: a,
		b: b,
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
	secret, err2 := s.b.RetrieveSecret(mctx, username)
	if !s.shouldUpgradeOpportunistically() {
		return secret, err2
	}

	if err2 == nil {
		storeAErr := s.a.StoreSecret(mctx, username, secret)
		if storeAErr == nil {
			mctx.Debug("Upgraded secret for %s to secretstore a", username)
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
		return s.b.StoreSecret(mctx, username, secret)
	}

	err1 := s.a.StoreSecret(mctx, username, secret)
	if err1 == nil {
		clearBErr := s.b.ClearSecret(mctx, username)
		if clearBErr == nil {
			mctx.Debug("Cleared secret for %s from secretstore b", username)
		} else {
			mctx.Debug("Failed to clear secret for %s from secretstore b: %s", username, clearBErr)
		}
		return nil
	}

	mctx.Warning("Failed to reach system keyring (%s), falling back to file-based secret store.", err1)
	err2 := s.b.StoreSecret(mctx, username, secret)
	if err2 == nil {
		return nil
	}
	err = CombineErrors(err1, err2)
	return err
}

func (s *SecretStoreUpgradeable) ClearSecret(mctx MetaContext, username NormalizedUsername) (err error) {
	defer mctx.TraceTimed("SecretStoreUpgradeable.ClearSecret", func() error { return err })()
	return CombineErrors(s.a.ClearSecret(mctx, username), s.b.ClearSecret(mctx, username))
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
	return usernames, err
}

func (s *SecretStoreUpgradeable) GetOptions(MetaContext) *SecretStoreOptions { return nil }
func (s *SecretStoreUpgradeable) SetOptions(MetaContext, SecretStoreOptions) {}
