// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"crypto/sha256"

	"github.com/keybase/client/go/protocol/keybase1"
)

func ComputeSigIDFromSigBody(body []byte) keybase1.SigIDBase {
	return keybase1.SigIDBaseFromBytes(sha256.Sum256(body))
}
