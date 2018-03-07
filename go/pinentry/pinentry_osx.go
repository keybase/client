// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package pinentry

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
)

const (
	// pinentryServiceName is the service name that pinentry uses
	// when storing into the Keychain.
	pinentryServiceName = "GnuPG"
	// accountNameByteLength is how many random bytes to use to
	// generate the account name. 32 bytes of randomness is more
	// than enough to make the account name unpredictable.
	accountNameByteLength = 32
)

type pinentrySecretStoreInfo string

func (pi *pinentryInstance) useSecretStore(useSecretStore bool) (pinentrySecretStoreInfo, error) {
	if !useSecretStore {
		return "", nil
	}

	// Make account name unpredictable to make it infeasible for
	// an attacker to guess (and thus sniff the passphrase). See
	// https://github.com/keybase/client/issues/484#issuecomment-114313867 .
	var accountNameBytes [accountNameByteLength]byte
	n, err := rand.Read(accountNameBytes[:])
	if n != accountNameByteLength {
		return "", fmt.Errorf("Unexpected random byte count %d", n)
	}
	if err != nil {
		return "", err
	}

	accountName := "keybase-" + hex.EncodeToString(accountNameBytes[:])

	// This will cause a "Save in Keychain" checkbox to appear in
	// the pinentry dialog. If checked, pinentry will then save
	// the entered passphrase into the keychain with the service
	// name "GnuPG" and the account name equal to the passed-in
	// cache-id option value.
	pi.Set("OPTION", "cache-id "+accountName, &err)
	if err != nil {
		// It's possible that the pinentry being used doesn't support
		// this option.  So just return instead of causing a fatal
		// error.
		pi.parent.log.Debug("| Error setting pinentry cache-id OPTION: %s", err)
		pi.parent.log.Debug("| Not using secret store as a result.")
		return "", nil
	}
	return pinentrySecretStoreInfo(accountName), err
}

func HasWindows() bool {
	// We aren't in an ssh connection, so we can probably spawn a window.
	return len(os.Getenv("SSH_CONNECTION")) == 0
}
