// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package libkb

func NewSecretStoreAll(mctx MetaContext) SecretStoreAll {
	secFile := NewSecretStoreFile(mctx.G().Env.GetDataDir())
	// Note: do not set up notifySecretStoreCreate for secret store file on
	// Android, as it's only related to relevant to PGP key management.

	if mctx.G().Env.ForceSecretStoreFile() {
		// Allow use of file secret store on Android, for debugging or use with
		// Termux (https://termux.com/).
		return secFile
	}

	secAndroid := &secretStoreAndroid{}

	shouldUpgradeOpportunistically := func() bool {
		return false
	}
	shouldStoreInFallback := func(options *SecretStoreOptions) bool {
		return false
	}
	return NewSecretStoreUpgradeable(secAndroid, secFile,
		shouldUpgradeOpportunistically, shouldStoreInFallback)
}
