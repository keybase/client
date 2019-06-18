// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux,!android

package libkb

func NewSecretStoreAll(mctx MetaContext) SecretStoreAll {
	g := mctx.G()
	sfile := NewSecretStoreFile(g.Env.GetDataDir())
	sfile.notifyCreate = func(name NormalizedUsername) { notifySecretStoreCreate(g, name) }
	ssecretservice := NewSecretStoreRevokableSecretService()

	if mctx.G().Env.GetForceLinuxKeyring() {
		return ssecretservice
	}

	if mctx.G().Env.ForceSecretStoreFile() {
		return sfile
	}

	shouldUpgradeOpportunistically := func() bool {
		return false
	}
	shouldStoreInFallback := func(options *SecretStoreOptions) SecretStoreFallbackBehavior {
		if options != nil && options.RandomPw {
			// With RandomPW, always fallback to file based secret store (safer
			// choice on Linux).
			return SecretStoreFallbackBehaviorAlways
		}
		// Use system keychain but fall back to file store if not available.
		return SecretStoreFallbackBehaviorOnError
	}
	return NewSecretStoreUpgradeable(ssecretservice, sfile, shouldUpgradeOpportunistically, shouldStoreInFallback)
}
