// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"bytes"
	"crypto/hmac"
	"strings"
)

const wrongTypeStr = "Wrong saltpack message type: "
const badFrameStr = "Error in framing: "

func FastByteArrayEq(a, b []byte) bool {
	return bytes.Equal(a, b)
}

func SecureByteArrayEq(a, b []byte) bool {
	return hmac.Equal(a, b)
}

/*CleanVerificationOrDecryptionErrorMsg takes an error string from a
VerificationError or DecryptionError and returns a user-friendly string
to be set as the Desc value of a Status. */
func CleanVerificationOrDecryptionErrorMsg(msg string) (desc string) {
	desc = ""
	if strings.Contains(msg, "unexpected EOF") {
		desc = "Invalid Saltpack format."
	} else if strings.Contains(msg, "no suitable key found") {
		// e.g. if message was encrypted for not you, or can't find the
		// key that signed the message
		desc = "No suitable key found."
	} else if strings.Contains(msg, "API network error") {
		desc = "No network connection."
	} else if strings.Contains(msg, wrongTypeStr) {
		desc = msg[strings.Index(msg, wrongTypeStr):len(msg)]
	} else if strings.Contains(msg, badFrameStr) {
		desc = msg[strings.Index(msg, badFrameStr):len(msg)]
	}
	return desc
}
