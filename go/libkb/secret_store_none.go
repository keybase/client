// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !darwin,!android

package libkb

func NewSecretStore(username NormalizedUsername) SecretStore {
	return nil
}

func HasSecretStore() bool {
	return false
}

func GetUsersWithStoredSecrets() ([]string, error) {
	return nil, nil
}

func GetTerminalPrompt() string {
	// TODO: Come up with specific prompts for other platforms.
	return "Store your key in the local secret store?"
}
