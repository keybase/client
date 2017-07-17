// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

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

func UIDArg(uid keybase1.UID) HTTPValue {
	return S{Val: uid.String()}
}

// UsernameToUID works for users created after "Fri Feb  6 19:33:08 EST 2015",
// with some exceptions, since we didn't ToLower() for all UIDs
func UsernameToUID(s string) keybase1.UID {
	return UsernameToUIDPreserveCase(strings.ToLower(s))
}

func CheckUIDAgainstUsername(uid keybase1.UID, username string) (err error) {
	u2 := UsernameToUID(username)
	if uid.NotEqual(u2) {
		err = UIDMismatchError{fmt.Sprintf("%s != %s (via %s)", uid, u2, username)}
	}
	return
}

// UsernameToUID works for users created after "Fri Feb  6 19:33:08 EST 2015".  Some of
// them had buggy Username -> UID conversions, in which case we need to hash the
// original case to recover their UID.
func UsernameToUIDPreserveCase(s string) keybase1.UID {
	h := sha256.Sum256([]byte(s))
	var uid [keybase1.UID_LEN]byte
	copy(uid[:], h[0:keybase1.UID_LEN-1])
	uid[keybase1.UID_LEN-1] = keybase1.UID_SUFFIX_2
	ret, _ := keybase1.UIDFromString(hex.EncodeToString(uid[:]))
	return ret
}

// CheckUIDAgainstCasedUsername takes the input string, does not convert toLower,
// and then hashes it to recover a UID. This is a workaround for some
// users whose UIDs were computed incorrectly.
func CheckUIDAgainstCasedUsername(uid keybase1.UID, username string) (err error) {
	u2 := UsernameToUIDPreserveCase(username)
	if uid.NotEqual(u2) {
		err = UIDMismatchError{fmt.Sprintf("%s != %s (via %s)", uid, u2, username)}
	}
	return
}
