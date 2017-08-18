// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
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
