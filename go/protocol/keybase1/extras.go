// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase1

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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

func (u *UserPlusKeys) DeepCopy() UserPlusKeys {
	return UserPlusKeys{
		Uid:               u.Uid,
		Username:          u.Username,
		DeviceKeys:        append([]PublicKey{}, u.DeviceKeys...),
		RevokedDeviceKeys: append([]RevokedKey{}, u.RevokedDeviceKeys...),
		PGPKeyCount:       u.PGPKeyCount,
		Uvv:               u.Uvv,
		DeletedDeviceKeys: append([]PublicKey{}, u.DeletedDeviceKeys...),
		SharedDHKeys:      append([]SharedDHKey{}, u.SharedDHKeys...),
	}
}

func (u *UserPlusAllKeys) DeepCopy() *UserPlusAllKeys {
	return &UserPlusAllKeys{
		Base:         u.Base.DeepCopy(),
		PGPKeys:      append([]PublicKey{}, u.PGPKeys...),
		RemoteTracks: append([]RemoteTrack{}, u.RemoteTracks...),
	}
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

func (u UserPlusKeys) FindKID(needle KID) *PublicKey {
	for _, k := range u.DeviceKeys {
		if k.KID.Equal(needle) {
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
