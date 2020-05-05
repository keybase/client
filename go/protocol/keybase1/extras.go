// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase1

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/kbtime"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	jsonw "github.com/keybase/go-jsonw"
)

const (
	UID_LEN                       = 16
	UID_SUFFIX                    = 0x00
	UID_SUFFIX_2                  = 0x19
	UID_SUFFIX_HEX                = "00"
	UID_SUFFIX_2_HEX              = "19"
	TEAMID_LEN                    = 16
	TEAMID_PRIVATE_SUFFIX         = 0x24
	TEAMID_PRIVATE_SUFFIX_HEX     = "24"
	TEAMID_PUBLIC_SUFFIX          = 0x2e
	TEAMID_PUBLIC_SUFFIX_HEX      = "2e"
	SUB_TEAMID_PRIVATE_SUFFIX     = 0x25
	SUB_TEAMID_PRIVATE_SUFFIX_HEX = "25"
	SUB_TEAMID_PUBLIC_SUFFIX      = 0x2f
	SUB_TEAMID_PUBLIC_SUFFIX_HEX  = "2f"
	PUBLIC_UID                    = "ffffffffffffffffffffffffffffff00"
)

// UID for the special "public" user.
var PublicUID = UID(PUBLIC_UID)

const (
	SIG_ID_LEN         = 32
	SIG_ID_SUFFIX      = 0x0f
	SIG_SHORT_ID_BYTES = 27
	SigIDQueryMin      = 8
)

const (
	DeviceIDLen       = 16
	DeviceIDSuffix    = 0x18
	DeviceIDSuffixHex = "18"
)

const (
	KidLen     = 35   // bytes
	KidSuffix  = 0x0a // a byte
	KidVersion = 0x1
)

const redactedReplacer = "[REDACTED]"

func Unquote(data []byte) string {
	return strings.Trim(string(data), "\"")
}

func Quote(s string) []byte {
	return []byte("\"" + s + "\"")
}

func UnquoteBytes(data []byte) []byte {
	return bytes.Trim(data, "\"")
}

func KIDFromSlice(b []byte) KID {
	return KID(hex.EncodeToString(b))
}

func (b BinaryKID) ToKID() KID {
	return KIDFromSlice([]byte(b))
}

func (k KID) ToBinaryKID() BinaryKID {
	return BinaryKID(k.ToBytes())
}

func (b BinaryKID) Equal(c BinaryKID) bool {
	return bytes.Equal([]byte(b), []byte(c))
}

func KIDFromStringChecked(s string) (KID, error) {

	// It's OK to have a 0-length KID. That means, no such key
	// (or NULL kid).
	if len(s) == 0 {
		return KID(""), nil
	}

	b, err := hex.DecodeString(s)
	if err != nil {
		return KID(""), err
	}

	if len(b) != KidLen {
		return KID(""), fmt.Errorf("KID wrong length; wanted %d but got %d bytes",
			KidLen, len(b))
	}
	if b[len(b)-1] != KidSuffix {
		return KID(""), fmt.Errorf("Bad KID suffix: got 0x%02x, wanted 0x%02x",
			b[len(b)-1], KidSuffix)
	}
	if b[0] != KidVersion {
		return KID(""), fmt.Errorf("Bad KID version; got 0x%02x but wanted 0x%02x",
			b[0], KidVersion)
	}
	return KID(s), nil
}

func HashMetaFromString(s string) (ret HashMeta, err error) {
	// TODO: Should we add similar handling to other types?
	if s == "null" {
		return nil, nil
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		return ret, err
	}
	return HashMeta(b), nil
}

func cieq(s string, t string) bool {
	return strings.ToLower(s) == strings.ToLower(t)
}

func KBFSRootHashFromString(s string) (ret KBFSRootHash, err error) {
	if s == "null" {
		return nil, nil
	}
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return ret, err
	}
	return KBFSRootHash(b), nil
}

func (h KBFSRootHash) String() string {
	return hex.EncodeToString(h)
}

func (h KBFSRootHash) Eq(h2 KBFSRootHash) bool {
	return hmac.Equal(h[:], h2[:])
}

func (h HashMeta) String() string {
	return hex.EncodeToString(h)
}

func (h HashMeta) Eq(h2 HashMeta) bool {
	return hmac.Equal(h[:], h2[:])
}

func (h *HashMeta) UnmarshalJSON(b []byte) error {
	hm, err := HashMetaFromString(Unquote(b))
	if err != nil {
		return err
	}
	*h = hm
	return nil
}

func (h *KBFSRootHash) UnmarshalJSON(b []byte) error {
	rh, err := KBFSRootHashFromString(Unquote(b))
	if err != nil {
		return err
	}
	*h = rh
	return nil
}

func SHA512FromString(s string) (ret SHA512, err error) {
	if s == "null" {
		return nil, nil
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		return ret, err
	}
	if len(b) != 64 {
		return nil, fmt.Errorf("Wanted a 64-byte SHA512, but got %d bytes", len(b))
	}
	return SHA512(b), nil
}

func (s SHA512) String() string {
	return hex.EncodeToString(s)
}

func (s SHA512) Eq(s2 SHA512) bool {
	return hmac.Equal(s[:], s2[:])
}

func (s *SHA512) UnmarshalJSON(b []byte) error {
	tmp, err := SHA512FromString(Unquote(b))
	if err != nil {
		return err
	}
	*s = tmp
	return nil
}

func (t *ResetType) UnmarshalJSON(b []byte) error {
	var err error
	s := strings.TrimSpace(string(b))
	var ret ResetType
	switch s {
	case "\"reset\"", "1":
		ret = ResetType_RESET
	case "\"delete\"", "2":
		ret = ResetType_DELETE
	default:
		err = fmt.Errorf("Bad reset type: %s", s)
	}
	*t = ret
	return err
}

func (l *LeaseID) UnmarshalJSON(b []byte) error {
	decoded, err := hex.DecodeString(Unquote(b))
	if err != nil {
		return err
	}
	*l = LeaseID(hex.EncodeToString(decoded))
	return nil
}

