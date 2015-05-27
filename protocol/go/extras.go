package keybase1

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

const (
	UID_LEN          = 16
	UID_SUFFIX       = 0x00
	UID_SUFFIX_2     = 0x19
	UID_SUFFIX_HEX   = "00"
	UID_SUFFIX_2_HEX = "19"
)

const (
	SIG_ID_LEN         = 32
	SIG_ID_SUFFIX      = 0x0f
	SIG_SHORT_ID_BYTES = 27
)

func Unquote(data []byte) string {
	return strings.Trim(string(data), "\"")
}

func Quote(s string) []byte {
	return []byte("\"" + s + "\"")
}

func UIDFromString(s string) (UID, error) {
	if len(s) != hex.EncodedLen(UID_LEN) {
		return "", fmt.Errorf("Bad UID '%s'; must be %d bytes long", s, UID_LEN)
	}
	suffix := s[len(s)-2:]
	if suffix != UID_SUFFIX_HEX && suffix != UID_SUFFIX_2_HEX {
		return "", fmt.Errorf("Bad UID '%s': must end in 0x%x or 0x%x", s, UID_SUFFIX, UID_SUFFIX_2)
	}
	return UID(s), nil
}

func (u UID) String() string {
	return string(u)
}

func (u UID) IsNil() bool {
	return len(u) == 0
}

func (u UID) Exists() bool {
	return !u.IsNil()
}

func (s SigID) IsNil() bool {
	return len(s) == 0
}

func (s SigID) Exists() bool {
	return !s.IsNil()
}

func (s SigID) ToDisplayString(verbose bool) string {
	if verbose {
		return string(s)
	}
	return fmt.Sprintf("%s...", s[0:6])
}

func (s SigID) ToString(suffix bool) string {
	if len(s) == 0 {
		return ""
	}
	if suffix {
		return string(s)
	}
	return string(s[0 : len(s)-2])
}

func SigIDFromString(s string, suffix bool) (SigID, error) {
	blen := SIG_ID_LEN
	if suffix {
		blen++
	}
	if len(s) != hex.EncodedLen(blen) {
		return "", fmt.Errorf("Invalid SigID string length: %d, expected %d (suffix = %v)", len(s), hex.EncodedLen(blen), suffix)
	}
	if suffix {
		return SigID(s), nil
	}
	return SigID(fmt.Sprintf("%s%02x", s, SIG_ID_SUFFIX)), nil
}

func SigIDFromBytes(b [SIG_ID_LEN]byte) SigID {
	s := hex.EncodeToString(b[:])
	return SigID(fmt.Sprintf("%s%02x", s, SIG_ID_SUFFIX))
}

func SigIDFromSlice(b []byte) (SigID, error) {
	if len(b) != SIG_ID_LEN {
		return "", fmt.Errorf("invalid byte slice for SigID: len == %d, expected %d", len(b), SIG_ID_LEN)
	}
	var x [SIG_ID_LEN]byte
	copy(x[:], b)
	return SigIDFromBytes(x), nil
}

func (s SigID) toBytes() []byte {
	b, err := hex.DecodeString(string(s))
	if err != nil {
		return nil
	}
	return b[0:SIG_ID_LEN]
}

func (s SigID) ToMediumID() string {
	return depad(base64.URLEncoding.EncodeToString(s.toBytes()))
}

func (s SigID) ToShortID() string {
	return depad(base64.URLEncoding.EncodeToString(s.toBytes()[0:SIG_SHORT_ID_BYTES]))
}

// copied from libkb/util.go
func depad(s string) string {
	b := []byte(s)
	i := len(b) - 1
	for ; i >= 0; i-- {
		if b[i] != '=' {
			i++
			break
		}
	}
	ret := string(b[0:i])
	return ret
}
