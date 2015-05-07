package keybase1

import (
	"encoding/hex"
	"fmt"
	"strings"
)

const (
	UID_LEN      = 16
	UID_SUFFIX   = 0x00
	UID_SUFFIX_2 = 0x19
)

func Unquote(data []byte) string {
	return strings.Trim(string(data), "\"")
}

func Quote(s string) []byte {
	return []byte("\"" + s + "\"")
}

func UidFromHex(s string) (u *UID, err error) {
	var bv []byte
	bv, err = hex.DecodeString(s)
	if err != nil {
		return
	}
	if len(bv) != UID_LEN {
		err = fmt.Errorf("Bad UID '%s'; must be %d bytes long", s, UID_LEN)
		return
	}
	if bv[len(bv)-1] != UID_SUFFIX && bv[len(bv)-1] != UID_SUFFIX_2 {
		err = fmt.Errorf("Bad UID '%s': must end in 0x%x or 0x%x", s, UID_SUFFIX, UID_SUFFIX_2)
		return
	}
	out := UID{}
	copy(out[:], bv[0:UID_LEN])
	u = &out
	return
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (u *UID) UnmarshalJSON(b []byte) error {
	v, err := UidFromHex(Unquote(b))
	if err != nil {
		return err
	}
	*u = *v
	return nil
}

func (u UID) String() string {
	return hex.EncodeToString(u[:])
}

func (u *UID) MarshalJSON() ([]byte, error) {
	return Quote(u.String()), nil
}
