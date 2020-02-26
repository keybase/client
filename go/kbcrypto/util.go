// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"bytes"
	"crypto/hmac"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	SCSigCannotVerify = int(keybase1.StatusCode_SCSigCannotVerify)
	SCInvalidFormat   = int(keybase1.StatusCode_SCInvalidFormat)
	SCBadFrame        = int(keybase1.StatusCode_SCBadFrame)
	SCWrongType       = int(keybase1.StatusCode_SCWrongType)
	SCNoKeyFound      = int(keybase1.StatusCode_SCNoKeyFound)
	SCAPINetworkError = int(keybase1.StatusCode_SCAPINetworkError)
)

const wrongTypeStr = "Wrong saltpack message type: "
const badFrameStr = "Error in framing: "

func FastByteArrayEq(a, b []byte) bool {
	return bytes.Equal(a, b)
}

func SecureByteArrayEq(a, b []byte) bool {
	return hmac.Equal(a, b)
}

/*ParseVerificationOrDecryptionErrorForStatusCode takes an error string from a
VerificationError or DecryptionError and returns a status code if there exists a match. */
func ParseVerificationOrDecryptionErrorForStatusCode(msg string, defaultCode int, defaultName string) (code int, name string) {
	code, name = defaultCode, defaultName
	if strings.Contains(msg, "unexpected EOF") {
		code, name = SCInvalidFormat, "SC_INVALID_FORMAT"
	} else if strings.Contains(msg, "no suitable key found") {
		// e.g. if message was encrypted for not you, or can't find the
		// key that signed the message
		code, name = SCNoKeyFound, "SC_NO_KEY_FOUND"
	} else if strings.Contains(msg, "API network error") {
		code, name = SCAPINetworkError, "SC_API_NETWORK_ERROR"
	} else if strings.Contains(msg, wrongTypeStr) {
		code, name = SCWrongType, "SC_WRONG_TYPE"
	} else if strings.Contains(msg, badFrameStr) {
		code, name = SCBadFrame, "SC_BAD_FRAME"
	}
	return code, name
}
