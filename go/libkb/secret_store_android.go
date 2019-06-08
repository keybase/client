// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package libkb

import "strconv"

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

	var androidOsVersion int64
	if v, err := strconv.ParseInt(mctx.G().MobileOsVersion, 10, 32); err != nil {
		androidOsVersion = v
	} else {
		mctx.Debug("Unable to figure out Android version. MobileOsVersion is: %s, errors was: %s",
			mctx.G().MobileOsVersion, err)
	}

	shouldUpgradeOpportunistically := func() bool {
		return true
	}
	shouldStoreInFallback := func(options *SecretStoreOptions) SecretStoreFallbackBehavior {
		if androidOsVersion <= 22 {
			// Use file based secret store on old Android version (22 or less)
			// or when Android version is unknown (0). Not detecting Android
			// version properly would be highly unusual - either a bug in our
			// binding code (where we pass MobileOsVersion), or some custom
			// operating system that did not report its version properly
			// thorugh the API that we use.

			// Do not even try to use external secret store (so no
			// SecretStoreFallbackBehaviorOnError) - we've found that on older
			// systems, secret store would often work for some time and then
			// start failing with errors. That could leave users stuck.

			return SecretStoreFallbackBehaviorAlways
		}

		// Fallback to file store on error - when external store is not
		// available. This may be the case when user does not have lock screen
		// or pin code set up.
		return SecretStoreFallbackBehaviorOnError

	}
	return NewSecretStoreUpgradeable(secAndroid, secFile,
		shouldUpgradeOpportunistically, shouldStoreInFallback)
}
