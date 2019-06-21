// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "fmt"

type SecretStoreFallbackBehavior int

const (
	SecretStoreFallbackBehaviorOnError SecretStoreFallbackBehavior = iota
	SecretStoreFallbackBehaviorAlways
	SecretStoreFallbackBehaviorNever
)

type SecretStoreUpgradeable struct {
	a                              SecretStoreAll
	labelA                         string
	b                              SecretStoreAll
	labelB                         string
	shouldUpgradeOpportunistically func() bool
	shouldStoreInFallback          func(*SecretStoreOptions) SecretStoreFallbackBehavior
	options                        *SecretStoreOptions
}

var _ SecretStoreAll = (*SecretStoreUpgradeable)(nil)

func NewSecretStoreUpgradeable(a, b SecretStoreAll, labelA, labelB string, shouldUpgradeOpportunistically func() bool, shouldStoreInFallback func(*SecretStoreOptions) SecretStoreFallbackBehavior) *SecretStoreUpgradeable {
	return &SecretStoreUpgradeable{
		a:                              a,
		labelA:                         labelA,
		b:                              b,
		labelB:                         labelB,
		shouldUpgradeOpportunistically: shouldUpgradeOpportunistically,
		shouldStoreInFallback:          shouldStoreInFallback,
	}
}

func (s *SecretStoreUpgradeable) RetrieveSecret(mctx MetaContext, username NormalizedUsername) (secret LKSecFullSecret, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("SecretStoreUpgradeable.RetrieveSecret(%s)", username),
		func() error { return err })()

	mctx.Debug("Trying to retrieve secret from primary store (%s)", s.labelA)
	secret, err1 := s.a.RetrieveSecret(mctx, username)
	if err1 == nil {
		// Found secret in primary store - return, we don't need to do anything
		// else here.
		mctx.Debug("Found secret in primary store (%s)", s.labelA)
		return secret, nil
	}

	mctx.Debug("Failed to find secret in primary store (%s): %s, falling back to %s.", s.labelA, err1, s.labelB)

	secret, err2 := s.b.RetrieveSecret(mctx, username)
	if err2 != nil {
		mctx.Debug("Failed to retrieve secret from secondary store (%s): %v", s.labelB, err2)
		// Do not return combined errors here. We want to return typed errors,
		// like: `SecretStoreError`. Secret store API consumers rely on error
		// types.
		return LKSecFullSecret{}, err2
	}

	shouldUpgrade := s.shouldUpgradeOpportunistically()
	fallbackBehavior := s.shouldStoreInFallback(s.options)
	mctx.Debug("Fallback settings are: shouldUpgrade: %t, fallbackBehavior: %v", shouldUpgrade, fallbackBehavior)
	if !shouldUpgrade || fallbackBehavior == SecretStoreFallbackBehaviorAlways {
		// Do not upgrade opportunistically, or we are still in Fallback Mode
		// ALWAYS and should exclusively use store B - do not try fall through
		// to try to store in A.
		mctx.Debug("Not trying to upgrade after retrieving from secondary store (%s)", s.labelB)
		return secret, nil
	}

	mctx.Debug("Secret found in secondary store (%s), trying to upgrade to primary store (%s)", s.labelB, s.labelA)

	storeAErr := s.a.StoreSecret(mctx, username, secret)
	if storeAErr == nil {
		mctx.Debug("Upgraded secret for %s to primary store (%s)", username, s.labelA)

		clearBErr := s.b.ClearSecret(mctx, username)
		mctx.Debug("After secret upgrade: clearSecret from secondary store (%s) returned: %v", s.labelA, clearBErr)
	} else {
		mctx.Debug("Failed to upgrade secret for %s to primary store (%s): %s", username, s.labelA, storeAErr)
	}
	return secret, nil
}

func (s *SecretStoreUpgradeable) StoreSecret(mctx MetaContext, username NormalizedUsername, secret LKSecFullSecret) (err error) {
	defer mctx.TraceTimed("SecretStoreUpgradeable.StoreSecret", func() error { return err })()

	fallbackBehavior := s.shouldStoreInFallback(s.options)
	if fallbackBehavior == SecretStoreFallbackBehaviorAlways {
		mctx.Debug("shouldStoreInFallback returned ALWAYS for options %+v, storing in secondary store (%s)", s.options, s.labelB)
		return s.b.StoreSecret(mctx, username, secret)
	}

	err1 := s.a.StoreSecret(mctx, username, secret)
	if err1 == nil {
		mctx.Debug("Stored secret for %s in primary store (%s), attempting clear for secondary store (%s)", username, s.labelA, s.labelB)
		clearBErr := s.b.ClearSecret(mctx, username)
		if clearBErr == nil {
			// Store may also return nil error when there was nothing to clear.
			mctx.Debug("ClearSecret error=<nil> for %s from secondary store (%s)", username, s.labelB)
		} else {
			mctx.Debug("Failed to clear secret for %s from secondary store (%s): %s", username, s.labelB, clearBErr)
		}
		return nil
	}

	if fallbackBehavior == SecretStoreFallbackBehaviorNever {
		mctx.Warning("Failed to reach system keyring (primary store (%s): %s), not falling back to secondary store (%s) because of fallback behavior.", s.labelA, err1, s.labelB)
		return err1
	}

	mctx.Warning("Failed to reach system keyring (primary store (%s): %s), falling back to secondary store (%s).", s.labelA, err1, s.labelB)
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
	if err1 != nil {
		mctx.Debug("Failed to clear secret in primary store (%s): %s", s.labelA, err1)
	}
	err2 := s.b.ClearSecret(mctx, username)
	if err2 != nil {
		mctx.Debug("Failed to clear secret in secondary store (%s): %s", s.labelB, err2)
	}
	// Only return an error if both failed
	if err1 != nil && err2 != nil {
		err := CombineErrors(err1, err2)
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
	} else {
		mctx.Debug("Failed to GetUsersWithStoredSecrets in primary store (%s): %s", s.labelA, err1)
	}
	usernamesB, err2 := s.b.GetUsersWithStoredSecrets(mctx)
	if err2 == nil {
		for _, u := range usernamesB {
			usernameMap[u] = true
		}
	} else {
		mctx.Debug("Failed to GetUsersWithStoredSecrets in secondary store (%s): %s", s.labelB, err2)
	}

	for username := range usernameMap {
		usernames = append(usernames, username)
	}

	err = CombineErrors(err1, err2)
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
