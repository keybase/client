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
	shouldStoreInFallback := func(options *SecretStoreOptions) bool {
		if options == nil {
			return false
		}
		return options.RandomPw
	}
	return NewSecretStoreUpgradeable(ssecretservice, sfile, shouldUpgradeOpportunistically, shouldStoreInFallback)
}