func (h HashMeta) MarshalJSON() ([]byte, error) {
	return Quote(h.String()), nil
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

func (k KID) SecureEqual(v KID) bool {
	return hmac.Equal(k.ToBytes(), v.ToBytes())
}

func (k KID) Match(q string, exact bool) bool {
	if k.IsNil() {
		return false
	}

	if exact {
		return cieq(k.String(), q)
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

func (k KID) GetKeyType() byte {
	raw := k.ToBytes()
	if len(raw) < 2 {
		return 0
	}
	return raw[1]
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

func (k KID) IsIn(list []KID) bool {
	for _, h := range list {
		if h.Equal(k) {
			return true
		}
	}
	return false
}

func PGPFingerprintFromString(s string) (ret PGPFingerprint, err error) {
	b, err := hex.DecodeString(s)
	if err != nil {
		return
	}
	copy(ret[:], b[:])
	return
}

func (p *PGPFingerprint) String() string {
	return hex.EncodeToString(p[:])
}

func (p PGPFingerprint) MarshalJSON() ([]byte, error) {
	return Quote(p.String()), nil
}

func (p *PGPFingerprint) UnmarshalJSON(b []byte) error {
	tmp, err := PGPFingerprintFromString(Unquote(b))
	if err != nil {
		return err
	}
	*p = tmp
	return nil
}

func DeviceIDFromBytes(b [DeviceIDLen]byte) DeviceID {
	return DeviceID(hex.EncodeToString(b[:]))
}

func (d DeviceID) ToBytes(out []byte) error {
	tmp, err := hex.DecodeString(string(d))
	if err != nil {
		return err
	}
	if len(tmp) != DeviceIDLen {
		return fmt.Errorf("Bad device ID; wanted %d bytes but got %d", DeviceIDLen, len(tmp))
	}
	if len(out) != DeviceIDLen {
		return fmt.Errorf("Need to output to a slice with %d bytes", DeviceIDLen)
	}
	copy(out[:], tmp)
	return nil
}

func DeviceIDFromSlice(b []byte) (DeviceID, error) {
	if len(b) != DeviceIDLen {
		return "", fmt.Errorf("invalid byte slice for DeviceID: len == %d, expected %d", len(b), DeviceIDLen)
	}
	var x [DeviceIDLen]byte
	copy(x[:], b)
	return DeviceIDFromBytes(x), nil
}

func LinkIDFromByte32(b [32]byte) LinkID {
	return LinkID(hex.EncodeToString(b[:]))
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

func (d DeviceID) Eq(d2 DeviceID) bool {
	return d == d2
}

func (t TeamID) Eq(t2 TeamID) bool {
	return t == t2
}

func (l LinkID) Eq(l2 LinkID) bool {
	return l == l2
}

func (l LinkID) IsNil() bool {
	return len(l) == 0
}

func (l LinkID) String() string {
	return string(l)
}

func NilTeamID() TeamID { return TeamID("") }

func (s Seqno) Eq(s2 Seqno) bool {
	return s == s2
}

func (s Seqno) String() string {
	return fmt.Sprintf("%d", s)
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

func UIDFromSlice(b []byte) (UID, error) {
	return UIDFromString(hex.EncodeToString(b))
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

func (u UID) ToBytes() []byte {
	b, err := hex.DecodeString(string(u))
	if err != nil {
		return nil
	}
	return b
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

func (u UID) AsUserOrTeam() UserOrTeamID {
	return UserOrTeamID(u)
}

func TeamIDFromString(s string) (TeamID, error) {
	if len(s) != hex.EncodedLen(TEAMID_LEN) {
		return "", fmt.Errorf("Bad TeamID '%s'; must be %d bytes long", s, TEAMID_LEN)
	}
	suffix := s[len(s)-2:]
	switch suffix {
	case TEAMID_PRIVATE_SUFFIX_HEX, TEAMID_PUBLIC_SUFFIX_HEX,
		SUB_TEAMID_PRIVATE_SUFFIX_HEX, SUB_TEAMID_PUBLIC_SUFFIX_HEX:
		return TeamID(s), nil
	}
	return "", fmt.Errorf("Bad TeamID '%s': must end in one of [0x%x, 0x%x, 0x%x, 0x%x]",
		s, TEAMID_PRIVATE_SUFFIX_HEX, TEAMID_PUBLIC_SUFFIX_HEX, SUB_TEAMID_PRIVATE_SUFFIX, SUB_TEAMID_PUBLIC_SUFFIX)
}

func UserOrTeamIDFromString(s string) (UserOrTeamID, error) {
	UID, errUser := UIDFromString(s)
	if errUser == nil {
		return UID.AsUserOrTeam(), nil
	}
	teamID, errTeam := TeamIDFromString(s)
	if errTeam == nil {
		return teamID.AsUserOrTeam(), nil
	}
	return "", fmt.Errorf("Bad UserOrTeamID: could not parse %s as a UID (err = %v) or team id (err = %v)", s, errUser, errTeam)
}

// Used by unit tests.
func MakeTestTeamID(n uint32, public bool) TeamID {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint32(b, n)
	s := hex.EncodeToString(b)
	useSuffix := TEAMID_PRIVATE_SUFFIX_HEX
	if public {
		useSuffix = TEAMID_PUBLIC_SUFFIX_HEX
	}
	c := 2*TEAMID_LEN - len(useSuffix) - len(s)
	s += strings.Repeat("0", c) + useSuffix
	tid, err := TeamIDFromString(s)
	if err != nil {
		panic(err)
	}
	return tid
}

// Used by unit tests.
func MakeTestSubTeamID(n uint32, public bool) TeamID {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint32(b, n)
	s := hex.EncodeToString(b)
	useSuffix := SUB_TEAMID_PRIVATE_SUFFIX_HEX
	if public {
		useSuffix = SUB_TEAMID_PUBLIC_SUFFIX_HEX
	}
	c := 2*TEAMID_LEN - len(useSuffix) - len(s)
	s += strings.Repeat("0", c) + useSuffix
	tid, err := TeamIDFromString(s)
	if err != nil {
		panic(err)
	}
	return tid
}

// Can panic if invalid
func (t TeamID) IsSubTeam() bool {
	suffix := t[len(t)-2:]
	switch suffix {
	case SUB_TEAMID_PRIVATE_SUFFIX_HEX, SUB_TEAMID_PUBLIC_SUFFIX_HEX:
		return true
	}
	return false
}

func (t TeamID) IsRootTeam() bool {
	return !t.IsSubTeam()
}

func (t TeamID) IsPublic() bool {
	suffix := t[len(t)-2:]
	switch suffix {
	case TEAMID_PUBLIC_SUFFIX_HEX, SUB_TEAMID_PUBLIC_SUFFIX_HEX:
		return true
	}
	return false
}

func (t TeamID) String() string {
	return string(t)
}

func (t TeamID) ToBytes() []byte {
	b, err := hex.DecodeString(string(t))
	if err != nil {
		return nil
	}
	return b
}

func (t TeamID) IsNil() bool {
	return len(t) == 0
}

func (t TeamID) Exists() bool {
	return !t.IsNil()
}

func (t TeamID) Equal(v TeamID) bool {
	return t == v
}

func (t TeamID) NotEqual(v TeamID) bool {
	return !t.Equal(v)
}

func (t TeamID) Less(v TeamID) bool {
	return t < v
}

func (t TeamID) AsUserOrTeam() UserOrTeamID {
	return UserOrTeamID(t)
}

const ptrSize = 4 << (^uintptr(0) >> 63) // stolen from runtime/internal/sys

// Size implements the cache.Measurable interface.
func (t TeamID) Size() int {
	return len(t) + ptrSize
}

func (s SigID) IsNil() bool {
	return len(s) == 0
}

func (s SigID) Exists() bool {
	return !s.IsNil()
}

func (s SigID) String() string { return string(s) }

func (s SigID) ToDisplayString(verbose bool) string {
	if verbose {
		return string(s)
	}
	return fmt.Sprintf("%s...", s[0:SigIDQueryMin])
}

func (s SigID) PrefixMatch(q string, exact bool) bool {
	if s.IsNil() {
		return false
	}

	if exact {
		return cieq(string(s), q)
	}

	if strings.HasPrefix(strings.ToLower(string(s)), strings.ToLower(q)) {
		return true
	}

	return false
}

func SigIDFromString(s string) (SigID, error) {
	// Add 1 extra byte for the suffix
	blen := SIG_ID_LEN + 1
	if len(s) != hex.EncodedLen(blen) {
		return "", fmt.Errorf("Invalid SigID string length: %d, expected %d", len(s), hex.EncodedLen(blen))
	}
	s = strings.ToLower(s)
	// Throw the outcome away, but we're checking that we can decode the value as hex
	_, err := hex.DecodeString(s)
	if err != nil {
		return "", err
	}
	return SigID(s), nil
}

func (s SigID) ToBytes() []byte {
	b, err := hex.DecodeString(string(s))
	if err != nil {
		return nil
	}
	return b[0:SIG_ID_LEN]
}

func (s SigID) StripSuffix() SigIDBase {
	l := hex.EncodedLen(SIG_ID_LEN)
	if len(s) == l {
		return SigIDBase(string(s))
	}
	return SigIDBase(string(s[0:l]))
}

func (s SigID) Eq(t SigID) bool {
	b := s.ToBytes()
	c := t.ToBytes()
	if b == nil || c == nil {
		return false
	}
	return hmac.Equal(b, c)
}

type SigIDMapKey string

// ToMapKey returns the string representation (hex-encoded) of a SigID with the hardcoded 0x0f suffix
// (for backward comptability with on-disk storage).
func (s SigID) ToMapKey() SigIDMapKey {
	return SigIDMapKey(s.StripSuffix().ToSigIDLegacy().String())
}

func (s SigID) ToMediumID() string {
	return encode(s.ToBytes())
}

func (s SigID) ToShortID() string {
	return encode(s.ToBytes()[0:SIG_SHORT_ID_BYTES])
}

// SigIDBase is a 64-character long hex encoding of the SHA256 of a signature, without
// any suffix. You get a SigID by adding either a 0f or a 22 suffix.
type SigIDBase string

func (s SigIDBase) String() string {
	return string(s)
}

func SigIDBaseFromBytes(b [SIG_ID_LEN]byte) SigIDBase {
	s := hex.EncodeToString(b[:])
	return SigIDBase(s)
}

// MarshalJSON output the SigIDBase as a full SigID to be compatible
// with legacy versions of the app.
func (s SigIDBase) MarshalJSON() ([]byte, error) {
	return Quote(s.ToSigIDLegacy().String()), nil
}

// UnmarshalJSON will accept either a SigID or a SigIDBase, and can
// strip off the suffix.
func (s *SigIDBase) UnmarshalJSON(b []byte) error {
	tmp := Unquote(b)

	l := hex.EncodedLen(SIG_ID_LEN)
	if len(tmp) == l {
		base, err := SigIDBaseFromString(tmp)
		if err != nil {
			return err
		}
		*s = base
		return nil
	}

	// If we didn't get a sigID the right size, try to strip off the suffix.
	sigID, err := SigIDFromString(tmp)
	if err != nil {
		return err
	}
	*s = sigID.StripSuffix()
	return nil
}

func SigIDBaseFromSlice(b []byte) (SigIDBase, error) {
	var buf [32]byte
	if len(b) != len(buf) {
		return "", errors.New("need a SHA256 hash, got something the wrong length")
	}
	copy(buf[:], b[:])
	return SigIDBaseFromBytes(buf), nil
}

func SigIDBaseFromString(s string) (SigIDBase, error) {
	b, err := hex.DecodeString(s)
	if err != nil {
		return "", err
	}
	return SigIDBaseFromSlice(b)
}

func (s SigIDBase) EqSigID(t SigID) bool {
	return cieq(s.String(), t.StripSuffix().String())
}

// SigIDSuffixParameters specify how to turn a 64-character SigIDBase into a 66-character SigID,
// via the two suffixes. In the future, there might be a third, 38, in use.
type SigIDSuffixParameters struct {
	IsUserSig       bool       // true for user, false for team
	IsWalletStellar bool       // exceptional sig type for backwards compatibility
	SigVersion      SigVersion // 1,2 or 3 supported now
}

func SigIDSuffixParametersFromTypeAndVersion(typ string, vers SigVersion) SigIDSuffixParameters {
	return SigIDSuffixParameters{
		IsUserSig:       !strings.HasPrefix(typ, "teams."),
		IsWalletStellar: (typ == "wallet.stellar"),
		SigVersion:      vers,
	}
}

func (s SigIDSuffixParameters) String() string {
	if s.IsWalletStellar && s.SigVersion == 2 {
		return "22"
	}
	if s.IsUserSig {
		return "0f"
	}
	switch s.SigVersion {
	case 2:
		return "22"
	case 3:
		return "38"
	default:
		return "0f"
	}
}

func (s SigIDBase) ToSigID(p SigIDSuffixParameters) SigID {
	return SigID(string(s) + p.String())
}

// ToSigIDLegacy does what all of Keybase used to do, which is to always assign a 0x0f
// suffix to SigIDBases to get SigIDs.
func (s SigIDBase) ToSigIDLegacy() SigID {
	return s.ToSigID(SigIDSuffixParameters{IsUserSig: true, IsWalletStellar: false, SigVersion: 1})
}

func (s SigIDBase) Eq(t SigIDBase) bool {
	return cieq(string(s), string(t))
}

func (s SigIDBase) ToBytes() []byte {
	x, err := hex.DecodeString(string(s))
	if err != nil {
		return nil
	}
	return x
}

func encode(b []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(b), "=")
}

func FromTime(t Time) time.Time {
	if t == 0 {
		return time.Time{}
	}
	// t is in millisecond.
	tSec := int64(t) / 1000
	tNanoSecOffset := (int64(t) - tSec*1000) * 1000000
	return time.Unix(tSec, tNanoSecOffset)
}

func (t Time) Time() time.Time {
	return FromTime(t)
}

func (t Time) UnixSeconds() int64 {
	return t.Time().Unix()
}

func ToTime(t time.Time) Time {
	if t.IsZero() {
		return 0
	}

	return Time(t.Unix()*1000 + (int64(t.Nanosecond()) / 1000000))
}

func ToTimePtr(t *time.Time) *Time {
	if t == nil {
		return nil
	}
	ret := ToTime(*t)
	return &ret
}

func TimeFromSeconds(seconds int64) Time {
	return Time(seconds * 1000)
}

func (t Time) IsZero() bool        { return t == 0 }
func (t Time) After(t2 Time) bool  { return t > t2 }
func (t Time) Before(t2 Time) bool { return t < t2 }

func FormatTime(t Time) string {
	layout := "2006-01-02 15:04:05 MST"
	return FromTime(t).Format(layout)
}

func FromUnixTime(u UnixTime) time.Time {
	if u == 0 {
		return time.Time{}
	}
	return time.Unix(int64(u), 0)
}

func (u UnixTime) Time() time.Time {
	return FromUnixTime(u)
}

func (u UnixTime) UnixSeconds() int64 {
	return int64(u)
}

func ToUnixTime(t time.Time) UnixTime {
	if t.IsZero() {
		return 0
	}
	return UnixTime(t.Unix())
}

func UnixTimeFromSeconds(seconds int64) UnixTime {
	return UnixTime(seconds)
}

func (u UnixTime) IsZero() bool            { return u == UnixTime(0) }
func (u UnixTime) After(u2 UnixTime) bool  { return u > u2 }
func (u UnixTime) Before(u2 UnixTime) bool { return u < u2 }
func FormatUnixTime(u UnixTime) string {
	layout := "2006-01-02 15:04:05 MST"
	return FromUnixTime(u).Format(layout)
}

func (s Status) Error() string {
	if s.Code == int(StatusCode_SCOk) {
		return ""
	}
	return fmt.Sprintf("%s (%s/%d)", s.Desc, s.Name, s.Code)
}

func (s Status) GoError() error {
	if s.Code == int(StatusCode_SCOk) {
		return nil
	}
	return fmt.Errorf(s.Error())
}

func (s InstallStatus) String() string {
	switch s {
	case InstallStatus_UNKNOWN:
		return "Unknown"
	case InstallStatus_ERROR:
		return "Error"
	case InstallStatus_NOT_INSTALLED:
		return "Not Installed"
	case InstallStatus_INSTALLED:
		return "Installed"
	}
	return ""
}

func (s InstallAction) String() string {
	switch s {
	case InstallAction_UNKNOWN:
		return "Unknown"
	case InstallAction_NONE:
		return "None"
	case InstallAction_UPGRADE:
		return "Upgrade"
	case InstallAction_REINSTALL:
		return "Re-Install"
	case InstallAction_INSTALL:
		return "Install"
	}
	return ""
}

func (s ServiceStatus) NeedsInstall() bool {
	return s.InstallAction == InstallAction_INSTALL ||
		s.InstallAction == InstallAction_REINSTALL ||
		s.InstallAction == InstallAction_UPGRADE
}

func (k *KID) UnmarshalJSON(b []byte) error {
	kid, err := KIDFromStringChecked(Unquote(b))
	if err != nil {
		return err
	}
	*k = KID(kid)
	return nil
}

func (u *UID) UnmarshalJSON(b []byte) error {
	uid, err := UIDFromString(Unquote(b))
	if err != nil {
		return err
	}
	*u = uid
	return nil
}

func (u *UserOrTeamID) UnmarshalJSON(b []byte) error {
	utid, err := UserOrTeamIDFromString(Unquote(b))
	if err != nil {
		return err
	}
	*u = utid
	return nil
}

// Size implements the cache.Measurable interface.
func (u UID) Size() int {
	return len(u) + ptrSize
}

func (k *KID) MarshalJSON() ([]byte, error) {
	return Quote(k.String()), nil
}

func (u *UID) MarshalJSON() ([]byte, error) {
	return Quote(u.String()), nil
}

func (u *UserOrTeamID) MarshalJSON() ([]byte, error) {
	return Quote(u.String()), nil
}

// Size implements the keybase/kbfs/cache.Measurable interface.
func (k *KID) Size() int {
	if k == nil {
		return 0
	}
	return len(*k) + ptrSize
}

func (s *SigID) UnmarshalJSON(b []byte) error {
	sigID, err := SigIDFromString(Unquote(b))
	if err != nil {
		return err
	}
	*s = sigID
	return nil
}

func (s *SigID) MarshalJSON() ([]byte, error) {
	return Quote(s.String()), nil
}

func (f Folder) ToString() string {
	prefix := "<unrecognized>"
	switch f.FolderType {
	case FolderType_PRIVATE:
		prefix = "private"
	case FolderType_PUBLIC:
		prefix = "public"
	case FolderType_TEAM:
		prefix = "team"
	}
	return prefix + "/" + f.Name
}

func (f Folder) String() string {
	return f.ToString()
}

func (f FolderHandle) ToString() string {
	prefix := "<unrecognized>"
	switch f.FolderType {
	case FolderType_PRIVATE:
		prefix = "private"
	case FolderType_PUBLIC:
		prefix = "public"
	case FolderType_TEAM:
		prefix = "team"
	}
	return prefix + "/" + f.Name
}

func (f FolderHandle) String() string {
	return f.ToString()
}

func (t TrackToken) String() string {
	return string(t)
}

func KIDFromRawKey(b []byte, keyType byte) KID {
	tmp := []byte{KidVersion, keyType}
	tmp = append(tmp, b...)
	tmp = append(tmp, byte(KidSuffix))
	return KIDFromSlice(tmp)
}

type APIStatus interface {
	Status() Status
}

type Error struct {
	code    StatusCode
	message string
}

func NewError(code StatusCode, message string) *Error {
	if code == StatusCode_SCOk {
		return nil
	}
	return &Error{code: code, message: message}
}

func FromError(err error) *Error {
	return &Error{code: StatusCode_SCGeneric, message: err.Error()}
}

func StatusOK(desc string) Status {
	if desc == "" {
		desc = "OK"
	}
	return Status{Code: int(StatusCode_SCOk), Name: "OK", Desc: desc}
}

func StatusFromCode(code StatusCode, message string) Status {
	if code == StatusCode_SCOk {
		return StatusOK(message)
	}
	return NewError(code, message).Status()
}

func (e *Error) Error() string {
	return e.message
}

func (e *Error) Status() Status {
	return Status{Code: int(e.code), Name: "ERROR", Desc: e.message}
}

func (t ClientType) String() string {
	switch t {
	case ClientType_CLI:
		return "command-line client"
	case ClientType_KBFS:
		return "KBFS"
	case ClientType_GUI_MAIN:
		return "desktop"
	case ClientType_GUI_HELPER:
		return "desktop helper"
	default:
		return "other"
	}
}

func (m MerkleTreeID) Number() int {
	return int(m)
}

func (m MerkleTreeID) String() string {
	return strconv.Itoa(int(m))
}

func (r BlockReference) String() string {
	return fmt.Sprintf("%s,%s", r.Bid.BlockHash, hex.EncodeToString(r.Nonce[:]))
}

func (r BlockReferenceCount) String() string {
	return fmt.Sprintf("%s,%d", r.Ref.String(), r.LiveCount)
}

func (sa SocialAssertion) String() string {
	if sa.Service == "email" {
		return fmt.Sprintf("[%s]@email", sa.User)
	}
	return fmt.Sprintf("%s@%s", sa.User, sa.Service)
}

func (sa SocialAssertion) TeamInviteType() string {
	return string(sa.Service)
}

func (sa SocialAssertion) TeamInviteName() TeamInviteName {
	return TeamInviteName(sa.User)
}

func (a GetArg) GetEndpoint() string {
	return a.Endpoint
}

func (a GetArg) GetHTTPArgs() []StringKVPair {
	return a.Args
}

func (a GetArg) GetHttpStatuses() []int {
	return a.HttpStatus
}

func (a GetArg) GetAppStatusCodes() []int {
	return a.AppStatusCode
}

func (a GetWithSessionArg) GetEndpoint() string {
	return a.Endpoint
}

func (a GetWithSessionArg) GetHTTPArgs() []StringKVPair {
	return a.Args
}

func (a GetWithSessionArg) GetHttpStatuses() []int {
	return a.HttpStatus
}

func (a GetWithSessionArg) GetAppStatusCodes() []int {
	return a.AppStatusCode
}

func (a PostArg) GetEndpoint() string {
	return a.Endpoint
}

func (a PostArg) GetHTTPArgs() []StringKVPair {
	return a.Args
}

func (a PostArg) GetHttpStatuses() []int {
	return a.HttpStatus
}

func (a PostArg) GetAppStatusCodes() []int {
	return a.AppStatusCode
}

func (a PostJSONArg) GetEndpoint() string {
	return a.Endpoint
}

func (a PostJSONArg) GetHTTPArgs() []StringKVPair {
	return a.Args
}

func (a PostJSONArg) GetHttpStatuses() []int {
	return a.HttpStatus
}

func (a PostJSONArg) GetAppStatusCodes() []int {
	return a.AppStatusCode
}

func (a DeleteArg) GetEndpoint() string {
	return a.Endpoint
}

func (a DeleteArg) GetHTTPArgs() []StringKVPair {
	return a.Args
}

func (a DeleteArg) GetHttpStatuses() []int {
	return a.HttpStatus
}

func (a DeleteArg) GetAppStatusCodes() []int {
	return a.AppStatusCode
}

// ToStatusAble is something that can be coerced into a status. Some error types
// in your application might want this.
type ToStatusAble interface {
	ToStatus() Status
}

// WrapError is a generic method that converts a Go Error into a RPC error status object.
// If the error is itself a Status object to being with, then it will just return that
// status object. If it is something that can be made into a Status object via the
// ToStatusAble interface, then we'll try that. Otherwise, we'll just make a generic
// Error type.
func WrapError(e error) interface{} {

	if e == nil {
		return nil
	}

	if ee, ok := e.(ToStatusAble); ok {
		tmp := ee.ToStatus()
		return &tmp
	}

	if status, ok := e.(*Status); ok {
		return status
	}

	if status, ok := e.(Status); ok {
		return status
	}

	return Status{
		Name: "GENERIC",
		Code: int(StatusCode_SCGeneric),
		Desc: e.Error(),
	}
}

// WrapError should function as a valid WrapErrorFunc as used by the RPC library.
var _ rpc.WrapErrorFunc = WrapError

// ErrorUnwrapper is converter that take a Status object off the wire and convert it
// into an Error that Go can understand, and you can discriminate on in your code.
// Though status object can act as Go errors, you can further convert them into
// typed errors via the Upcaster function if specified. An Upcaster takes a Status
// and returns something that obeys the Error interface, but can be anything your
// program needs.
type ErrorUnwrapper struct {
	Upcaster func(status Status) error
}

// MakeArg just makes a dummy object that we can unmarshal into, as needed by the
// underlying RPC library.
func (eu ErrorUnwrapper) MakeArg() interface{} {
	return &Status{}
}

// UnwrapError takes an incoming RPC object, attempts to coerce it into a Status
// object, and then Upcasts via the Upcaster or just returns if not was provided.
func (eu ErrorUnwrapper) UnwrapError(arg interface{}) (appError, dispatchError error) {
	targ, ok := arg.(*Status)
	if !ok {
		dispatchError = errors.New("Error converting status to keybase1.Status object")
		return nil, dispatchError
	}
	if targ == nil {
		return nil, nil
	}
	if targ.Code == int(StatusCode_SCOk) {
		return nil, nil
	}

	if eu.Upcaster != nil {
		appError = eu.Upcaster(*targ)
	} else {
		appError = *targ
	}
	return appError, nil
}

// Assert that Status can function as an error object.
var _ error = Status{}

// Assert that our ErrorUnwrapper fits the RPC error unwrapper spec.
var _ rpc.ErrorUnwrapper = ErrorUnwrapper{}

func (t TLFID) String() string {
	return string(t)
}

func (t TLFID) IsNil() bool {
	return len(t) == 0
}

func (t TLFID) Exists() bool {
	return !t.IsNil()
}

func (t TLFID) ToBytes() []byte {
	b, err := hex.DecodeString(string(t))
	if err != nil {
		return nil
	}
	return b
}

func (t TLFID) Eq(u TLFID) bool {
	return t == u
}

func (b TLFIdentifyBehavior) UnblockThenForceIDTable() bool {
	switch b {
	case TLFIdentifyBehavior_GUI_PROFILE:
		return true
	default:
		return false
	}
}

func (b TLFIdentifyBehavior) AlwaysRunIdentify() bool {
	switch b {
	case TLFIdentifyBehavior_CHAT_CLI,
		TLFIdentifyBehavior_CHAT_GUI,
		TLFIdentifyBehavior_SALTPACK,
		TLFIdentifyBehavior_KBFS_CHAT,
		TLFIdentifyBehavior_GUI_PROFILE:
		return true
	default:
		return false
	}
}

func (b TLFIdentifyBehavior) CanUseUntrackedFastPath() bool {
	switch b {
	case TLFIdentifyBehavior_CHAT_GUI,
		TLFIdentifyBehavior_FS_GUI,
		TLFIdentifyBehavior_SALTPACK,
		TLFIdentifyBehavior_RESOLVE_AND_CHECK:
		return true
	default:
		// TLFIdentifyBehavior_DEFAULT_KBFS, for filesystem activity that
		// doesn't have any other UI to report errors with.
		return false
	}
}

func (b TLFIdentifyBehavior) WarningInsteadOfErrorOnBrokenTracks() bool {
	switch b {
	case TLFIdentifyBehavior_CHAT_GUI,
		TLFIdentifyBehavior_FS_GUI:
		// The chat GUI is specifically exempted from broken
		// track errors, because people need to be able to use it to ask each other
		// about the fact that proofs are broken.
		return true
	default:
		return false
	}
}

func (b TLFIdentifyBehavior) NotifyGUIAboutBreaks() bool {
	switch b {
	case TLFIdentifyBehavior_FS_GUI:
		// Technically chat needs this too but is done in go/chat by itself and
		// doesn't use this. So we only put FS_GUI here.
		return true
	default:
		return false
	}
}

func (b TLFIdentifyBehavior) SkipUserCard() bool {
	switch b {
	case TLFIdentifyBehavior_CHAT_GUI,
		TLFIdentifyBehavior_FS_GUI,
		TLFIdentifyBehavior_RESOLVE_AND_CHECK:
		// We don't need to bother loading a user card in these cases.
		return true
	default:
		return false
	}
}

func (b TLFIdentifyBehavior) AllowCaching() bool {
	switch b {
	case TLFIdentifyBehavior_RESOLVE_AND_CHECK:
		// We Don't want to use any internal ID2 caching for ResolveAndCheck.
		return false
	default:
		return true
	}
}

func (b TLFIdentifyBehavior) AllowDeletedUsers() bool {
	switch b {
	case TLFIdentifyBehavior_RESOLVE_AND_CHECK:
		// ResolveAndCheck is OK with deleted users
		return true
	default:
		return false
	}
}

// All of the chat modes want to prevent tracker popups.
func (b TLFIdentifyBehavior) ShouldSuppressTrackerPopups() bool {
	switch b {
	case TLFIdentifyBehavior_CHAT_GUI,
		TLFIdentifyBehavior_FS_GUI,
		TLFIdentifyBehavior_CHAT_CLI,
		TLFIdentifyBehavior_KBFS_REKEY,
		TLFIdentifyBehavior_KBFS_QR,
		TLFIdentifyBehavior_SALTPACK,
		TLFIdentifyBehavior_RESOLVE_AND_CHECK,
		TLFIdentifyBehavior_KBFS_CHAT,
		TLFIdentifyBehavior_KBFS_INIT:
		// These are identifies that either happen without user interaction at
		// all, or happen while you're staring at some Keybase UI that can
		// report errors on its own. No popups needed.
		return true
	default:
		// TLFIdentifyBehavior_DEFAULT_KBFS, for filesystem activity that
		// doesn't have any other UI to report errors with.
		return false
	}
}

// SkipExternalChecks indicates we do not want to run any external proof checkers in
// identify modes that yield true.
func (b TLFIdentifyBehavior) SkipExternalChecks() bool {
	switch b {
	case TLFIdentifyBehavior_KBFS_QR,
		TLFIdentifyBehavior_KBFS_REKEY:
		return true
	default:
		return false
	}
}

// ShouldRefreshChatView indicates that when the identify is complete, we
// should update the chat system's view of the computed track breaks (also
// affects username coloring in the GUI).
func (b TLFIdentifyBehavior) ShouldRefreshChatView() bool {
	switch b {
	case TLFIdentifyBehavior_GUI_PROFILE, TLFIdentifyBehavior_CLI:
		return true
	default:
		return false
	}
}

func (c CanonicalTLFNameAndIDWithBreaks) Eq(r CanonicalTLFNameAndIDWithBreaks) bool {
	if c.CanonicalName != r.CanonicalName {
		return false
	}
	if c.TlfID != r.TlfID {
		return false
	}
	if len(c.Breaks.Breaks) != len(r.Breaks.Breaks) {
		return false
	}

	m := make(map[string]bool)
	for _, b := range c.Breaks.Breaks {
		m[b.User.Username] = true
	}
	for _, b := range r.Breaks.Breaks {
		if !m[b.User.Username] {
			return false
		}
	}

	return true
}

func (c CanonicalTlfName) String() string {
	return string(c)
}

func (u UserPlusKeys) GetUID() UID {
	return u.Uid
}

func (u UserPlusKeys) GetName() string {
	return u.Username
}

func (u UserPlusKeys) GetStatus() StatusCode {
	return u.Status
}

func (u UserPlusKeysV2AllIncarnations) GetRemoteTrack(uid UID) *RemoteTrack {
	ret, ok := u.Current.RemoteTracks[uid]
	if !ok {
		return nil
	}
	return &ret
}

func (u UserPlusAllKeys) GetUID() UID {
	return u.Base.GetUID()
}

func (u UserPlusAllKeys) GetName() string {
	return u.Base.GetName()
}

func (u UserPlusAllKeys) GetStatus() StatusCode {
	return u.Base.GetStatus()
}

func (u UserPlusAllKeys) GetDeviceID(kid KID) (ret DeviceID, err error) {
	for _, dk := range u.Base.DeviceKeys {
		if dk.KID.Equal(kid) {
			return dk.DeviceID, nil
		}
	}
	return ret, fmt.Errorf("no device key for kid")
}

func (u UserPlusAllKeys) Export() *User {
	return &User{Uid: u.GetUID(), Username: u.GetName()}
}

func (u UserVersionVector) Equal(u2 UserVersionVector) bool {
	if u2.Id == 0 || u.Id == 0 || u2.Id != u.Id {
		return false
	}
	if u2.SigHints == 0 || u.SigHints == 0 || u2.SigHints != u.SigHints {
		return false
	}
	if u2.SigChain == 0 || u.SigChain == 0 || u2.SigChain != u.SigChain {
		return false
	}
	return true
}

func ToDurationMsec(d time.Duration) DurationMsec {
	return DurationMsec(d / time.Millisecond)
}

func (d DurationMsec) Duration() time.Duration {
	return time.Duration(d) * time.Millisecond
}

func ToDurationSec(d time.Duration) DurationSec {
	return DurationSec(d / time.Second)
}

func (d DurationSec) Duration() time.Duration {
	return time.Duration(d) * time.Second
}

func (u UserPlusAllKeys) FindDevice(d DeviceID) *PublicKey {
	for _, k := range u.Base.DeviceKeys {
		if k.DeviceID.Eq(d) {
			return &k
		}
	}
	return nil
}

func (u UserPlusKeysV2) GetUID() UID {
	return u.Uid
}

func (u UserPlusKeysV2) GetName() string {
	return u.Username
}

func (u UserPlusKeysV2) GetStatus() StatusCode {
	return u.Status
}

func (u UserPlusKeysV2AllIncarnations) ExportToSimpleUser() User {
	return User{Uid: u.GetUID(), Username: u.GetName()}
}

func (u UserPlusKeysV2AllIncarnations) FindDevice(d DeviceID) *PublicKeyV2NaCl {
	for _, k := range u.Current.DeviceKeys {
		if k.DeviceID.Eq(d) {
			return &k
		}
	}
	return nil
}

func (u UserPlusKeysV2AllIncarnations) GetUID() UID {
	return u.Current.GetUID()
}

func (u UserPlusKeysV2AllIncarnations) GetName() string {
	return u.Current.GetName()
}

func (u UserPlusKeysV2AllIncarnations) GetStatus() StatusCode {
	return u.Current.GetStatus()
}

func (u UserPlusKeysV2AllIncarnations) AllIncarnations() (ret []UserPlusKeysV2) {
	ret = append(ret, u.Current)
	ret = append(ret, u.PastIncarnations...)
	return ret
}

func (u UserPlusKeys) FindKID(needle KID) *PublicKey {
	for _, k := range u.DeviceKeys {
		if k.KID.Equal(needle) {
			return &k
		}
	}
	return nil
}

// FindKID finds the Key and user incarnation that most recently used this KID.
// It is possible for users to use the same KID across incarnations (though definitely
// not condoned or encouraged). In that case, we'll give the most recent use.
func (u UserPlusKeysV2AllIncarnations) FindKID(kid KID) (*UserPlusKeysV2, *PublicKeyV2NaCl) {
	ret, ok := u.Current.DeviceKeys[kid]
	if ok {
		return &u.Current, &ret
	}
	for i := len(u.PastIncarnations) - 1; i >= 0; i-- {
		prev := u.PastIncarnations[i]
		ret, ok = prev.DeviceKeys[kid]
		if ok {
			return &prev, &ret
		}
	}
	return nil, nil
}

// HasKID returns true if u has the given KID in any of its incarnations.
// Useful for deciding if we should repoll a stale UPAK in the UPAK loader.
func (u UserPlusKeysV2AllIncarnations) HasKID(kid KID) bool {
	incarnation, _ := u.FindKID(kid)
	return (incarnation != nil)
}

func (u UserPlusKeysV2) FindDeviceKey(needle KID) *PublicKeyV2NaCl {
	for _, k := range u.DeviceKeys {
		if k.Base.Kid.Equal(needle) {
			return &k
		}
	}
	return nil
}

func (u UserPlusKeysV2) FindSigningDeviceKey(d DeviceID) *PublicKeyV2NaCl {
	for _, k := range u.DeviceKeys {
		if k.DeviceID.Eq(d) && k.Base.IsSibkey {
			return &k
		}
	}
	return nil
}

func (u UserPlusKeysV2) FindSigningDeviceKID(d DeviceID) (KID, string) {
	key := u.FindSigningDeviceKey(d)
	if key == nil {
		return KID(""), ""
	}
	return key.Base.Kid, key.DeviceDescription
}

func (u UserPlusKeysV2) FindEncryptionDeviceKeyFromSigningKID(parent KID) *PublicKeyV2NaCl {
	for _, k := range u.DeviceKeys {
		if !k.Base.IsSibkey && k.Parent != nil && k.Parent.Equal(parent) {
			return &k
		}
	}
	return nil
}

func (u UserPlusKeysV2) FindEncryptionKIDFromSigningKID(parent KID) KID {
	key := u.FindEncryptionDeviceKeyFromSigningKID(parent)
	if key == nil {
		return KID("")
	}
	return key.Base.Kid
}

func (u UserPlusKeysV2) FindEncryptionKIDFromDeviceID(deviceID DeviceID) KID {
	signingKID, _ := u.FindSigningDeviceKID(deviceID)
	if signingKID.IsNil() {
		return KID("")
	}
	return u.FindEncryptionKIDFromSigningKID(signingKID)
}

func (s ChatConversationID) String() string {
	return hex.EncodeToString(s)
}

func (s ChatConversationID) Bytes() []byte {
	return s
}

// IsOlderThan returns true if any of the versions of u are older than v
func (u UserPlusAllKeys) IsOlderThan(v UserPlusAllKeys) bool {
	if u.Base.Uvv.SigChain < v.Base.Uvv.SigChain {
		return true
	}
	if u.Base.Uvv.Id < v.Base.Uvv.Id {
		return true
	}
	return false
}

// IsOlderThan returns true if any of the versions of u are older than v
func (u UserPlusKeysV2AllIncarnations) IsOlderThan(v UserPlusKeysV2AllIncarnations) bool {
	if u.Uvv.SigChain < v.Uvv.SigChain {
		return true
	}
	if u.Uvv.Id < v.Uvv.Id {
		return true
	}
	if u.Uvv.CachedAt < v.Uvv.CachedAt {
		return true
	}
	return false
}

func (u UserPlusKeysV2AllIncarnations) AllDeviceNames() []string {
	var names []string

	for _, k := range u.Current.DeviceKeys {
		if k.DeviceDescription != "" {
			names = append(names, k.DeviceDescription)
		}
	}
	for _, v := range u.PastIncarnations {
		for _, k := range v.DeviceKeys {
			if k.DeviceDescription != "" {
				names = append(names, k.DeviceDescription)
			}
		}
	}

	return names
}

func (ut UserOrTeamID) String() string {
	return string(ut)
}

func (ut UserOrTeamID) ToBytes() []byte {
	b, err := hex.DecodeString(string(ut))
	if err != nil {
		return nil
	}
	return b
}

func (ut UserOrTeamID) IsNil() bool {
	return len(ut) == 0
}

func (ut UserOrTeamID) Exists() bool {
	return !ut.IsNil()
}

func (ut UserOrTeamID) Equal(v UserOrTeamID) bool {
	return ut == v
}

func (ut UserOrTeamID) NotEqual(v UserOrTeamID) bool {
	return !ut.Equal(v)
}

func (ut UserOrTeamID) Less(v UserOrTeamID) bool {
	return ut < v
}

func (ut UserOrTeamID) AsUser() (UID, error) {
	if !ut.IsUser() {
		return UID(""), errors.New("ID is not a UID")
	}
	return UID(ut), nil
}

func (ut UserOrTeamID) AsUserOrBust() UID {
	uid, err := ut.AsUser()
	if err != nil {
		panic(err)
	}
	return uid
}

func (ut UserOrTeamID) IsPublic() bool {
	if ut.IsUser() {
		return true
	}
	return ut.AsTeamOrBust().IsPublic()
}

func (ut UserOrTeamID) AsTeam() (TeamID, error) {
	if !ut.IsTeamOrSubteam() {
		return TeamID(""), fmt.Errorf("ID is not a team ID (%s)", ut)
	}
	return TeamID(ut), nil
}

func (ut UserOrTeamID) AsTeamOrBust() TeamID {
	tid, err := ut.AsTeam()
	if err != nil {
		panic(err)
	}
	return tid
}

func (ut UserOrTeamID) Compare(ut2 UserOrTeamID) int {
	return strings.Compare(string(ut), string(ut2))
}

func (ut UserOrTeamID) IsUser() bool {
	i := idSchema{
		length:        UID_LEN,
		magicSuffixes: map[byte]bool{UID_SUFFIX: true, UID_SUFFIX_2: true},
		typeHint:      "user id",
	}
	return i.check(string(ut)) == nil
}

func (ut UserOrTeamID) IsTeam() bool {
	i := idSchema{
		length:        TEAMID_LEN,
		magicSuffixes: map[byte]bool{TEAMID_PRIVATE_SUFFIX: true, TEAMID_PUBLIC_SUFFIX: true},
		typeHint:      "team id",
	}
	return i.check(string(ut)) == nil
}

func (ut UserOrTeamID) IsSubteam() bool {
	i := idSchema{
		length:        TEAMID_LEN,
		magicSuffixes: map[byte]bool{SUB_TEAMID_PRIVATE_SUFFIX: true, SUB_TEAMID_PUBLIC_SUFFIX: true},
		typeHint:      "subteam id",
	}
	return i.check(string(ut)) == nil
}

func (ut UserOrTeamID) IsTeamOrSubteam() bool {
	return ut.IsTeam() || ut.IsSubteam()
}

func (ut UserOrTeamID) IsValidID() bool {
	return ut.IsUser() || ut.IsTeamOrSubteam()
}

// Preconditions:
// 	-first four bits (in Little Endian) of UserOrTeamID are
// 	 	independent and uniformly distributed
//	-UserOrTeamID must have an even number of bits, or this will always
//   	return 0
// Returns a number in [0, shardCount) which can be treated as roughly
// uniformly distributed. Used for things that need to shard by user.
func (ut UserOrTeamID) GetShard(shardCount int) (int, error) {
	if !ut.IsValidID() {
		return 0, fmt.Errorf("Bad ID, does not match any known valid type")
	}
	bytes, err := hex.DecodeString(string(ut))
	if err != nil {
		return 0, err
	}
	// LittleEndian.Uint32 truncates to obtain 4 bytes from the buffer
	n := binary.LittleEndian.Uint32(bytes)
	return int(n % uint32(shardCount)), nil
}

// Size implements the cache.Measurable interface.
func (ut UserOrTeamID) Size() int {
	return len(ut) + ptrSize
}

func (m *MaskB64) UnmarshalJSON(b []byte) error {
	unquoted := UnquoteBytes(b)
	if len(unquoted) == 0 {
		return nil
	}
	dbuf := make([]byte, base64.StdEncoding.DecodedLen(len(unquoted)))
	n, err := base64.StdEncoding.Decode(dbuf, unquoted)
	if err != nil {
		return err
	}
	*m = MaskB64(dbuf[:n])
	return nil
}

func (m *MaskB64) MarshalJSON() ([]byte, error) {
	s := Quote(base64.StdEncoding.EncodeToString([]byte(*m)))
	return []byte(s), nil
}

func PublicKeyV1FromPGPKeyV2(keyV2 PublicKeyV2PGPSummary) PublicKey {
	return PublicKey{
		KID:            keyV2.Base.Kid,
		PGPFingerprint: hex.EncodeToString(keyV2.Fingerprint[:]),
		PGPIdentities:  keyV2.Identities,
		IsSibkey:       keyV2.Base.IsSibkey,
		IsEldest:       keyV2.Base.IsEldest,
		CTime:          keyV2.Base.CTime,
		ETime:          keyV2.Base.ETime,
		IsRevoked:      (keyV2.Base.Revocation != nil),
	}
}

func PublicKeyV1FromDeviceKeyV2(keyV2 PublicKeyV2NaCl) PublicKey {
	parentID := ""
	if keyV2.Parent != nil {
		parentID = string(*keyV2.Parent)
	}
	return PublicKey{
		KID:               keyV2.Base.Kid,
		IsSibkey:          keyV2.Base.IsSibkey,
		IsEldest:          keyV2.Base.IsEldest,
		ParentID:          parentID,
		DeviceID:          keyV2.DeviceID,
		DeviceDescription: keyV2.DeviceDescription,
		DeviceType:        keyV2.DeviceType,
		CTime:             keyV2.Base.CTime,
		ETime:             keyV2.Base.ETime,
		IsRevoked:         (keyV2.Base.Revocation != nil),
	}
}

const (
	DeviceTypeV2_NONE    DeviceTypeV2 = "none"
	DeviceTypeV2_PAPER   DeviceTypeV2 = "backup"
	DeviceTypeV2_DESKTOP DeviceTypeV2 = "desktop"
	DeviceTypeV2_MOBILE  DeviceTypeV2 = "mobile"
)

func (d DeviceTypeV2) String() string {
	return string(d)
}

func StringToDeviceTypeV2(s string) (d DeviceTypeV2, err error) {
	deviceType := DeviceTypeV2(s)
	switch deviceType {
	case DeviceTypeV2_NONE, DeviceTypeV2_DESKTOP, DeviceTypeV2_MOBILE, DeviceTypeV2_PAPER:
		//pass
	default:
		return DeviceTypeV2_NONE, fmt.Errorf("Unknown DeviceType: %s", deviceType)
	}
	return deviceType, nil
}

// defaults to Desktop
func (dt *DeviceTypeV2) ToDeviceType() DeviceType {
	if *dt == DeviceTypeV2_MOBILE {
		return DeviceType_MOBILE
	}
	return DeviceType_DESKTOP
}

func RevokedKeyV1FromDeviceKeyV2(keyV2 PublicKeyV2NaCl) RevokedKey {
	return RevokedKey{
		Key: PublicKeyV1FromDeviceKeyV2(keyV2),
		Time: KeybaseTime{
			Unix:  keyV2.Base.Revocation.Time,
			Chain: keyV2.Base.Revocation.PrevMerkleRootSigned.Seqno,
		},
		By: keyV2.Base.Revocation.SigningKID,
	}
}

// UPKV2 should supersede UPAK eventually, but lots of older code requires
// UPAK. This is a simple converter function.
func UPAKFromUPKV2AI(uV2 UserPlusKeysV2AllIncarnations) UserPlusAllKeys {
	// Convert the PGP keys.
	var pgpKeysV1 []PublicKey
	for _, keyV2 := range uV2.Current.PGPKeys {
		pgpKeysV1 = append(pgpKeysV1, PublicKeyV1FromPGPKeyV2(keyV2))
	}

	// Convert the device keys.
	var deviceKeysV1 []PublicKey
	var revokedDeviceKeysV1 []RevokedKey
	var resets []ResetSummary
	for _, keyV2 := range uV2.Current.DeviceKeys {
		if keyV2.Base.Revocation != nil {
			revokedDeviceKeysV1 = append(revokedDeviceKeysV1, RevokedKeyV1FromDeviceKeyV2(keyV2))
		} else {
			deviceKeysV1 = append(deviceKeysV1, PublicKeyV1FromDeviceKeyV2(keyV2))
		}
	}
	sort.Slice(deviceKeysV1, func(i, j int) bool { return deviceKeysV1[i].KID < deviceKeysV1[j].KID })
	sort.Slice(revokedDeviceKeysV1, func(i, j int) bool { return revokedDeviceKeysV1[i].Key.KID < revokedDeviceKeysV1[j].Key.KID })

	// Assemble the deleted device keys from past incarnations.
	var deletedDeviceKeysV1 []PublicKey
	for _, incarnation := range uV2.PastIncarnations {
		for _, keyV2 := range incarnation.DeviceKeys {
			deletedDeviceKeysV1 = append(deletedDeviceKeysV1, PublicKeyV1FromDeviceKeyV2(keyV2))
		}
		if reset := incarnation.Reset; reset != nil {
			resets = append(resets, *reset)
		}
	}
	sort.Slice(deletedDeviceKeysV1, func(i, j int) bool { return deletedDeviceKeysV1[i].KID < deletedDeviceKeysV1[j].KID })

	// List and sort the remote tracks. Note that they *must* be sorted.
	var remoteTracks []RemoteTrack
	for _, track := range uV2.Current.RemoteTracks {
		remoteTracks = append(remoteTracks, track)
	}
	sort.Slice(remoteTracks, func(i, j int) bool { return remoteTracks[i].Username < remoteTracks[j].Username })

	// Apart from all the key mangling above, everything else is just naming
	// and layout changes. Assemble the final UPAK.
	return UserPlusAllKeys{
		Base: UserPlusKeys{
			Uid:               uV2.Current.Uid,
			Username:          uV2.Current.Username,
			EldestSeqno:       uV2.Current.EldestSeqno,
			Status:            uV2.Current.Status,
			DeviceKeys:        deviceKeysV1,
			RevokedDeviceKeys: revokedDeviceKeysV1,
			DeletedDeviceKeys: deletedDeviceKeysV1,
			PGPKeyCount:       len(pgpKeysV1),
			Uvv:               uV2.Uvv,
			PerUserKeys:       uV2.Current.PerUserKeys,
			Resets:            resets,
		},
		PGPKeys:      pgpKeysV1,
		RemoteTracks: remoteTracks,
	}
}

func (u UserVersionPercentForm) String() string {
	return string(u)
}

func NewUserVersion(uid UID, eldestSeqno Seqno) UserVersion {
	return UserVersion{
		Uid:         uid,
		EldestSeqno: eldestSeqno,
	}
}

func (u UserVersion) PercentForm() UserVersionPercentForm {
	return UserVersionPercentForm(u.String())
}

func (u UserVersion) String() string {
	return fmt.Sprintf("%s%%%d", u.Uid, u.EldestSeqno)
}

func (u UserVersion) Eq(v UserVersion) bool {
	return u.Uid.Equal(v.Uid) && u.EldestSeqno.Eq(v.EldestSeqno)
}

func (u UserVersion) TeamInviteName() TeamInviteName {
	return TeamInviteName(u.PercentForm())
}

func (u UserVersion) IsNil() bool {
	return u.Uid.IsNil()
}

type ByUserVersionID []UserVersion

func (b ByUserVersionID) Len() int      { return len(b) }
func (b ByUserVersionID) Swap(i, j int) { b[i], b[j] = b[j], b[i] }
func (b ByUserVersionID) Less(i, j int) bool {
	return b[i].String() < b[j].String()
}

func (k CryptKey) Material() Bytes32 {
	return k.Key
}

func (k CryptKey) Generation() int {
	return k.KeyGeneration
}

func (k TeamApplicationKey) Material() Bytes32 {
	return k.Key
}

func (k TeamApplicationKey) Generation() int {
	return int(k.KeyGeneration)
}

func (t TeamMembers) AllUIDs() []UID {
	m := make(map[UID]bool)
	for _, u := range t.Owners {
		m[u.Uid] = true
	}
	for _, u := range t.Admins {
		m[u.Uid] = true
	}
	for _, u := range t.Writers {
		m[u.Uid] = true
	}
	for _, u := range t.Readers {
		m[u.Uid] = true
	}
	for _, u := range t.Bots {
		m[u.Uid] = true
	}
	for _, u := range t.RestrictedBots {
		m[u.Uid] = true
	}
	var all []UID
	for u := range m {
		all = append(all, u)
	}
	return all
}

func (t TeamMembers) AllUserVersions() []UserVersion {
	m := make(map[UID]UserVersion)
	for _, u := range t.Owners {
		m[u.Uid] = u
	}
	for _, u := range t.Admins {
		m[u.Uid] = u
	}
	for _, u := range t.Writers {
		m[u.Uid] = u
	}
	for _, u := range t.Readers {
		m[u.Uid] = u
	}
	for _, u := range t.Bots {
		m[u.Uid] = u
	}
	for _, u := range t.RestrictedBots {
		m[u.Uid] = u
	}
	var all []UserVersion
	for _, uv := range m {
		all = append(all, uv)
	}
	return all
}

func (s TeamMemberStatus) IsActive() bool {
	return s == TeamMemberStatus_ACTIVE
}

func (s TeamMemberStatus) IsReset() bool {
	return s == TeamMemberStatus_RESET
}

func (s TeamMemberStatus) IsDeleted() bool {
	return s == TeamMemberStatus_DELETED
}

func FilterInactiveReadersWriters(arg []TeamMemberDetails) (ret []TeamMemberDetails) {
	for _, v := range arg {
		if v.Status.IsActive() || (v.Role != TeamRole_READER && v.Role != TeamRole_WRITER) {
			ret = append(ret, v)
		}
	}
	return ret
}

func (t TeamName) IsNil() bool {
	return len(t.Parts) == 0
}

// underscores allowed, just not first or doubled
var namePartRxx = regexp.MustCompile(`^([a-zA-Z0-9][a-zA-Z0-9_]?)+$`)
var implicitRxxString = fmt.Sprintf("^%s[0-9a-f]{%d}$", ImplicitTeamPrefix, ImplicitSuffixLengthBytes*2)
var implicitNameRxx = regexp.MustCompile(implicitRxxString)

const ImplicitTeamPrefix = "__keybase_implicit_team__"
const ImplicitSuffixLengthBytes = 16

func stringToTeamNamePart(s string) TeamNamePart {
	return TeamNamePart(strings.ToLower(s))
}

func rootTeamNameFromString(s string) (TeamName, error) {
	if implicitNameRxx.MatchString(s) {
		return TeamName{Parts: []TeamNamePart{stringToTeamNamePart(s)}}, nil
	}
	if err := validatePart(s); err != nil {
		return TeamName{}, err
	}
	return TeamName{Parts: []TeamNamePart{stringToTeamNamePart(s)}}, nil
}

func validatePart(s string) (err error) {
	if len(s) == 0 {
		return errors.New("team names cannot be empty")
	}
	if !(len(s) >= 2 && len(s) <= 16) {
		return errors.New("team names must be between 2 and 16 characters long")
	}
	if !namePartRxx.MatchString(s) {
		return errors.New("Keybase team names must be letters (a-z), numbers, and underscores. Also, they can't start with underscores or use double underscores, to avoid confusion.")
	}
	return nil
}

func TeamNameFromString(s string) (TeamName, error) {
	ret := TeamName{}

	s = strings.ToLower(s)
	parts := strings.Split(s, ".")
	if len(parts) == 0 {
		return ret, errors.New("team names cannot be empty")
	}
	if len(parts) == 1 {
		return rootTeamNameFromString(s)
	}
	tmp := make([]TeamNamePart, len(parts))
	for i, part := range parts {
		err := validatePart(part)
		if err != nil {
			return TeamName{}, fmt.Errorf("Could not parse name as team; bad name component %q: %s", part, err.Error())
		}
		tmp[i] = stringToTeamNamePart(part)
	}
	return TeamName{Parts: tmp}, nil
}

func (p TeamNamePart) String() string {
	return string(p)
}

func (t TeamName) AssertEqString(s string) error {
	tmp, err := TeamNameFromString(s)
	if err != nil {
		return err
	}
	if !t.Eq(tmp) {
		return fmt.Errorf("Team equality check failed: %s != %s", t.String(), s)
	}
	return nil
}

func (t TeamName) String() string {
	tmp := make([]string, len(t.Parts))
	for i, p := range t.Parts {
		tmp[i] = strings.ToLower(string(p))
	}
	return strings.Join(tmp, ".")
}

func (t TeamName) Eq(t2 TeamName) bool {
	return t.String() == t2.String()
}

func (t TeamName) IsRootTeam() bool {
	return len(t.Parts) == 1
}

func (t TeamName) ToPrivateTeamID() TeamID {
	return t.ToTeamID(false)
}

func (t TeamName) ToPublicTeamID() TeamID {
	return t.ToTeamID(true)
}

// Get the top level team id for this team name.
// Only makes sense for non-sub teams.
// The first 15 bytes of the sha256 of the lowercase team name,
// followed by the byte 0x24, encoded as hex.
func (t TeamName) ToTeamID(public bool) TeamID {
	low := strings.ToLower(t.String())
	sum := sha256.Sum256([]byte(low))
	var useSuffix byte = TEAMID_PRIVATE_SUFFIX
	if public {
		useSuffix = TEAMID_PUBLIC_SUFFIX
	}
	bs := append(sum[:15], useSuffix)
	res, err := TeamIDFromString(hex.EncodeToString(bs))
	if err != nil {
		panic(err)
	}
	return res
}

// Return a new team name with the part added to the end.
// For example {foo.bar}.Append(baz) -> {foo.bar.baz}
func (t TeamName) Append(part string) (t3 TeamName, err error) {
	t2 := t.DeepCopy()
	t2.Parts = append(t2.Parts, TeamNamePart(part))
	t3, err = TeamNameFromString(t2.String())
	return t3, err
}

func (t TeamName) LastPart() TeamNamePart {
	return t.Parts[len(t.Parts)-1]
}

func (t TeamName) RootAncestorName() TeamName {
	if len(t.Parts) == 0 {
		// this should never happen
		return TeamName{}
	}
	return TeamName{
		Parts: t.Parts[:1],
	}
}

func (t TeamName) RootID() TeamID {
	return t.RootAncestorName().ToTeamID(false)
}

func (t TeamName) Parent() (TeamName, error) {
	if len(t.Parts) == 0 {
		return t, fmt.Errorf("empty team name")
	}
	if t.IsRootTeam() {
		return t, fmt.Errorf("root team has no parent")
	}
	return TeamName{
		Parts: t.Parts[:len(t.Parts)-1],
	}, nil
}

func (t TeamName) SwapLastPart(newLast string) (TeamName, error) {
	parent, err := t.Parent()
	if err != nil {
		return t, err
	}
	return parent.Append(newLast)
}

func (t TeamName) IsImplicit() bool {
	return strings.HasPrefix(t.String(), ImplicitTeamPrefix)
}

// The number of parts in a team name.
// Root teams have 1.
func (t TeamName) Depth() int {
	return len(t.Parts)
}

func (t TeamName) IsAncestorOf(other TeamName) bool {
	depth := t.Depth()
	if depth >= other.Depth() {
		return false
	}

	for i := 0; i < depth; i++ {
		if !other.Parts[i].Eq(t.Parts[i]) {
			return false
		}
	}

	return true
}

func (t TeamNamePart) Eq(t2 TeamNamePart) bool {
	return string(t) == string(t2)
}

func (u UserPlusKeys) ToUserVersion() UserVersion {
	return UserVersion{
		Uid:         u.Uid,
		EldestSeqno: u.EldestSeqno,
	}
}

func (u UserPlusKeysV2) ToUserVersion() UserVersion {
	return UserVersion{
		Uid:         u.Uid,
		EldestSeqno: u.EldestSeqno,
	}
}

func (u UserPlusKeysV2AllIncarnations) ToUserVersion() UserVersion {
	return u.Current.ToUserVersion()
}

func (u UserPlusKeysV2AllIncarnations) GetPerUserKeyAtSeqno(uv UserVersion, seqno Seqno, merkleSeqno Seqno) (*PerUserKey, error) {
	incarnations := u.AllIncarnations()
	for _, incarnation := range incarnations {
		if incarnation.EldestSeqno == uv.EldestSeqno {
			if incarnation.Reset != nil && incarnation.Reset.MerkleRoot.Seqno <= merkleSeqno {
				return nil, nil
			}
			if len(incarnation.PerUserKeys) == 0 {
				return nil, nil
			}
			for i := range incarnation.PerUserKeys {
				perUserKey := incarnation.PerUserKeys[len(incarnation.PerUserKeys)-1-i]
				if perUserKey.Seqno <= seqno {
					return &perUserKey, nil
				}
			}
			return nil, fmt.Errorf("didn't find per user key at seqno %d for uv %v", seqno, uv)
		}
	}
	return nil, fmt.Errorf("didn't find uv %v in upak", uv)
}

// Can return nil.
func (u UserPlusKeysV2) GetLatestPerUserKey() *PerUserKey {
	if len(u.PerUserKeys) > 0 {
		return &u.PerUserKeys[len(u.PerUserKeys)-1]
	}
	return nil
}

// Can return nil.
func (u UserPlusKeysV2) GetPerUserKeyByGen(gen PerUserKeyGeneration) *PerUserKey {
	genint := int(gen)
	if genint <= 0 || genint > len(u.PerUserKeys) {
		return nil
	}
	puk := u.PerUserKeys[genint-1]
	if puk.Gen != genint {
		// The PerUserKeys field of this object is malformed
		return nil
	}
	return &puk
}

func (s PerTeamKeySeed) ToBytes() []byte { return s[:] }

func (s PerTeamKeySeed) IsZero() bool {
	var tmp PerTeamKeySeed
	return hmac.Equal(s[:], tmp[:])
}

func PerTeamKeySeedFromBytes(b []byte) (PerTeamKeySeed, error) {
	var ret PerTeamKeySeed
	if len(b) != len(ret) {
		return PerTeamKeySeed{}, fmt.Errorf("decrypt yielded a bad-sized team secret: %d != %d", len(b), len(ret))
	}
	copy(ret[:], b)
	return ret, nil
}

func (s SigChainLocation) Eq(s2 SigChainLocation) bool {
	return s.Seqno == s2.Seqno && s.SeqType == s2.SeqType
}

func (s SigChainLocation) LessThanOrEqualTo(s2 SigChainLocation) bool {
	return s.SeqType == s2.SeqType && s.Seqno <= s2.Seqno
}

func (s SigChainLocation) Comparable(s2 SigChainLocation) error {
	if s.SeqType != s2.SeqType {
		return fmt.Errorf("mismatched seqtypes: %v != %v", s.SeqType, s2.SeqType)
	}
	return nil
}

func (s SigChainLocation) Sub1() SigChainLocation {
	return SigChainLocation{
		Seqno:   s.Seqno - 1,
		SeqType: s.SeqType,
	}
}

func (r TeamRole) IsAdminOrAbove() bool {
	return r.IsOrAbove(TeamRole_ADMIN)
}

func (r TeamRole) IsWriterOrAbove() bool {
	return r.IsOrAbove(TeamRole_WRITER)
}

func (r TeamRole) IsReaderOrAbove() bool {
	return r.IsOrAbove(TeamRole_READER)
}

func (r TeamRole) IsBotOrAbove() bool {
	return r.IsOrAbove(TeamRole_BOT)
}

func (r TeamRole) IsRestrictedBotOrAbove() bool {
	return r.IsOrAbove(TeamRole_RESTRICTEDBOT)
}

func (r TeamRole) IsBotLike() bool {
	switch r {
	case TeamRole_BOT, TeamRole_RESTRICTEDBOT:
		return true
	}
	return false
}

func (r TeamRole) IsRestrictedBot() bool {
	return r == TeamRole_RESTRICTEDBOT
}

func (r TeamRole) teamRoleForOrderingOnly() int {
	switch r {
	case TeamRole_NONE:
		return 0
	case TeamRole_RESTRICTEDBOT:
		return 1
	case TeamRole_BOT:
		return 2
	case TeamRole_READER,
		TeamRole_WRITER,
		TeamRole_ADMIN,
		TeamRole_OWNER:
		return int(r) + 2
	default:
		return 0
	}
}

func (r TeamRole) IsOrAbove(min TeamRole) bool {
	return r.teamRoleForOrderingOnly() >= min.teamRoleForOrderingOnly()
}

func (r TeamRole) HumanString() string {
	if r.IsRestrictedBot() {
		return "restricted bot"
	}
	return strings.ToLower(r.String())
}

type idSchema struct {
	length        int
	magicSuffixes map[byte]bool
	typeHint      string
}

func (i idSchema) check(s string) error {
	xs, err := hex.DecodeString(s)
	if err != nil {
		return err
	}
	if len(xs) != i.length {
		return fmt.Errorf("%s: Wrong ID length (got %d)", i.typeHint, len(xs))
	}
	suffix := xs[len(xs)-1]
	if !i.magicSuffixes[suffix] {
		return fmt.Errorf("%s: Incorrect suffix byte (got 0x%x)", i.typeHint, suffix)
	}
	return nil
}

func TeamInviteIDFromString(s string) (TeamInviteID, error) {
	if err := (idSchema{16, map[byte]bool{0x27: true}, "team invite ID"}).check(s); err != nil {
		return TeamInviteID(""), err
	}
	return TeamInviteID(s), nil
}

func (i TeamInviteID) Eq(i2 TeamInviteID) bool {
	return string(i) == string(i2)
}

func (t TeamInviteType) String() (string, error) {
	c, err := t.C()
	if err != nil {
		return "", err
	}
	switch c {
	case TeamInviteCategory_KEYBASE:
		return "keybase", nil
	case TeamInviteCategory_EMAIL:
		return "email", nil
	case TeamInviteCategory_PHONE:
		return "phone", nil
	case TeamInviteCategory_SBS:
		return string(t.Sbs()), nil
	case TeamInviteCategory_SEITAN:
		return "seitan_invite_token", nil
	case TeamInviteCategory_UNKNOWN:
		return t.Unknown(), nil
	}

	return "", nil
}

func (a TeamInviteType) Eq(b TeamInviteType) bool {
	ac, err := a.C()
	if err != nil {
		return false
	}
	bc, err := b.C()
	if err != nil {
		return false
	}
	if ac != bc {
		return false
	}

	switch ac {
	case TeamInviteCategory_KEYBASE:
		return true
	case TeamInviteCategory_EMAIL, TeamInviteCategory_PHONE:
		return true
	case TeamInviteCategory_SBS:
		return a.Sbs() == b.Sbs()
	case TeamInviteCategory_UNKNOWN:
		return a.Unknown() == b.Unknown()
	}

	return false
}

func (t TeamInvite) KeybaseUserVersion() (UserVersion, error) {
	category, err := t.Type.C()
	if err != nil {
		return UserVersion{}, err
	}
	if category != TeamInviteCategory_KEYBASE {
		return UserVersion{}, errors.New("KeybaseUserVersion: invalid invite category, must be keybase")
	}

	return ParseUserVersion(UserVersionPercentForm(t.Name))
}

// TeamMaxUsesInfinite is a value for max_uses field which makes team invite
// multiple use, with infinite number of uses.
const TeamMaxUsesInfinite = TeamInviteMaxUses(-1)

func NewTeamInviteFiniteUses(maxUses int) (v TeamInviteMaxUses, err error) {
	if maxUses <= 0 {
		return v, errors.New("non-infinite uses with nonpositive maxUses")
	}
	return TeamInviteMaxUses(maxUses), nil
}

func (e *TeamInviteMaxUses) IsNotNilAndValid() bool {
	return e != nil && (*e > 0 || *e == TeamMaxUsesInfinite)
}

func max(a, b int) int {
	if a >= b {
		return a
	}
	return b
}

func (ti TeamInvite) UsesLeftString(alreadyUsed int) string {
	if ti.IsInfiniteUses() {
		return "unlimited uses left"
	}
	var maxUses int
	if ti.MaxUses == nil {
		maxUses = 1
	} else {
		maxUses = int(*ti.MaxUses)
	}
	return formatItems("use", "uses", max(maxUses-alreadyUsed, 0))
}

func (ti TeamInvite) IsInfiniteUses() bool {
	return ti.MaxUses != nil && *ti.MaxUses == TeamMaxUsesInfinite
}

func (ti TeamInvite) IsUsedUp(alreadyUsed int) bool {
	maxUses := ti.MaxUses
	if maxUses == nil {
		return alreadyUsed >= 1
	}
	if *maxUses == TeamMaxUsesInfinite {
		return false
	}
	return alreadyUsed >= int(*maxUses)
}

func (ti TeamInvite) IsExpired(now time.Time) bool {
	if ti.Etime == nil {
		return false
	}
	etime := FromUnixTime(*ti.Etime)
	return now.After(etime)
}

func formatItems(singular string, plural string, count int) string {
	if count == 1 {
		return "1 " + singular
	}
	return fmt.Sprintf("%d %s", count, plural)
}

// ComputeValidity is used for invitelinks, but is accurate for other invites as well.
// It computes whether the invite is still valid (i.e., if it can still be used),
// and a short description of when it was invalidated or under what conditions it can
// be later invalidated.
func (md TeamInviteMetadata) ComputeValidity(now time.Time,
	userLog map[UserVersion][]UserLogPoint) (isValid bool, validityDescription string) {

	isInvalid := false
	invalidationAction := ""
	var invalidationTime *time.Time
	var usedInviteCount int
	code, _ := md.Status.Code()
	switch code {
	case TeamInviteMetadataStatusCode_ACTIVE:
		isExpired := md.Invite.IsExpired(now)
		if isExpired {
			expireTime := md.Invite.Etime.Time()
			invalidationTime = &expireTime
		}
		usedInvites := md.UsedInvites
		// If this is an old-style invite that was completed; it wouldn't be ACTIVE anymore,
		// so we can assume len(usedInvites) is correct, since it should be empty (implying
		// the invite is not UsedUp.
		isUsedUp := md.Invite.IsUsedUp(len(usedInvites))
		if isUsedUp {
			// implies usedInvites is nonempty
			usedInvites := md.UsedInvites
			teamUserLogPoint := usedInvites[len(usedInvites)-1]
			logPoint := userLog[teamUserLogPoint.Uv][teamUserLogPoint.LogPoint]
			usedUpTime := logPoint.SigMeta.Time.Time()
			if invalidationTime == nil || usedUpTime.Before(*invalidationTime) {
				invalidationTime = &usedUpTime
			}
		}
		if isExpired || isUsedUp {
			isInvalid = true
			invalidationAction = "Expired"
		}
		usedInviteCount = len(usedInvites)
	case TeamInviteMetadataStatusCode_OBSOLETE:
		isInvalid = true
		invalidationAction = "Obsoleted"
		// no invalidation time for obsoletes
		usedInviteCount = 0
	case TeamInviteMetadataStatusCode_CANCELLED:
		isInvalid = true
		invalidationAction = "Cancelled"
		cancelTime := md.Status.Cancelled().TeamSigMeta.SigMeta.Time.Time()
		invalidationTime = &cancelTime
		usedInviteCount = len(md.UsedInvites)
	case TeamInviteMetadataStatusCode_COMPLETED:
		isInvalid = true
		invalidationAction = "Completed"
		completeTime := md.Status.Completed().TeamSigMeta.SigMeta.Time.Time()
		invalidationTime = &completeTime
		usedInviteCount = 1
	default:
		return false, fmt.Sprintf("unknown invite status %v", code)
	}

	if isInvalid {
		ret := ""
		ret += invalidationAction
		if invalidationTime != nil {
			invalidationDeltaFormatted := kbtime.RelTime(*invalidationTime, now, "", "")
			ret += " " + invalidationDeltaFormatted + " ago"
		}
		return false, ret
	}

	if md.Invite.Etime == nil && md.Invite.IsInfiniteUses() {
		return true, "Does not expire"
	}

	ret := "Expires"
	if md.Invite.Etime != nil {
		expirationTimeConverted := FromUnixTime(*md.Invite.Etime)
		expirationDeltaFormatted := kbtime.RelTime(expirationTimeConverted, now, "", "")
		ret += " in " + expirationDeltaFormatted
	}
	if md.Invite.Etime != nil && !md.Invite.IsInfiniteUses() {
		ret += " or"
	}
	if !md.Invite.IsInfiniteUses() {
		ret += " after " + md.Invite.UsesLeftString(usedInviteCount)
	}
	return true, ret
}

func (m MemberInfo) TeamName() (TeamName, error) {
	return TeamNameFromString(m.FqName)
}

func (i ImplicitTeamUserSet) NumTotalUsers() int {
	return len(i.KeybaseUsers) + len(i.UnresolvedUsers)
}

func (i ImplicitTeamUserSet) List() string {
	var names []string
	names = append(names, i.KeybaseUsers...)
	for _, u := range i.UnresolvedUsers {
		names = append(names, u.String())
	}
	sort.Strings(names)
	return strings.Join(names, ",")
}

func (n ImplicitTeamDisplayName) String() string {
	name := n.Writers.List()

	if n.Readers.NumTotalUsers() > 0 {
		name += "#" + n.Readers.List()
	}

	return name
}

func (c *ImplicitTeamConflictInfo) IsConflict() bool {
	return c != nil && c.Generation > ConflictGeneration(0)
}

const (
	// LockIDVersion0 is the first ever version for lock ID format.
	LockIDVersion0 byte = iota
)

// LockIDFromBytes takes the first 8 bytes of the sha512 over data, overwrites
// first byte with the version byte, then interprets it as int64 using big
// endian, and returns the value as LockID.
func LockIDFromBytes(data []byte) LockID {
	sum := sha512.Sum512(data)
	sum[0] = LockIDVersion0
	return LockID(binary.BigEndian.Uint64(sum[:8]))
}

// MDPriority is the type for the priority field of a metadata put. mdserver
// prioritizes MD writes with higher priority when multiple happen at the same
// time, for the same TLF.
const (
	// MDPriorityDefault is the priority of zero. It's implicitly used by all
	// old clients, and has lowest priority.
	MDPriorityDefault MDPriority = 0
	// MDPriorityNormal is the priority used for normal KBFS metadata writes.
	MDPriorityNormal = 8
	// MDPriorityGit is the priority used for metadata writes triggered by git
	// remote helpers.
	MDPriorityGit = 32
)

// IsValid returns true is p is a valid MDPriority, or false otherwise.
func (p MDPriority) IsValid() bool {
	return p < 256 && p >= 0
}

func (t TLFVisibility) Eq(r TLFVisibility) bool {
	return int(t) == int(r)
}

func ParseUserVersion(s UserVersionPercentForm) (res UserVersion, err error) {
	parts := strings.Split(string(s), "%")
	if len(parts) == 1 {
		// NOTE: We have to keep it the way it is, even though we
		// never save UIDs without EldestSeqno anywhere. There may be
		// team chain which have UVs encoded with default eldest=1 in
		// the wild.

		// default to seqno 1
		parts = append(parts, "1")
	}
	if len(parts) != 2 {
		return res, fmt.Errorf("invalid user version: %s", s)
	}
	uid, err := UIDFromString(parts[0])
	if err != nil {
		return res, err
	}
	eldestSeqno, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return res, fmt.Errorf("invalid eldest seqno: %s", err)
	}
	return UserVersion{
		Uid:         uid,
		EldestSeqno: Seqno(eldestSeqno),
	}, nil
}

func (p StringKVPair) BoolValue() bool {
	i, err := strconv.ParseBool(p.Value)
	if err != nil {
		return false
	}
	return i
}

func (p StringKVPair) IntValue() int {
	i, err := strconv.Atoi(p.Value)
	if err != nil {
		return 0
	}
	return i
}

func (r *GitRepoResult) GetIfOk() (res GitRepoInfo, err error) {
	state, err := r.State()
	if err != nil {
		return res, err
	}
	switch state {
	case GitRepoResultState_ERR:
		return res, fmt.Errorf(r.Err())
	case GitRepoResultState_OK:
		return r.Ok(), nil
	}
	return res, fmt.Errorf("git repo unknown error")
}

func (r GitRepoInfo) FullName() string {
	switch r.Folder.FolderType {
	case FolderType_PRIVATE:
		return string(r.LocalMetadata.RepoName)
	case FolderType_TEAM:
		return r.Folder.Name + "/" + string(r.LocalMetadata.RepoName)
	default:
		return "<repo type error>"
	}
}

func (req *TeamChangeReq) AddUVWithRole(uv UserVersion, role TeamRole,
	botSettings *TeamBotSettings) error {
	if !role.IsRestrictedBot() && botSettings != nil {
		return fmt.Errorf("Unexpected botSettings for role %v", role)
	}
	switch role {
	case TeamRole_RESTRICTEDBOT:
		if botSettings == nil {
			return fmt.Errorf("Cannot add a RESTRICTEDBOT with nil TeamBotSettings")
		}
		if req.RestrictedBots == nil {
			req.RestrictedBots = make(map[UserVersion]TeamBotSettings)
		}
		req.RestrictedBots[uv] = *botSettings
	case TeamRole_BOT:
		req.Bots = append(req.Bots, uv)
	case TeamRole_READER:
		req.Readers = append(req.Readers, uv)
	case TeamRole_WRITER:
		req.Writers = append(req.Writers, uv)
	case TeamRole_ADMIN:
		req.Admins = append(req.Admins, uv)
	case TeamRole_OWNER:
		req.Owners = append(req.Owners, uv)
	default:
		return fmt.Errorf("Unexpected role: %v", role)
	}
	return nil
}

func (req *TeamChangeReq) RestrictedBotUVs() (ret []UserVersion) {
	for uv := range req.RestrictedBots {
		ret = append(ret, uv)
	}
	return ret
}

// CompleteInviteID adds to the `completed_invites` field, and signals that the
// invite can never be used again. It's used for SBS, Keybase, SeitanV1, and
// SeitanV2 invites.
func (req *TeamChangeReq) CompleteInviteID(inviteID TeamInviteID, uv UserVersionPercentForm) {
	if req.CompletedInvites == nil {
		req.CompletedInvites = make(map[TeamInviteID]UserVersionPercentForm)
	}
	req.CompletedInvites[inviteID] = uv
}

// UseInviteID adds to the `used_invites` field. It is used for SeitanInvitelink invites,
// which can be used multiple times.
func (req *TeamChangeReq) UseInviteID(inviteID TeamInviteID, uv UserVersionPercentForm) {
	req.UsedInvites = append(req.UsedInvites, TeamUsedInvite{InviteID: inviteID, Uv: uv})
}

func (req *TeamChangeReq) GetAllAdds() (ret []UserVersion) {
	ret = append(ret, req.RestrictedBotUVs()...)
	ret = append(ret, req.Bots...)
	ret = append(ret, req.Readers...)
	ret = append(ret, req.Writers...)
	ret = append(ret, req.Admins...)
	ret = append(ret, req.Owners...)
	return ret
}

func TotalNumberOfCommits(refs []GitRefMetadata) (total int) {
	for _, ref := range refs {
		total += len(ref.Commits)
	}
	return total
}

func RefNames(refs []GitRefMetadata) string {
	names := make([]string, len(refs))
	for i, ref := range refs {
		names[i] = ref.RefName
	}
	return strings.Join(names, ", ")
}

func TeamEncryptedKBFSKeysetHashFromString(s string) TeamEncryptedKBFSKeysetHash {
	return TeamEncryptedKBFSKeysetHash(s)
}

func TeamEncryptedKBFSKeysetHashFromBytes(s []byte) TeamEncryptedKBFSKeysetHash {
	return TeamEncryptedKBFSKeysetHashFromString(hex.EncodeToString(s))
}

func (e TeamEncryptedKBFSKeysetHash) String() string {
	return string(e)
}

func (e TeamEncryptedKBFSKeysetHash) Bytes() []byte {
	return []byte(e.String())
}

func (e TeamEncryptedKBFSKeysetHash) SecureEqual(l TeamEncryptedKBFSKeysetHash) bool {
	return hmac.Equal(e.Bytes(), l.Bytes())
}

func (r ResetLink) Summarize() ResetSummary {
	return ResetSummary{
		Ctime:      r.Ctime,
		MerkleRoot: r.MerkleRoot,
		ResetSeqno: r.ResetSeqno,
		Type:       r.Type,
	}
}

func (f AvatarFormat) String() string {
	return string(f)
}

func (u AvatarUrl) String() string {
	return string(u)
}

func MakeAvatarURL(u string) AvatarUrl {
	return AvatarUrl(u)
}

func (b Bytes32) IsBlank() bool {
	var blank Bytes32
	return (subtle.ConstantTimeCompare(b[:], blank[:]) == 1)
}

func (i Identify2ResUPK2) ExportToV1() Identify2Res {
	return Identify2Res{
		Upk:          UPAKFromUPKV2AI(i.Upk).Base,
		IdentifiedAt: i.IdentifiedAt,
		TrackBreaks:  i.TrackBreaks,
	}
}

func (path Path) String() string {
	pathType, err := path.PathType()
	if err != nil {
		return ""
	}
	switch pathType {
	case PathType_KBFS:
		return path.Kbfs().Path
	case PathType_KBFS_ARCHIVED:
		return path.KbfsArchived().Path
	case PathType_LOCAL:
		return path.Local()
	default:
		return ""
	}
}

func (se *SelectorEntry) UnmarshalJSON(b []byte) error {
	if err := json.Unmarshal(b, &se.Index); err == nil {
		se.IsIndex = true
		return nil
	}

	if err := json.Unmarshal(b, &se.Key); err == nil {
		se.IsKey = true
		return nil
	}

	m := make(map[string]bool)
	if err := json.Unmarshal(b, &m); err != nil {
		return fmt.Errorf("invalid selector (not dict)")
	}
	ok1, ok2 := m["all"]
	if ok1 && ok2 {
		se.IsAll = true
		return nil
	}
	ok1, ok2 = m["contents"]
	if ok1 && ok2 {
		se.IsContents = true
		return nil
	}
	return fmt.Errorf("invalid selector (not recognized)")
}

func (p PhoneNumber) String() string {
	return string(p)
}

var nonDigits = regexp.MustCompile("[^\\d]")

func PhoneNumberToAssertionValue(phoneNumber string) string {
	return nonDigits.ReplaceAllString(phoneNumber, "")
}

func (p PhoneNumber) AssertionValue() string {
	return PhoneNumberToAssertionValue(p.String())
}

func (d TeamData) ID() TeamID {
	return d.Chain.Id
}

func (d TeamData) IsPublic() bool {
	return d.Chain.Public
}

func (d FastTeamData) ID() TeamID {
	return d.Chain.ID
}

func (d FastTeamData) IsPublic() bool {
	return d.Chain.Public
}

func (d HiddenTeamChain) ID() TeamID {
	return d.Id
}

func (d HiddenTeamChain) IsPublic() bool {
	return d.Public
}

func (d HiddenTeamChain) Summary() string {
	type pair struct {
		g       PerTeamKeyGeneration
		q       Seqno
		stubbed bool
	}
	var arr []pair
	for g, q := range d.ReaderPerTeamKeys {
		var full bool
		if d.Inner != nil {
			_, full = d.Inner[q]
		}
		arr = append(arr, pair{g: g, q: q, stubbed: !full})
	}
	sort.Slice(arr, func(i, j int) bool { return arr[i].g < arr[j].g })
	return fmt.Sprintf("{Team:%s, Last:%d, ReaderPerTeamKeys: %+v}", d.Id, d.Last, arr)
}

func (f FullName) String() string {
	return string(f)
}

func (h BoxSummaryHash) String() string {
	return string(h)
}

func (r BoxAuditAttemptResult) IsOK() bool {
	switch r {
	case BoxAuditAttemptResult_OK_VERIFIED, BoxAuditAttemptResult_OK_NOT_ATTEMPTED_ROLE, BoxAuditAttemptResult_OK_NOT_ATTEMPTED_OPENTEAM, BoxAuditAttemptResult_OK_NOT_ATTEMPTED_SUBTEAM:
		return true
	default:
		return false
	}
}

func (a BoxAuditAttempt) String() string {
	ret := fmt.Sprintf("%s", a.Result)
	if a.Error != nil {
		ret += fmt.Sprintf("\t(error: %s)", *a.Error)
	}
	if a.Rotated {
		ret += "\t(team rotated)"
	}
	return ret
}

func (c ContactComponent) ValueString() string {
	switch {
	case c.Email != nil:
		return string(*c.Email)
	case c.PhoneNumber != nil:
		return string(*c.PhoneNumber)
	default:
		return ""
	}
}

func (c ContactComponent) AssertionType() string {
	switch {
	case c.Email != nil:
		return "email"
	case c.PhoneNumber != nil:
		return "phone"
	default:
		return ""
	}
}

func (c ContactComponent) FormatDisplayLabel(addLabel bool) string {
	if addLabel && c.Label != "" {
		return fmt.Sprintf("%s (%s)", c.ValueString(), c.Label)
	}
	return c.ValueString()
}

func (fct FolderConflictType) MarshalText() ([]byte, error) {
	switch fct {
	case FolderConflictType_NONE:
		return []byte("none"), nil
	case FolderConflictType_IN_CONFLICT:
		return []byte("in conflict"), nil
	case FolderConflictType_IN_CONFLICT_AND_STUCK:
		return []byte("in conflict and stuck"), nil
	default:
		return []byte(fmt.Sprintf("unknown conflict type: %d", fct)), nil
	}
}

func (fct *FolderConflictType) UnmarshalText(text []byte) error {
	switch string(text) {
	case "none":
		*fct = FolderConflictType_NONE
	case "in conflict":
		*fct = FolderConflictType_IN_CONFLICT
	case "in conflict and stuck":
		*fct = FolderConflictType_IN_CONFLICT_AND_STUCK
	default:
		return errors.New(fmt.Sprintf("Unknown conflict type: %s", text))
	}
	return nil
}

func (h *HiddenTeamChain) Tail() *HiddenTeamChainLink {
	last := h.Last
	if last == Seqno(0) {
		return nil
	}
	ret, ok := h.Inner[last]
	if !ok {
		return nil
	}
	return &ret
}

func (h *HiddenTeamChain) TailTriple() *LinkTriple {
	last := h.Last
	if last == Seqno(0) {
		return nil
	}
	link, ok := h.Outer[last]
	if !ok {
		return nil
	}
	return &LinkTriple{
		Seqno:   last,
		LinkID:  link,
		SeqType: SeqType_TEAM_PRIVATE_HIDDEN,
	}
}

func (s Signer) UserVersion() UserVersion {
	return UserVersion{
		Uid:         s.U,
		EldestSeqno: s.E,
	}
}

func (p PerTeamSeedCheck) Hash() (*PerTeamSeedCheckPostImage, error) {
	if p.Version != PerTeamSeedCheckVersion_V1 {
		return nil, errors.New("can only handle PerTeamKeySeedCheck V1")
	}
	ret := sha256.Sum256(p.Value[:])
	return &PerTeamSeedCheckPostImage{
		Version: PerTeamSeedCheckVersion_V1,
		Value:   PerTeamSeedCheckValuePostImage(ret[:]),
	}, nil
}

func (p PerTeamSeedCheckPostImage) Eq(p2 PerTeamSeedCheckPostImage) bool {
	return (p.Version == p2.Version) && hmac.Equal(p.Value[:], p2.Value[:])
}

func (r HiddenTeamChainRatchetSet) Flat() []LinkTripleAndTime {
	if r.Ratchets == nil {
		return nil
	}
	var ret []LinkTripleAndTime
	for _, v := range r.Ratchets {
		ret = append(ret, v)
	}
	return ret
}

func (r HiddenTeamChainRatchetSet) IsEmpty() bool {
	return r.Ratchets == nil || len(r.Ratchets) == 0
}

func (r HiddenTeamChainRatchetSet) Max() Seqno {
	var ret Seqno
	if r.Ratchets == nil {
		return ret
	}
	for _, v := range r.Ratchets {
		if v.Triple.Seqno > ret {
			ret = v.Triple.Seqno
		}
	}
	return ret
}

func (r HiddenTeamChainRatchetSet) MaxTriple() *LinkTriple {
	if r.Ratchets == nil {
		return nil
	}
	var out LinkTriple
	for _, v := range r.Ratchets {
		if v.Triple.Seqno > out.Seqno {
			out = v.Triple
		}
	}
	return &out
}

func (r *HiddenTeamChain) MaxTriple() *LinkTriple {
	tail := r.TailTriple()
	rat := r.RatchetSet.MaxTriple()
	if rat == nil && tail == nil {
		return nil
	}
	if rat == nil {
		return tail
	}
	if tail == nil {
		return rat
	}
	if tail.Seqno > rat.Seqno {
		return tail
	}
	return rat
}

func (r *HiddenTeamChainRatchetSet) init() {
	if r.Ratchets == nil {
		r.Ratchets = make(map[RatchetType]LinkTripleAndTime)
	}
}

func (r *HiddenTeamChainRatchetSet) Merge(r2 HiddenTeamChainRatchetSet) (updated bool) {
	r.init()
	if r2.Ratchets == nil {
		return false
	}
	for k, v := range r2.Ratchets {
		if r.Add(k, v) {
			updated = true
		}
	}
	return updated
}

func (r *HiddenTeamChainRatchetSet) Add(t RatchetType, v LinkTripleAndTime) (changed bool) {
	r.init()
	found, ok := r.Ratchets[t]
	if (v.Triple.SeqType == SeqType_TEAM_PRIVATE_HIDDEN) && (!ok || v.Triple.Seqno > found.Triple.Seqno) {
		r.Ratchets[t] = v
		changed = true
	}
	return changed
}

func (r LinkTripleAndTime) Clashes(r2 LinkTripleAndTime) bool {
	l1 := r.Triple
	l2 := r2.Triple
	return (l1.Seqno == l2.Seqno && l1.SeqType == l2.SeqType && !l1.LinkID.Eq(l2.LinkID))
}

func (r MerkleRootV2) Eq(s MerkleRootV2) bool {
	return r.Seqno == s.Seqno && r.HashMeta.Eq(s.HashMeta)
}

func (d *HiddenTeamChain) GetLastCommittedSeqno() Seqno {
	if d == nil {
		return 0
	}
	return d.LastCommittedSeqno
}

func (d *HiddenTeamChain) GetOuter() map[Seqno]LinkID {
	if d == nil {
		return nil
	}
	return d.Outer
}

func (d *HiddenTeamChain) PopulateLastFull() {
	if d == nil {
		return
	}
	if d.LastFull != Seqno(0) {
		return
	}
	for i := Seqno(1); i <= d.Last; i++ {
		_, found := d.Inner[i]
		if !found {
			break
		}
		d.LastFull = i
	}
}

func (d *HiddenTeamChain) LastFullPopulateIfUnset() Seqno {
	if d == nil {
		return Seqno(0)
	}
	if d.LastFull == Seqno(0) {
		d.PopulateLastFull()
	}
	return d.LastFull
}

func (d *HiddenTeamChain) Merge(newData HiddenTeamChain) (updated bool, err error) {

	for seqno, link := range newData.Outer {
		existing, ok := d.Outer[seqno]
		if ok && !existing.Eq(link) {
			return false, fmt.Errorf("bad merge since at seqno %d, link clash: %s != %s", seqno, existing, link)
		}
		if ok {
			continue
		}
		d.Outer[seqno] = link
		updated = true
		if seqno > d.Last {
			d.Last = seqno
		}
	}

	for q, i := range newData.Inner {
		_, found := d.Inner[q]
		if found {
			continue
		}
		d.Inner[q] = i
		if ptk, ok := i.Ptk[PTKType_READER]; ok {
			d.ReaderPerTeamKeys[ptk.Ptk.Gen] = q
		}

		// If we previously loaded full links up to d.LastFull, but this is d.LastFull+1,
		// then we can safely bump the pointer one foward.
		if q == d.LastFull+Seqno(1) {
			d.LastFull = q
		}
		updated = true
	}
	if newData.Last > d.Last {
		d.Last = newData.Last
	}

	if newData.LastCommittedSeqno > d.LastCommittedSeqno {
		d.LastCommittedSeqno = newData.LastCommittedSeqno
		updated = true
	}

	for k, v := range newData.LastPerTeamKeys {
		existing, ok := d.LastPerTeamKeys[k]
		if !ok || existing < v {
			d.LastPerTeamKeys[k] = v
		}
	}

	for k, v := range newData.MerkleRoots {
		existing, ok := d.MerkleRoots[k]
		if ok && !existing.Eq(v) {
			return false, fmt.Errorf("bad merge since at seqno %d, merkle root clash: %+v != %+v", k, existing, v)
		}
		if ok {
			continue
		}
		d.MerkleRoots[k] = v
		updated = true
	}

	if d.RatchetSet.Merge(newData.RatchetSet) {
		updated = true
	}

	for k := range d.LinkReceiptTimes {
		if k <= newData.LastCommittedSeqno {
			// This link has been committed to the blind tree, no need to keep
			// track of it any more
			delete(d.LinkReceiptTimes, k)
			updated = true
		}
	}

	for k, v := range newData.LinkReceiptTimes {
		if _, found := d.LinkReceiptTimes[k]; !found {
			if d.LinkReceiptTimes == nil {
				d.LinkReceiptTimes = make(map[Seqno]Time)
			}
			d.LinkReceiptTimes[k] = v
			updated = true
		}
	}

	return updated, nil
}

func (h HiddenTeamChain) HasSeqno(s Seqno) bool {
	_, found := h.Outer[s]
	return found
}

func NewHiddenTeamChain(id TeamID) *HiddenTeamChain {
	return &HiddenTeamChain{
		Id:                id,
		Subversion:        1, // We are now on Version 1.1
		LastPerTeamKeys:   make(map[PTKType]Seqno),
		ReaderPerTeamKeys: make(map[PerTeamKeyGeneration]Seqno),
		Outer:             make(map[Seqno]LinkID),
		Inner:             make(map[Seqno]HiddenTeamChainLink),
		MerkleRoots:       make(map[Seqno]MerkleRootV2),
	}
}

func (h *HiddenTeamChain) Tombstone() (changed bool) {
	if h.Tombstoned {
		return false
	}
	h.LastPerTeamKeys = make(map[PTKType]Seqno)
	h.ReaderPerTeamKeys = make(map[PerTeamKeyGeneration]Seqno)
	h.Outer = make(map[Seqno]LinkID)
	h.Inner = make(map[Seqno]HiddenTeamChainLink)
	h.Tombstoned = true
	return true
}

func (h *HiddenTeamChain) Freeze() (changed bool) {
	if h.Frozen {
		return false
	}
	h.LastPerTeamKeys = make(map[PTKType]Seqno)
	h.ReaderPerTeamKeys = make(map[PerTeamKeyGeneration]Seqno)
	h.Inner = make(map[Seqno]HiddenTeamChainLink)
	newOuter := make(map[Seqno]LinkID)
	if h.Last != Seqno(0) {
		newOuter[h.Last] = h.Outer[h.Last]
	}
	h.Outer = newOuter
	h.Frozen = true
	return true
}

func (h HiddenTeamChain) LastReaderPerTeamKeyLinkID() (ret LinkID) {
	seqno, ok := h.LastPerTeamKeys[PTKType_READER]
	if !ok {
		return ret
	}
	tmp, ok := h.Outer[seqno]
	if !ok {
		return ret
	}
	return tmp
}

func (h *HiddenTeamChain) GetReaderPerTeamKeyAtGeneration(g PerTeamKeyGeneration) (ret PerTeamKey, found bool) {
	if h == nil {
		return ret, false
	}
	q, ok := h.ReaderPerTeamKeys[g]
	if !ok {
		return ret, false
	}
	inner, ok := h.Inner[q]
	if !ok {
		return ret, false
	}
	key, ok := inner.Ptk[PTKType_READER]
	if !ok {
		return ret, false
	}
	return key.Ptk, true
}

func (h *HiddenTeamChain) MaxReaderPerTeamKey() *PerTeamKey {
	if h == nil {
		return nil
	}
	seqno, ok := h.LastPerTeamKeys[PTKType_READER]
	if !ok {
		return nil
	}
	inner, ok := h.Inner[seqno]
	if !ok {
		return nil
	}
	ptk, ok := inner.Ptk[PTKType_READER]
	if !ok {
		return nil
	}
	return &ptk.Ptk
}

func (h *HiddenTeamChain) MaxReaderPerTeamKeyGeneration() PerTeamKeyGeneration {
	k := h.MaxReaderPerTeamKey()
	if k == nil {
		return PerTeamKeyGeneration(0)
	}
	return k.Gen
}

func (h *HiddenTeamChain) KeySummary() string {
	if h == nil {
		return "Ø"
	}
	return fmt.Sprintf("{last:%d, lastPerTeamKeys:%+v, readerPerTeamKeys: %+v}", h.Last, h.LastPerTeamKeys, h.ReaderPerTeamKeys)
}

func (h *HiddenTeamChain) LinkAndKeySummary() string {
	if h == nil {
		return "empty"
	}
	ks := h.KeySummary()
	return fmt.Sprintf("{nOuterlinks: %d, nInnerLinks:%d, keys:%s}", len(h.Outer), len(h.Inner), ks)
}

func (h *TeamData) KeySummary() string {
	if h == nil {
		return "Ø"
	}
	var p []PerTeamKeyGeneration
	for k := range h.PerTeamKeySeedsUnverified {
		p = append(p, k)
	}
	m := make(map[PerTeamKeyGeneration]bool)
	for _, v := range h.ReaderKeyMasks {
		for k := range v {
			m[k] = true
		}
	}
	var r []PerTeamKeyGeneration
	for k := range m {
		r = append(r, k)
	}
	return fmt.Sprintf("{ptksu:%v, rkms:%v, sigchain:%s}", p, r, h.Chain.KeySummary())
}

func (s TeamSigChainState) UserRole(user UserVersion) TeamRole {
	points := s.UserLog[user]
	if len(points) == 0 {
		return TeamRole_NONE
	}
	role := points[len(points)-1].Role
	return role
}

func (s TeamSigChainState) GetUserLastJoinTime(user UserVersion) (time Time, err error) {
	if s.UserRole(user) == TeamRole_NONE {
		return 0, fmt.Errorf("In GetUserLastJoinTime: User %s is not a member of team %v", user.Uid, s.Id)
	}
	// Look for the latest join event, i.e. the latest transition from a role NONE to a different valid one.
	points := s.UserLog[user]
	for i := len(points) - 1; i > -1; i-- {
		if points[i].Role == TeamRole_NONE {
			// this is the last time in the sigchain this user has role none
			// (note that it cannot be the last link in the chain, otherwise the
			// user would have role NONE), so the link after this one is the one
			// where they joined the team last.
			return points[i+1].SigMeta.Time, nil
		}
	}
	// If the user never had role none, they joined at the time of their first
	// UserLog entry (they need to have at least one, else again their role would be
	// NONE).
	return points[0].SigMeta.Time, nil
}

// GetUserLastRoleChangeTime returns the time of the last role change for user
// in team. If the user left the team as a last change, the time of such leave
// event is returned. If the user was never in the team, then this function
// returns time=0 and wasMember=false.
func (s TeamSigChainState) GetUserLastRoleChangeTime(user UserVersion) (time Time, wasMember bool) {
	points := s.UserLog[user]
	if len(points) == 0 {
		return 0, false
	}
	return points[len(points)-1].SigMeta.Time, true
}

func (s TeamSigChainState) KeySummary() string {
	var v []PerTeamKeyGeneration
	for k := range s.PerTeamKeys {
		v = append(v, k)
	}
	return fmt.Sprintf("{maxPTK:%d, ptk:%v}", s.MaxPerTeamKeyGeneration, v)
}

func (s TeamSigChainState) HasAnyStubbedLinks() bool {
	for _, v := range s.StubbedLinks {
		if v {
			return true
		}
	}
	return false
}

func (s TeamSigChainState) ListSubteams() (res []TeamIDAndName) {
	type Entry struct {
		ID   TeamID
		Name TeamName
		// Seqno of the last cached rename of this team
		Seqno Seqno
	}
	// Use a map to deduplicate names. If there is a subteam name
	// collision, take the one with the latest (parent) seqno
	// modifying its name.
	// A collision could occur if you were removed from a team
	// and miss its renaming or deletion to stubbing.
	resMap := make(map[string] /*TeamName*/ Entry)
	for subteamID, points := range s.SubteamLog {
		if len(points) == 0 {
			// this should never happen
			continue
		}
		lastPoint := points[len(points)-1]
		if lastPoint.Name.IsNil() {
			// the subteam has been deleted
			continue
		}
		entry := Entry{
			ID:    subteamID,
			Name:  lastPoint.Name,
			Seqno: lastPoint.Seqno,
		}
		existing, ok := resMap[entry.Name.String()]
		replace := !ok || (entry.Seqno >= existing.Seqno)
		if replace {
			resMap[entry.Name.String()] = entry
		}
	}
	for _, entry := range resMap {
		res = append(res, TeamIDAndName{
			Id:   entry.ID,
			Name: entry.Name,
		})
	}
	return res
}

func (s TeamSigChainState) GetAllUVs() (res []UserVersion) {
	for uv := range s.UserLog {
		if s.UserRole(uv) != TeamRole_NONE {
			res = append(res, uv)
		}
	}
	return res
}

func (s TeamSigChainState) ActiveInvites() (ret []TeamInvite) {
	for _, md := range s.InviteMetadatas {
		if code, err := md.Status.Code(); err == nil &&
			code == TeamInviteMetadataStatusCode_ACTIVE {
			ret = append(ret, md.Invite)
		}
	}
	return ret
}

func (h *HiddenTeamChain) IsStale() bool {
	if h == nil {
		return false
	}
	max := h.RatchetSet.Max()
	if max < h.LatestSeqnoHint {
		max = h.LatestSeqnoHint
	}
	if max == Seqno(0) {
		return false
	}
	_, fresh := h.Outer[max]
	return !fresh
}

func (k TeamEphemeralKey) Ctime() Time {
	typ, err := k.KeyType()
	if err != nil {
		return 0
	}
	switch typ {
	case TeamEphemeralKeyType_TEAM:
		return k.Team().Metadata.Ctime
	case TeamEphemeralKeyType_TEAMBOT:
		return k.Teambot().Metadata.Ctime
	default:
		return 0
	}
}

func (k TeamEphemeralKeyBoxed) Ctime() Time {
	typ, err := k.KeyType()
	if err != nil {
		return 0
	}
	switch typ {
	case TeamEphemeralKeyType_TEAM:
		return k.Team().Metadata.Ctime
	case TeamEphemeralKeyType_TEAMBOT:
		return k.Teambot().Metadata.Ctime
	default:
		return 0
	}
}

func (k TeamEphemeralKey) Generation() EkGeneration {
	typ, err := k.KeyType()
	if err != nil {
		return 0
	}
	switch typ {
	case TeamEphemeralKeyType_TEAM:
		return k.Team().Metadata.Generation
	case TeamEphemeralKeyType_TEAMBOT:
		return k.Teambot().Metadata.Generation
	default:
		return 0
	}
}

func (k TeamEphemeralKey) Material() Bytes32 {
	typ, err := k.KeyType()
	if err != nil {
		return [32]byte{}
	}
	switch typ {
	case TeamEphemeralKeyType_TEAM:
		return k.Team().Seed
	case TeamEphemeralKeyType_TEAMBOT:
		return k.Teambot().Seed
	default:
		return [32]byte{}
	}
}

func (k TeamEphemeralKeyBoxed) Generation() EkGeneration {
	typ, err := k.KeyType()
	if err != nil {
		return 0
	}
	switch typ {
	case TeamEphemeralKeyType_TEAM:
		return k.Team().Metadata.Generation
	case TeamEphemeralKeyType_TEAMBOT:
		return k.Teambot().Metadata.Generation
	default:
		return 0
	}
}

func (k TeamEphemeralKeyType) IsTeambot() bool {
	return k == TeamEphemeralKeyType_TEAMBOT
}

func (k TeamEphemeralKeyType) IsTeam() bool {
	return k == TeamEphemeralKeyType_TEAM
}

// IsLimited returns if the network is considered limited based on the type.
func (s MobileNetworkState) IsLimited() bool {
	switch s {
	case MobileNetworkState_WIFI, MobileNetworkState_NOTAVAILABLE:
		return false
	default:
		return true
	}
}

func (k TeambotKey) Generation() int {
	return int(k.Metadata.Generation)
}

func (k TeambotKey) Material() Bytes32 {
	return k.Seed
}

func (r APIUserSearchResult) GetStringIDForCompare() string {
	switch {
	case r.Contact != nil:
		return fmt.Sprintf("%s%s", r.Contact.DisplayName, r.Contact.DisplayLabel)
	case r.Imptofu != nil:
		return fmt.Sprintf("%s%s", r.Imptofu.PrettyName, r.Imptofu.Label)
	case r.Keybase != nil:
		return r.Keybase.Username
	default:
		return ""
	}
}

func NewPathWithKbfsPath(path string) Path {
	return NewPathWithKbfs(KBFSPath{Path: path})
}

func (p PerTeamKey) Equal(q PerTeamKey) bool {
	return p.EncKID.Equal(q.EncKID) && p.SigKID.Equal(q.SigKID)
}

func (b BotToken) IsNil() bool {
	return len(b) == 0
}

func (b BotToken) Exists() bool {
	return !b.IsNil()
}

func (b BotToken) String() string {
	return string(b)
}

var botTokenRxx = regexp.MustCompile(`^[a-zA-Z0-9_-]{32}$`)

func NewBotToken(s string) (BotToken, error) {
	if !botTokenRxx.MatchString(s) {
		return BotToken(""), errors.New("bad bot token")
	}
	return BotToken(s), nil
}

func (b BadgeConversationInfo) IsEmpty() bool {
	return b.UnreadMessages == 0 && b.BadgeCount == 0
}

func (s *TeamBotSettings) Eq(o *TeamBotSettings) bool {
	return reflect.DeepEqual(s, o)
}

func (s *TeamBotSettings) ConvIDAllowed(strCID string) bool {
	if s == nil {
		return true
	}
	for _, strConvID := range s.Convs {
		if strCID == strConvID {
			return true
		}
	}
	return len(s.Convs) == 0
}

func (b UserBlockedBody) Summarize() UserBlockedSummary {
	ret := UserBlockedSummary{
		Blocker: b.Username,
		Blocks:  make(map[string][]UserBlockState),
	}
	for _, block := range b.Blocks {
		if block.Chat != nil {
			ret.Blocks[block.Username] = append(ret.Blocks[block.Username], UserBlockState{UserBlockType_CHAT, *block.Chat})
		}
		if block.Follow != nil {
			ret.Blocks[block.Username] = append(ret.Blocks[block.Username], UserBlockState{UserBlockType_FOLLOW, *block.Follow})
		}
	}
	return ret
}

func FilterMembersDetails(membMap map[string]struct{}, details []TeamMemberDetails) (res []TeamMemberDetails) {
	res = []TeamMemberDetails{}
	for _, member := range details {
		if _, ok := membMap[member.Username]; ok {
			res = append(res, member)
		}
	}
	return res
}

func FilterTeamDetailsForMembers(usernames []string, details TeamDetails) TeamDetails {
	membMap := make(map[string]struct{})
	for _, username := range usernames {
		membMap[username] = struct{}{}
	}
	res := details.DeepCopy()
	res.Members.Owners = FilterMembersDetails(membMap, res.Members.Owners)
	res.Members.Admins = FilterMembersDetails(membMap, res.Members.Admins)
	res.Members.Writers = FilterMembersDetails(membMap, res.Members.Writers)
	res.Members.Readers = FilterMembersDetails(membMap, res.Members.Readers)
	res.Members.Bots = FilterMembersDetails(membMap, res.Members.Bots)
	res.Members.RestrictedBots = FilterMembersDetails(membMap, res.Members.RestrictedBots)
	return res
}

func (b FeaturedBot) DisplayName() string {
	if b.BotAlias == "" {
		return b.BotUsername
	}
	return fmt.Sprintf("%s (%s)", b.BotAlias, b.BotUsername)
}

func (b FeaturedBot) Owner() string {
	if b.OwnerTeam != nil {
		return *b.OwnerTeam
	}
	if b.OwnerUser != nil {
		return *b.OwnerUser
	}
	return ""
}

func (b FeaturedBot) Eq(o FeaturedBot) bool {
	return b.BotAlias == o.BotAlias &&
		b.Description == o.Description &&
		b.ExtendedDescription == o.ExtendedDescription &&
		b.BotUsername == o.BotUsername &&
		b.Owner() == o.Owner()
}

func (a SearchArg) String() string {
	// Don't leak user's query string
	return fmt.Sprintf("Limit: %d, Offset: %d", a.Limit, a.Offset)
}
func (a SearchLocalArg) String() string {
	// Don't leak user's query string
	return fmt.Sprintf("Limit: %d, SkipCache: %v", a.Limit, a.SkipCache)
}

func (b FeaturedBotsRes) Eq(o FeaturedBotsRes) bool {
	if len(b.Bots) != len(o.Bots) {
		return false
	}
	for i, bot := range b.Bots {
		if !bot.Eq(o.Bots[i]) {
			return false
		}
	}
	return true
}

// Redact modifies the given ClientDetails struct
func (d *ClientDetails) Redact() {
	tmp := fmt.Sprintf("%v", d.Argv)
	re := regexp.MustCompile(`\b(chat|fs|encrypt|git|accept-invite|wallet\s+send|wallet\s+import|passphrase\s+check)\b`)
	if mtch := re.FindString(tmp); len(mtch) > 0 {
		d.Argv = []string{d.Argv[0], mtch, redactedReplacer}
	}

	for i, arg := range d.Argv {
		if strings.Contains(arg, "paperkey") && i+1 < len(d.Argv) && !strings.HasPrefix(d.Argv[i+1], "-") {
			d.Argv[i+1] = redactedReplacer
		}
	}
}

func (s UserSummarySet) Usernames() (ret []string) {
	for _, x := range s.Users {
		ret = append(ret, x.Username)
	}
	return ret
}

func (x InstrumentationStat) AppendStat(y InstrumentationStat) InstrumentationStat {
	x.Mtime = ToTime(time.Now())
	x.NumCalls += y.NumCalls
	x.TotalDur += y.TotalDur
	if y.MaxDur > x.MaxDur {
		x.MaxDur = y.MaxDur
	}
	if y.MinDur < x.MinDur {
		x.MinDur = y.MinDur
	}

	x.TotalSize += y.TotalSize
	if y.MaxSize > x.MaxSize {
		x.MaxSize = y.MaxSize
	}
	if y.MinSize < x.MinSize {
		x.MinSize = y.MinSize
	}

	x.AvgDur = x.TotalDur / DurationMsec(x.NumCalls)
	x.AvgSize = x.TotalSize / int64(x.NumCalls)
	return x
}

func (e TeamSearchExport) Hash() string {
	l := make([]TeamSearchItem, 0, len(e.Items))
	for _, item := range e.Items {
		l = append(l, item)
	}
	sort.Slice(l, func(i, j int) bool {
		return l[i].Id.Less(l[j].Id)
	})
	hasher := sha256.New()
	for _, team := range l {
		log := math.Floor(math.Log10(float64(team.MemberCount)))
		rounder := int(math.Pow(10, log))
		value := (team.MemberCount / rounder) * rounder
		hasher.Write(team.Id.ToBytes())
		hasher.Write([]byte(fmt.Sprintf("%d", value)))
	}
	for _, id := range e.Suggested {
		hasher.Write(id.ToBytes())
	}
	return hex.EncodeToString(hasher.Sum(nil))
}

// web-of-trust
// In order of descending quality.
// Keep in sync with:
// - server helpers/wot.ts
// - gui WebOfTrustVerificationType
const (
	UsernameVerificationType_IN_PERSON  = "in_person"
	UsernameVerificationType_VIDEO      = "video"
	UsernameVerificationType_AUDIO      = "audio"
	UsernameVerificationType_PROOFS     = "proofs"
	UsernameVerificationType_OTHER_CHAT = "other_chat"
	UsernameVerificationType_FAMILIAR   = "familiar"
	UsernameVerificationType_OTHER      = "other"
)

var UsernameVerificationTypeMap = map[string]UsernameVerificationType{
	"in_person":  UsernameVerificationType_IN_PERSON,
	"proofs":     UsernameVerificationType_PROOFS,
	"video":      UsernameVerificationType_VIDEO,
	"audio":      UsernameVerificationType_AUDIO,
	"other_chat": UsernameVerificationType_OTHER_CHAT,
	"familiar":   UsernameVerificationType_FAMILIAR,
	"other":      UsernameVerificationType_OTHER,
}

func (fsc FolderSyncConfig) Equal(other FolderSyncConfig) bool {
	if fsc.Mode != other.Mode {
		return false
	}
	if len(fsc.Paths) != len(other.Paths) {
		return false
	}
	for i, p := range fsc.Paths {
		if p != other.Paths[i] {
			return false
		}
	}
	return true
}

func (t SeitanIKeyInvitelink) String() string {
	return string(t)
}

// UserRolePairsHaveOwner check if a list of UserRolePair has user with role
// OWNER.
func UserRolePairsHaveOwner(users []UserRolePair) bool {
	for _, urp := range users {
		if urp.Role == TeamRole_OWNER {
			return true
		}
	}
	return false
}

func (e EmailAddress) String() string {
	return string(e)
}

func NewTeamSigMeta(sigMeta SignatureMetadata, uv UserVersion) TeamSignatureMetadata {
	return TeamSignatureMetadata{SigMeta: sigMeta, Uv: uv}
}

func NewTeamInviteMetadata(invite TeamInvite, teamSigMeta TeamSignatureMetadata) TeamInviteMetadata {
	return TeamInviteMetadata{
		Invite:      invite,
		TeamSigMeta: teamSigMeta,
		Status:      NewTeamInviteMetadataStatusWithActive(),
	}
}

func (a AnnotatedTeam) ToLegacyTeamDetails() TeamDetails {
	var members TeamMembersDetails
	for _, member := range a.Members {
		switch member.Role {
		case TeamRole_RESTRICTEDBOT:
			members.RestrictedBots = append(members.RestrictedBots, member)
		case TeamRole_BOT:
			members.Bots = append(members.Bots, member)
		case TeamRole_READER:
			members.Readers = append(members.Readers, member)
		case TeamRole_WRITER:
			members.Writers = append(members.Writers, member)
		case TeamRole_ADMIN:
			members.Admins = append(members.Admins, member)
		case TeamRole_OWNER:
			members.Owners = append(members.Owners, member)
		}
	}

	annotatedActiveInvites := make(map[TeamInviteID]AnnotatedTeamInvite)
	for _, annotatedInvite := range a.Invites {
		code, _ := annotatedInvite.InviteMetadata.Status.Code()
		if code != TeamInviteMetadataStatusCode_ACTIVE {
			continue
		}
		annotatedActiveInvites[annotatedInvite.InviteMetadata.Invite.Id] = annotatedInvite
	}

	return TeamDetails{
		Name:                   a.Name,
		Members:                members,
		KeyGeneration:          a.KeyGeneration,
		AnnotatedActiveInvites: annotatedActiveInvites,
		Settings:               a.Settings,
		Showcase:               a.Showcase,
	}
}
