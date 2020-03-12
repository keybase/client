// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"bytes"
	"crypto/hmac"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	SCSigCannotVerify = int(keybase1.StatusCode_SCSigCannotVerify)
)

func FastByteArrayEq(a, b []byte) bool {
	return bytes.Equal(a, b)
}

func SecureByteArrayEq(a, b []byte) bool {
	return hmac.Equal(a, b)
}
