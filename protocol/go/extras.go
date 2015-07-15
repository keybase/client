package keybase1

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	jsonw "github.com/keybase/go-jsonw"
)

const (
	UID_LEN          = 16
	UID_SUFFIX       = 0x00
	UID_SUFFIX_2     = 0x19
	UID_SUFFIX_HEX   = "00"
	UID_SUFFIX_2_HEX = "19"
	PUBLIC_UID       = "ffffffffffffffffffffffffffffff00"
)

// UID for the special "public" user.
var PublicUID = UID(PUBLIC_UID)

const (
	SIG_ID_LEN         = 32
	SIG_ID_SUFFIX      = 0x0f
	SIG_SHORT_ID_BYTES = 27
)

const (
	DeviceIDLen       = 16
	DeviceIDSuffix    = 0x18
	DeviceIDSuffixHex = "18"
)

func Unquote(data []byte) string {
	return strings.Trim(string(data), "\"")
}

func Quote(s string) []byte {
	return []byte("\"" + s + "\"")
}

func KIDFromSlice(b []byte) KID {
	return KID(hex.EncodeToString(b))
}

func KIDFromString(s string) KID {
	// there are no validations for KIDs (length, suffixes)
	return KID(s)
}

func (k KID) IsValid() bool {
	return len(k) > 0
}

func (k KID) String() string {
	return string(k)
}

func (k KID) IsNil() bool {
	return len(k) == 0
}

func (k KID) Exists() bool {
	return !k.IsNil()
}

func (k KID) Equal(v KID) bool {
	return k == v
}

func (k KID) NotEqual(v KID) bool {
	return !k.Equal(v)
}

func (k KID) Match(q string, exact bool) bool {
	if k.IsNil() {
		return false
	}

	if exact {
		return strings.ToLower(k.String()) == strings.ToLower(q)
	}

	if strings.HasPrefix(k.String(), strings.ToLower(q)) {
		return true
	}
	if strings.HasPrefix(k.ToShortIDString(), q) {
		return true
	}
	return false
}

func (k KID) ToBytes() []byte {
	b, err := hex.DecodeString(string(k))
	if err != nil {
		return nil
	}
	return b
}

func (k KID) ToShortIDString() string {
	return encode(k.ToBytes()[0:12])
}

func (k KID) ToJsonw() *jsonw.Wrapper {
	if k.IsNil() {
		return jsonw.NewNil()
	}
	return jsonw.NewString(string(k))
}

func DeviceIDFromBytes(b [DeviceIDLen]byte) DeviceID {
	return DeviceID(hex.EncodeToString(b[:]))
}

func DeviceIDFromSlice(b []byte) (DeviceID, error) {
	if len(b) != DeviceIDLen {
		return "", fmt.Errorf("invalid byte slice for DeviceID: len == %d, expected %d", len(b), DeviceIDLen)
	}
	var x [DeviceIDLen]byte
	copy(x[:], b)
	return DeviceIDFromBytes(x), nil
}

func DeviceIDFromString(s string) (DeviceID, error) {
	if len(s) != hex.EncodedLen(DeviceIDLen) {
		return "", fmt.Errorf("Bad Device ID length: %d", len(s))
	}
	suffix := s[len(s)-2:]
	if suffix != DeviceIDSuffixHex {
		return "", fmt.Errorf("Bad suffix byte: %s", suffix)
	}
	return DeviceID(s), nil
}

func (d DeviceID) String() string {
	return string(d)
}

func (d DeviceID) IsNil() bool {
	return len(d) == 0
}

func (d DeviceID) Exists() bool {
	return !d.IsNil()
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

// Used by unit tests.
func MakeTestUID(n uint32) UID {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint32(b, n)
	s := hex.EncodeToString(b)
	c := 2*UID_LEN - len(UID_SUFFIX_HEX) - len(s)
	s += strings.Repeat("0", c) + UID_SUFFIX_HEX
	uid, err := UIDFromString(s)
	if err != nil {
		panic(err)
	}
	return uid
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

func (u UID) Equal(v UID) bool {
	return u == v
}

func (u UID) NotEqual(v UID) bool {
	return !u.Equal(v)
}

func (u UID) Less(v UID) bool {
	return u < v
}

// Returns a number in [0, shardCount) which can be treated as roughly
// uniformly distributed. Used for things that need to shard by user.
func (u UID) GetShard(shardCount int) (int, error) {
	bytes, err := hex.DecodeString(string(u))
	if err != nil {
		return 0, err
	}
	n := binary.LittleEndian.Uint32(bytes)
	return int(n % uint32(shardCount)), nil
}

func (s SigID) IsNil() bool {
	return len(s) == 0
}

func (s SigID) Exists() bool {
	return !s.IsNil()
}

func (s SigID) Equal(t SigID) bool {
	return s == t
}

func (s SigID) NotEqual(t SigID) bool {
	return !s.Equal(t)
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
	return encode(s.toBytes())
}

func (s SigID) ToShortID() string {
	return encode(s.toBytes()[0:SIG_SHORT_ID_BYTES])
}

func encode(b []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(b), "=")
}

func FromTime(t Time) time.Time {
	return time.Unix(0, int64(t)*1000000)
}

func ToTime(t time.Time) Time {
	return Time(t.UnixNano() / 1000000)
}

func TimeFromSeconds(seconds int64) Time {
	return Time(seconds * 1000)
}

func FormatTime(t Time) string {
	layout := "2006-01-02 15:04:05 MST"
	return FromTime(t).Format(layout)
}
