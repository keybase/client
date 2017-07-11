// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase1

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	jsonw "github.com/keybase/go-jsonw"
)

const (
	UID_LEN               = 16
	UID_SUFFIX            = 0x00
	UID_SUFFIX_2          = 0x19
	UID_SUFFIX_HEX        = "00"
	UID_SUFFIX_2_HEX      = "19"
	TEAMID_LEN            = 16
	TEAMID_SUFFIX         = 0x24
	TEAMID_SUFFIX_HEX     = "24"
	SUB_TEAMID_SUFFIX     = 0x25
	SUB_TEAMID_SUFFIX_HEX = "25"
	PUBLIC_UID            = "ffffffffffffffffffffffffffffff00"
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

func (s Seqno) Eq(s2 Seqno) bool {
	return s == s2
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
	if suffix != TEAMID_SUFFIX_HEX && suffix != SUB_TEAMID_SUFFIX_HEX {
		return "", fmt.Errorf("Bad TeamID '%s': must end in 0x%x or 0x%x", s, TEAMID_SUFFIX, SUB_TEAMID_SUFFIX)
	}
	return TeamID(s), nil
}

// Used by unit tests.
func MakeTestTeamID(n uint32) TeamID {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint32(b, n)
	s := hex.EncodeToString(b)
	c := 2*TEAMID_LEN - len(TEAMID_SUFFIX_HEX) - len(s)
	s += strings.Repeat("0", c) + TEAMID_SUFFIX_HEX
	tid, err := TeamIDFromString(s)
	if err != nil {
		panic(err)
	}
	return tid
}

// Can panic if invalid
func (t TeamID) IsSubTeam() bool {
	suffix := t[len(t)-2:]
	return suffix == SUB_TEAMID_SUFFIX_HEX
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

func (s SigID) IsNil() bool {
	return len(s) == 0
}

func (s SigID) Exists() bool {
	return !s.IsNil()
}

func (s SigID) Equal(t SigID) bool {
	return s == t
}

func (s SigID) Match(q string, exact bool) bool {
	if s.IsNil() {
		return false
	}

	if exact {
		return strings.ToLower(s.ToString(true)) == strings.ToLower(q)
	}

	if strings.HasPrefix(s.ToString(true), strings.ToLower(q)) {
		return true
	}

	return false
}

func (s SigID) NotEqual(t SigID) bool {
	return !s.Equal(t)
}

func (s SigID) ToDisplayString(verbose bool) string {
	if verbose {
		return string(s)
	}
	return fmt.Sprintf("%s...", s[0:SigIDQueryMin])
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
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(0, int64(t)*1000000)
}

func (t Time) Time() time.Time {
	return FromTime(t)
}

func (t Time) UnixSeconds() int64 {
	return t.Time().Unix()
}

func (t Time) UnixMilliseconds() int64 {
	return t.Time().UnixNano() / 1e6
}

func (t Time) UnixMicroseconds() int64 {
	return t.Time().UnixNano() / 1e3
}

func ToTime(t time.Time) Time {
	// the result of calling UnixNano on the zero Time is undefined.
	// https://golang.org/pkg/time/#Time.UnixNano
	if t.IsZero() {
		return 0
	}
	return Time(t.UnixNano() / 1000000)
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

func (k *KID) MarshalJSON() ([]byte, error) {
	return Quote(k.String()), nil
}

func (s *SigID) UnmarshalJSON(b []byte) error {
	sigID, err := SigIDFromString(Unquote(b), true)
	if err != nil {
		return err
	}
	*s = sigID
	return nil
}

func (s *SigID) MarshalJSON() ([]byte, error) {
	return Quote(s.ToString(true)), nil
}

func (f Folder) ToString() string {
	prefix := "public/"
	if f.Private {
		prefix = "private/"
	}
	return prefix + f.Name
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
	return fmt.Sprintf("%s@%s", sa.User, sa.Service)
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
// into an Error that Go can understand, and you can descriminate on in your code.
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

func (t TLFID) ToBytes() []byte {
	b, err := hex.DecodeString(string(t))
	if err != nil {
		return nil
	}
	return b
}

func (b TLFIdentifyBehavior) AlwaysRunIdentify() bool {
	return b == TLFIdentifyBehavior_CHAT_GUI || b == TLFIdentifyBehavior_CHAT_CLI ||
		b == TLFIdentifyBehavior_CHAT_GUI_STRICT
}

func (b TLFIdentifyBehavior) CanUseUntrackedFastPath() bool {
	switch b {
	case TLFIdentifyBehavior_CHAT_GUI, TLFIdentifyBehavior_CHAT_GUI_STRICT:
		return true
	default:
		// TLFIdentifyBehavior_DEFAULT_KBFS, for filesystem activity that
		// doesn't have any other UI to report errors with.
		return false
	}
}

func (b TLFIdentifyBehavior) WarningInsteadOfErrorOnBrokenTracks() bool {
	// The chat GUI (in non-strict mode) is specifically exempted from broken
	// track errors, because people need to be able to use it to ask each other
	// about the fact that proofs are broken.
	return b == TLFIdentifyBehavior_CHAT_GUI
}

// All of the chat modes want to prevent tracker popups.
func (b TLFIdentifyBehavior) ShouldSuppressTrackerPopups() bool {
	switch b {
	case TLFIdentifyBehavior_CHAT_GUI,
		TLFIdentifyBehavior_CHAT_GUI_STRICT,
		TLFIdentifyBehavior_CHAT_CLI,
		TLFIdentifyBehavior_KBFS_REKEY,
		TLFIdentifyBehavior_KBFS_QR:
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

func (u UserPlusAllKeys) GetRemoteTrack(s string) *RemoteTrack {
	i := sort.Search(len(u.RemoteTracks), func(j int) bool {
		return u.RemoteTracks[j].Username >= s
	})
	if i >= len(u.RemoteTracks) {
		return nil
	}
	if u.RemoteTracks[i].Username != s {
		return nil
	}
	return &u.RemoteTracks[i]
}

func (u UserPlusAllKeys) GetUID() UID {
	return u.Base.GetUID()
}

func (u UserPlusAllKeys) GetName() string {
	return u.Base.GetName()
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

func (u UserPlusKeysV2AllIncarnations) FindDevice(d DeviceID) *PublicKeyV2NaCl {
	for _, k := range u.Current.DeviceKeys {
		if k.DeviceID.Eq(d) {
			return &k
		}
	}
	return nil
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

func (u UserPlusKeysV2) FindDeviceKey(needle KID) *PublicKeyV2NaCl {
	for _, k := range u.DeviceKeys {
		if k.Base.Kid.Equal(needle) {
			return &k
		}
	}
	return nil
}

func (s ChatConversationID) String() string {
	return hex.EncodeToString(s)
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
	return false
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

func (ut UserOrTeamID) AsTeam() (TeamID, error) {
	if !ut.IsTeamOrSubteam() {
		return TeamID(""), errors.New("ID is not a team ID")
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
	suffix := ut[len(ut)-2:]
	return suffix == UID_SUFFIX_HEX || suffix == UID_SUFFIX_2_HEX
}

func (ut UserOrTeamID) IsTeam() bool {
	suffix := ut[len(ut)-2:]
	return suffix == TEAMID_SUFFIX_HEX
}

func (ut UserOrTeamID) IsSubteam() bool {
	suffix := ut[len(ut)-2:]
	return suffix == SUB_TEAMID_SUFFIX_HEX
}

func (ut UserOrTeamID) IsTeamOrSubteam() bool {
	suffixLen := 2
	if ut.IsNil() || len(ut) < suffixLen {
		return false
	}
	suffix := ut[len(ut)-suffixLen:]
	return suffix == TEAMID_SUFFIX_HEX || suffix == SUB_TEAMID_SUFFIX_HEX
}

// Returns a number in [0, shardCount) which can be treated as roughly
// uniformly distributed. Used for things that need to shard by user.
func (ut UserOrTeamID) GetShard(shardCount int) (int, error) {
	bytes, err := hex.DecodeString(string(ut))
	if err != nil {
		return 0, err
	}
	// TODO -- fix this and all other UserOrTeam#foo's that don't check
	// the size of the input.
	if len(bytes) < 4 {
		return 0, fmt.Errorf("bad ID, isn't 4 bytes at least")
	}
	n := binary.LittleEndian.Uint32(bytes)
	return int(n % uint32(shardCount)), nil
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
			DeviceKeys:        deviceKeysV1,
			RevokedDeviceKeys: revokedDeviceKeysV1,
			DeletedDeviceKeys: deletedDeviceKeysV1,
			PGPKeyCount:       len(pgpKeysV1),
			Uvv:               uV2.Uvv,
			PerUserKeys:       uV2.Current.PerUserKeys,
		},
		PGPKeys:      pgpKeysV1,
		RemoteTracks: remoteTracks,
	}
}

// "foo" for seqno 1 or "foo%6"
func (u UserVersion) PercentForm() string {
	if u.EldestSeqno == 1 {
		return string(u.Uid)
	}
	return u.String()
}

func (u UserVersion) String() string {
	return fmt.Sprintf("%s%%%d", u.Uid, u.EldestSeqno)
}

func (u UserVersion) Eq(v UserVersion) bool {
	return u.Uid.Equal(v.Uid) && u.EldestSeqno.Eq(v.EldestSeqno)
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
	var all []UserVersion
	for _, uv := range m {
		all = append(all, uv)
	}
	return all
}

func (t TeamName) IsNil() bool {
	return len(t.Parts) == 0
}

// underscores allowed, just not first or doubled
var namePartRxx = regexp.MustCompile(`([a-zA-Z0-9][a-zA-Z0-9_]?)+`)

func TeamNameFromString(s string) (ret TeamName, err error) {
	parts := strings.Split(s, ".")
	if len(parts) == 0 {
		return ret, errors.New("need >= 1 part, got 0")
	}
	tmp := make([]TeamNamePart, len(parts))
	for i, part := range parts {
		if !(len(part) >= 2 && len(part) <= 16) {
			return ret, fmt.Errorf("team name wrong size:'%s' %v <= %v <= %v", part, 2, len(part), 16)
		}
		if !namePartRxx.MatchString(part) {
			return ret, fmt.Errorf("Bad name component: %s (at pos %d)", part, i)
		}
		tmp[i] = TeamNamePart(strings.ToLower(part))
	}
	return TeamName{Parts: tmp}, nil
}

func (t TeamName) String() string {
	tmp := make([]string, len(t.Parts))
	for i, p := range t.Parts {
		tmp[i] = string(p)
	}
	return strings.Join(tmp, ".")
}

func (t TeamName) Eq(t2 TeamName) bool {
	return t.String() == t2.String()
}

func (t TeamName) IsRootTeam() bool {
	return len(t.Parts) == 1
}

// Get the top level team id for this team name.
// Only makes sense for non-sub teams.
func (t TeamName) ToTeamID() TeamID {
	low := strings.ToLower(t.String())
	sum := sha256.Sum256([]byte(low))
	bs := append(sum[:15], TEAMID_SUFFIX)
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

func (r TeamRole) IsAdminOrAbove() bool {
	return r == TeamRole_ADMIN || r == TeamRole_OWNER
}

func (r TeamRole) IsReaderOrAbove() bool {
	return r == TeamRole_ADMIN || r == TeamRole_OWNER || r == TeamRole_READER || r == TeamRole_WRITER
}

type idDesc struct {
	byteLen int
	suffix  byte
	typ     string
}

func (i idDesc) check(s string) error {
	b, err := hex.DecodeString(s)
	if err != nil {
		return err
	}
	if len(b) != i.byteLen {
		return fmt.Errorf("%s: wrong ID len (got %d)", i.typ, len(b))
	}
	sffx := b[len(b)-1]
	if sffx != i.suffix {
		return fmt.Errorf("%s: wrong suffix byte (got 0x%x)", i.typ, sffx)
	}
	return nil
}

func TeamInviteIDFromString(s string) (TeamInviteID, error) {
	if err := (idDesc{16, 0x27, "team invite ID"}).check(s); err != nil {
		return TeamInviteID(""), err
	}
	return TeamInviteID(s), nil
}

func TeamInviteTypeFromString(s string, isDev bool) (TeamInviteType, error) {
	switch s {
	case "keybase":
		return NewTeamInviteTypeDefault(TeamInviteCategory_KEYBASE), nil
	case "email":
		return NewTeamInviteTypeDefault(TeamInviteCategory_EMAIL), nil
	case "twitter", "github", "facebook", "reddit", "hackernews", "pgp", "http", "https", "dns":
		return NewTeamInviteTypeWithSbs(TeamInviteSocialNetwork(s)), nil
	default:
		if isDev && s == "rooter" {
			return NewTeamInviteTypeWithSbs(TeamInviteSocialNetwork(s)), nil
		}
		// Don't want to break existing clients if we see an unknown invite
		// type.
		return NewTeamInviteTypeWithUnknown(s), nil
	}
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
	case TeamInviteCategory_SBS:
		return string(t.Sbs()), nil
	case TeamInviteCategory_UNKNOWN:
		return t.Unknown(), nil
	}

	return "", nil
}
