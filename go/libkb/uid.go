// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"github.com/keybase/client/go/kbun"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func UIDFromHex(s string) (keybase1.UID, error) {
	u, err := keybase1.UIDFromString(s)
	if err != nil {
		var nilUID keybase1.UID
		return nilUID, err
	}
	return u, nil
}

func GetUID(w *jsonw.Wrapper) (keybase1.UID, error) {
	s, err := w.GetString()
	var nilUID keybase1.UID
	if err != nil {
		return nilUID, err
	}
	return UIDFromHex(s)
}

func GetUIDVoid(w *jsonw.Wrapper, u *keybase1.UID, e *error) {
	uid, err := GetUID(w)
	if err == nil {
		*u = uid
	} else if e != nil && *e == nil {
		*e = err
	}
}

func UIDWrapper(uid keybase1.UID) *jsonw.Wrapper {
	return jsonw.NewString(uid.String())
}

// TODO (CORE-6576): Remove these aliases once everything outside of
// this repo points to kbconst.RunMode.

func UIDArg(uid keybase1.UID) HTTPValue {
	return S{Val: uid.String()}
}

func UsernameToUID(s string) keybase1.UID {
	return kbun.UsernameToUID(s)
}

func CheckUIDAgainstUsername(uid keybase1.UID, username string) (err error) {
	return kbun.CheckUIDAgainstUsername(uid, username)
}

func UsernameToUIDPreserveCase(s string) keybase1.UID {
	return kbun.UsernameToUIDPreserveCase(s)
}

func CheckUIDAgainstCasedUsername(uid keybase1.UID, username string) (err error) {
	return kbun.CheckUIDAgainstCasedUsername(uid, username)
}
