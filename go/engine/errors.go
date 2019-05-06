// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

//=============================================================================

type CheckError struct {
	m string
}

func (e CheckError) Error() string {
	return fmt.Sprintf("Check engine error: %s", e.m)
}

//=============================================================================

type GPGExportingError struct {
	err      error
	inPGPGen bool // did this error happen during pgp generation?
}

func (e GPGExportingError) Error() string {
	if e.inPGPGen {
		const msg string = "A PGP key has been generated and added to your account, but exporting to the GPG keychain has failed. You can try to export again using `keybase pgp export -s`."
		return fmt.Sprintf("%s Error during GPG exporting: %s", msg, e.err.Error())
	}
	return e.err.Error()
}

//=============================================================================

type PGPImportStubbedError struct {
	KeyIDString string
}

func (e PGPImportStubbedError) Error() string {
	return fmt.Sprintf("Key %s has a stubbed private key, so we can't import it to the Keybase keychain.",
		e.KeyIDString)
}

//=============================================================================

type PGPNotActiveForLocalImport struct {
	kid keybase1.KID
}

func (e PGPNotActiveForLocalImport) Error() string {
	return fmt.Sprintf("Key %s is not active in user's sigchain. Publish key first to be able to import to local Keybase keychain.",
		e.kid)
}

type SecretStoreNotFunctionalError struct {
	err error
}

func (e SecretStoreNotFunctionalError) Error() string {
	return fmt.Sprintf("Secret store not functional: %s", e.err)
}
