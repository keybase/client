// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"github.com/keybase/client/go/kbcrypto"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func GetKID(w *jsonw.Wrapper) (kid keybase1.KID, err error) {
	var s string
	s, err = w.GetString()
	if err != nil {
		return
	}
	kid = keybase1.KIDFromString(s)
	return
}

func KIDIsDeviceVerify(kid keybase1.KID) bool {
	return kbcrypto.AlgoType(kid.GetKeyType()) == kbcrypto.KIDNaclEddsa
}

func KIDIsDeviceEncrypt(kid keybase1.KID) bool {
	return kbcrypto.AlgoType(kid.GetKeyType()) == kbcrypto.KIDNaclDH
}

func KIDIsPGP(kid keybase1.KID) bool {
	return !KIDIsDeviceEncrypt(kid) && !KIDIsDeviceVerify(kid)
}
