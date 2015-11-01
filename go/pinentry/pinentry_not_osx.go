// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !darwin

package pinentry

type pinentrySecretStoreInfo struct{}

func (pi *pinentryInstance) useSecretStore(useSecretStore bool) (pinentrySecretStoreInfo, error) {
	return pinentrySecretStoreInfo{}, nil
}

func (pi *pinentryInstance) shouldStoreSecret(info pinentrySecretStoreInfo) bool {
	return false
}
