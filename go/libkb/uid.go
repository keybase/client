package libkb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type UID keybase1.UID

func UidFromHex(s string) (UID, error) {
	u, err := keybase1.UIDFromString(s)
	if err != nil {
		return "", err
	}
	return UID(u), nil
}

func GetUID(w *jsonw.Wrapper) (UID, error) {
	s, err := w.GetString()
	if err != nil {
		return "", err
	}
	return UidFromHex(s)
}

func GetUidVoid(w *jsonw.Wrapper, u *UID, e *error) {
	uid, err := GetUID(w)
	if err == nil {
		*u = uid
	} else if e != nil && *e == nil {
		*e = err
	}
}

const (
	UID_LEN      = keybase1.UID_LEN
	UID_SUFFIX   = keybase1.UID_SUFFIX
	UID_SUFFIX_2 = keybase1.UID_SUFFIX_2
)

/*

type UID keybase1.UID
type UIDs []UID

func (u UID) String() string { return keybase1.UID(u).String() }

func (u UID) P() *UID { return &u }

func (u UID) IsZero() bool {
	for _, b := range u {
		if b != 0 {
			return false
		}
	}
	return true
}

func UidFromHex(s string) (ret *UID, err error) {
	var tmp *keybase1.UID
	if tmp, err = keybase1.UidFromHex(s); tmp != nil {
		tmp2 := UID(*tmp)
		ret = &tmp2
	}
	return
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (u *UID) UnmarshalJSON(b []byte) error {
	p := (*keybase1.UID)(u)
	return p.UnmarshalJSON(b)
}

func (u *UID) MarshalJSON() ([]byte, error) {
	p := (*keybase1.UID)(u)
	return p.MarshalJSON()
}

func GetUID(w *jsonw.Wrapper) (u *UID, err error) {
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := UidFromHex(s)
	return ret, err
}

func (u UID) Eq(u2 UID) bool {
	return FastByteArrayEq(u[:], u2[:])
}

func GetUidVoid(w *jsonw.Wrapper, u *UID, e *error) {
	ret, err := GetUID(w)
	if err != nil {
		*e = err
	} else {
		*u = *ret
	}
	return
}

func (u UID) ToJsonw() *jsonw.Wrapper {
	return jsonw.NewString(u.String())
}
*/

// UsernameToUID works for users created after "Fri Feb  6 19:33:08 EST 2015"
func UsernameToUID(s string) UID {
	h := sha256.Sum256([]byte(strings.ToLower(s)))
	var uid [keybase1.UID_LEN]byte
	copy(uid[:], h[0:UID_LEN-1])
	uid[UID_LEN-1] = UID_SUFFIX_2
	return UID(hex.EncodeToString(uid[:]))
}

func CheckUIDAgainstUsername(uid UID, username string) (err error) {
	u2 := UsernameToUID(username)
	if uid != u2 {
		err = UidMismatchError{fmt.Sprintf("%s != %s (via %s)", uid, u2, username)}
	}
	return
}
