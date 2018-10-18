// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build production

package kbcrypto

func (p SignaturePrefix) IsWhitelistedTest() bool {
	return false
}
