// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

//=============================================================================
//

type ProofError interface {
	error
	GetProofStatus() keybase1.ProofStatus
	GetDesc() string
}

func ProofErrorIsSoft(pe ProofError) bool {
	s := pe.GetProofStatus()
	return (s >= keybase1.ProofStatus_BASE_ERROR && s < keybase1.ProofStatus_BASE_HARD_ERROR)
}

func ProofErrorIsPvlBad(pe ProofError) bool {
	s := pe.GetProofStatus()
	switch s {
	case keybase1.ProofStatus_INVALID_PVL:
		return true
	case keybase1.ProofStatus_MISSING_PVL:
		return true
	default:
		return false
	}
}

func ProofErrorToState(pe ProofError) keybase1.ProofState {
	if pe == nil {
		return keybase1.ProofState_OK
	}

	switch pe.GetProofStatus() {
	case keybase1.ProofStatus_NO_HINT:
		return keybase1.ProofState_SIG_HINT_MISSING
	case keybase1.ProofStatus_UNKNOWN_TYPE:
		return keybase1.ProofState_UNKNOWN_TYPE
	case keybase1.ProofStatus_UNCHECKED:
		return keybase1.ProofState_UNCHECKED
	default:
		return keybase1.ProofState_TEMP_FAILURE
	}

}

type ProofErrorImpl struct {
	Status keybase1.ProofStatus
	Desc   string
}

func NewProofError(s keybase1.ProofStatus, d string, a ...interface{}) *ProofErrorImpl {
	// Don't do string interpolation if there are no substitution arguments.
	// Fixes double-interpolation when deserializing an object.
	if len(a) == 0 {
		return &ProofErrorImpl{s, d}
	}
	return &ProofErrorImpl{s, fmt.Sprintf(d, a...)}
}

func NewInvalidPVLSelectorError(selector keybase1.SelectorEntry) error {
	return NewProofError(
		keybase1.ProofStatus_INVALID_PVL,
		"JSON selector entry must be a string, int, or 'all' %v",
		selector,
	)
}

func (e *ProofErrorImpl) Error() string {
	return fmt.Sprintf("%s (code=%d)", e.Desc, int(e.Status))
}

func (e *ProofErrorImpl) GetProofStatus() keybase1.ProofStatus { return e.Status }
func (e *ProofErrorImpl) GetDesc() string                      { return e.Desc }

type ProofAPIError struct {
	ProofErrorImpl
	url string
}

var ProofErrorDNSOverTor = &ProofErrorImpl{
	Status: keybase1.ProofStatus_TOR_SKIPPED,
	Desc:   "DNS proofs aren't reliable over Tor",
}

var ProofErrorHTTPOverTor = &ProofErrorImpl{
	Status: keybase1.ProofStatus_TOR_SKIPPED,
	Desc:   "HTTP proofs aren't reliable over Tor",
}

var ProofErrorUnchecked = &ProofErrorImpl{
	Status: keybase1.ProofStatus_UNCHECKED,
	Desc:   "Proof unchecked due to privacy concerns",
}

type TorSessionRequiredError struct{}

func (t TorSessionRequiredError) Error() string {
	return "We can't send out PII in Tor-Strict mode; but it's needed for this operation"
}

func NewProofAPIError(s keybase1.ProofStatus, u string, d string, a ...interface{}) *ProofAPIError {
	base := NewProofError(s, d, a...)
	return &ProofAPIError{*base, u}
}

//=============================================================================

func XapiError(err error, u string) *ProofAPIError {
	if ae, ok := err.(*APIError); ok {
		var code keybase1.ProofStatus
		switch ae.Code / 100 {
		case 3:
			code = keybase1.ProofStatus_HTTP_300
		case 4:
			if ae.Code == 429 {
				code = keybase1.ProofStatus_HTTP_429
			} else {
				code = keybase1.ProofStatus_HTTP_400
			}
		case 5:
			code = keybase1.ProofStatus_HTTP_500
		default:
			code = keybase1.ProofStatus_HTTP_OTHER
		}
		return NewProofAPIError(code, u, ae.Msg)
	}
	return NewProofAPIError(keybase1.ProofStatus_INTERNAL_ERROR, u, err.Error())
}

//=============================================================================

type FailedAssertionError struct {
	user string
	bad  []AssertionURL
}

func (u FailedAssertionError) Error() string {
	v := make([]string, len(u.bad))
	for i, u := range u.bad {
		v[i] = u.String()
	}
	return ("for " + u.user + ", the follow assertions failed: " +
		strings.Join(v, ", "))
}

//=============================================================================

type AssertionParseError struct {
	err string
}

func (e AssertionParseError) Error() string {
	return e.err
}

func NewAssertionParseError(s string, a ...interface{}) AssertionParseError {
	return AssertionParseError{
		err: fmt.Sprintf(s, a...),
	}
}

//=============================================================================

type AssertionCheckError struct {
	err string
}

func (e AssertionCheckError) Error() string {
	return e.err
}

func NewAssertionCheckError(s string, a ...interface{}) AssertionCheckError {
	return AssertionCheckError{
		err: fmt.Sprintf(s, a...),
	}
}

//=============================================================================

type NeedInputError struct {
	err string
}

func (e NeedInputError) Error() string {
	return e.err
}

func NewNeedInputError(s string, a ...interface{}) AssertionParseError {
	return AssertionParseError{
		err: fmt.Sprintf(s, a...),
	}
}

//=============================================================================

type WrongKidError struct {
	wanted, got keybase1.KID
}

func (w WrongKidError) Error() string {
	return fmt.Sprintf("Wanted KID=%s; but got KID=%s", w.wanted, w.got)
}

func NewWrongKidError(w keybase1.KID, g keybase1.KID) WrongKidError {
	return WrongKidError{w, g}
}

//=============================================================================

type WrongKeyError struct {
	wanted, got *PGPFingerprint
}

func (e WrongKeyError) Error() string {
	return fmt.Sprintf("Server gave wrong key; wanted %s; got %s", e.wanted, e.got)
}

//=============================================================================

type UnexpectedKeyError struct {
}

func (e UnexpectedKeyError) Error() string {
	return "Found a key or fingerprint when one wasn't expected"
}

//=============================================================================

type UserNotFoundError struct {
	UID keybase1.UID
	Msg string
}

func (u UserNotFoundError) Error() string {
	uid := ""
	if !u.UID.IsNil() {
		uid = " " + string(u.UID)
	}
	msg := ""
	if u.Msg != "" {
		msg = " (" + u.Msg + ")"
	}
	return fmt.Sprintf("User%s wasn't found%s", uid, msg)
}

//=============================================================================

type AlreadyRegisteredError struct {
	UID keybase1.UID
}

func (u AlreadyRegisteredError) Error() string {
	return fmt.Sprintf("Already registered (with uid=%s)", u.UID)
}

//=============================================================================

type WrongSigError struct {
	b string
}

func (e WrongSigError) Error() string {
	return "Found wrong signature: " + e.b
}

type BadSigError struct {
	E string
}

func (e BadSigError) Error() string {
	return e.E
}

//=============================================================================

type NotFoundError struct {
	Msg string
}

func (e NotFoundError) Error() string {
	if len(e.Msg) == 0 {
		return "Not found"
	}
	return e.Msg
}

func IsNotFoundError(err error) bool {
	_, ok := err.(NotFoundError)
	return ok
}

func NewNotFoundError(s string) error {
	return NotFoundError{s}
}

//=============================================================================

type MissingDelegationTypeError struct{}

func (e MissingDelegationTypeError) Error() string {
	return "DelegationType wasn't set"
}

//=============================================================================

type NoKeyError struct {
	Msg string
}

func (u NoKeyError) Error() string {
	if len(u.Msg) > 0 {
		return u.Msg
	}
	return "No public key found"
}

func IsNoKeyError(err error) bool {
	_, ok := err.(NoKeyError)
	return ok
}

type NoSyncedPGPKeyError struct{}

func (e NoSyncedPGPKeyError) Error() string {
	return "No synced secret PGP key found on keybase.io"
}

//=============================================================================

type NoSecretKeyError struct {
}

func (u NoSecretKeyError) Error() string {
	return "No secret key available"
}

//=============================================================================

type NoPaperKeysError struct {
}

func (u NoPaperKeysError) Error() string {
	return "No paper keys available"
}

//=============================================================================

type TooManyKeysError struct {
	n int
}

func (e TooManyKeysError) Error() string {
	return fmt.Sprintf("Too many keys (%d) found", e.n)
}

//=============================================================================

type NoSelectedKeyError struct{}

func (n NoSelectedKeyError) Error() string {
	return "Please login again to verify your public key"
}

//=============================================================================

type KeyCorruptedError struct {
	Msg string
}

func (e KeyCorruptedError) Error() string {
	msg := "Key corrupted"
	if len(e.Msg) != 0 {
		msg = msg + ": " + e.Msg
	}
	return msg
}

//=============================================================================

type KeyExistsError struct {
	Key *PGPFingerprint
}

func (k KeyExistsError) Error() string {
	ret := "Key already exists for user"
	if k.Key != nil {
		ret = fmt.Sprintf("%s (%s)", ret, k.Key)
	}
	return ret
}

//=============================================================================

type PassphraseError struct {
	Msg string
}

func (p PassphraseError) Error() string {
	msg := "Bad password"
	if len(p.Msg) != 0 {
		msg = msg + ": " + p.Msg + "."
	}
	return msg
}

//=============================================================================

type PaperKeyError struct {
	msg      string
	tryAgain bool
}

func (p PaperKeyError) Error() string {
	msg := "Bad paper key: " + p.msg
	if p.tryAgain {
		msg += ". Please try again."
	}
	return msg
}

func NewPaperKeyError(s string, t bool) error {
	return PaperKeyError{msg: s, tryAgain: t}
}

//=============================================================================

type BadEmailError struct {
	Msg string
}

func (e BadEmailError) Error() string {
	msg := "Bad email"
	if len(e.Msg) != 0 {
		msg = msg + ": " + e.Msg
	}
	return msg
}

//=============================================================================

type BadFingerprintError struct {
	fp1, fp2 PGPFingerprint
}

func (b BadFingerprintError) Error() string {
	return fmt.Sprintf("Got bad PGP key; fingerprint %s != %s", b.fp1, b.fp2)
}

//=============================================================================

type AppStatusError struct {
	Code   int
	Name   string
	Desc   string
	Fields map[string]string
}

// If the error is an AppStatusError, returns its code.
// Otherwise returns (SCGeneric, false).
func GetAppStatusCode(err error) (code keybase1.StatusCode, ok bool) {
	code = keybase1.StatusCode_SCGeneric
	switch err := err.(type) {
	case AppStatusError:
		return keybase1.StatusCode(err.Code), true
	default:
		return code, false
	}
}

func (a AppStatusError) IsBadField(s string) bool {
	_, found := a.Fields[s]
	return found
}

func NewAppStatusError(ast *AppStatus) AppStatusError {
	return AppStatusError{
		Code:   ast.Code,
		Name:   ast.Name,
		Desc:   ast.Desc,
		Fields: ast.Fields,
	}
}

func (a AppStatusError) Error() string {
	v := make([]string, len(a.Fields))
	i := 0

	for k := range a.Fields {
		v[i] = k
		i++
	}

	fields := ""
	if i > 0 {
		fields = fmt.Sprintf(" (bad fields: %s)", strings.Join(v, ","))
	}

	return fmt.Sprintf("%s%s (error %d)", a.Desc, fields, a.Code)
}

func (a AppStatusError) WithDesc(desc string) AppStatusError {
	a.Desc = desc
	return a
}

func IsAppStatusCode(err error, code keybase1.StatusCode) bool {
	switch err := err.(type) {
	case AppStatusError:
		return err.Code == int(code)
	default:
		return false
	}
}

func IsEphemeralRetryableError(err error) bool {
	switch err := err.(type) {
	case AppStatusError:
		switch keybase1.StatusCode(err.Code) {
		case keybase1.StatusCode_SCSigWrongKey,
			keybase1.StatusCode_SCSigOldSeqno,
			keybase1.StatusCode_SCEphemeralKeyBadGeneration,
			keybase1.StatusCode_SCEphemeralKeyUnexpectedBox,
			keybase1.StatusCode_SCEphemeralKeyMissingBox,
			keybase1.StatusCode_SCEphemeralKeyWrongNumberOfKeys:
			return true
		default:
			return false
		}
	default:
		return false
	}
}

//=============================================================================

type GpgError struct {
	M string
}

func (e GpgError) Error() string {
	return fmt.Sprintf("GPG error: %s", e.M)
}

func ErrorToGpgError(e error) GpgError {
	return GpgError{e.Error()}
}

type GpgIndexError struct {
	lineno int
	m      string
}

func (e GpgIndexError) Error() string {
	return fmt.Sprintf("GPG index error at line %d: %s", e.lineno, e.m)
}

func ErrorToGpgIndexError(l int, e error) GpgIndexError {
	return GpgIndexError{l, e.Error()}
}

type GPGUnavailableError struct{}

func (g GPGUnavailableError) Error() string {
	return "GPG is unavailable on this device"
}

//=============================================================================

type LoginRequiredError struct {
	Context string
}

func (e LoginRequiredError) Error() string {
	msg := "Login required"
	if len(e.Context) > 0 {
		msg = fmt.Sprintf("%s: %s", msg, e.Context)
	}
	return msg
}

func NewLoginRequiredError(s string) error {
	return LoginRequiredError{s}
}

type ReloginRequiredError struct{}

func (e ReloginRequiredError) Error() string {
	return "Login required due to an unexpected error since your previous login"
}

type DeviceRequiredError struct{}

func (e DeviceRequiredError) Error() string {
	return "Login required"
}

type NoSessionError struct{}

// KBFS currently matching on this string, so be careful changing this:
func (e NoSessionError) Error() string {
	return "no current session"
}

//=============================================================================

type LogoutError struct{}

func (e LogoutError) Error() string {
	return "Failed to logout"
}

//=============================================================================

type LoggedInError struct{}

func (e LoggedInError) Error() string {
	return "You are already logged in as a different user; try logout first"
}

//=============================================================================

type LoggedInWrongUserError struct {
	ExistingName  NormalizedUsername
	AttemptedName NormalizedUsername
}

func (e LoggedInWrongUserError) Error() string {
	return fmt.Sprintf("Logged in as %q, attempting to log in as %q: try logout first", e.ExistingName, e.AttemptedName)
}

//=============================================================================

type InternalError struct {
	Msg string
}

func (e InternalError) Error() string {
	return fmt.Sprintf("Internal error: %s", e.Msg)
}

//=============================================================================

type ServerChainError struct {
	msg string
}

func (e ServerChainError) Error() string {
	return e.msg
}

func NewServerChainError(d string, a ...interface{}) ServerChainError {
	return ServerChainError{fmt.Sprintf(d, a...)}
}

//=============================================================================

type WaitForItError struct{}

func (e WaitForItError) Error() string {
	return "It is advised you 'wait for it'"
}

//=============================================================================

type InsufficientKarmaError struct {
	un string
}

func (e InsufficientKarmaError) Error() string {
	return "Bad karma"
}

func NewInsufficientKarmaError(un string) InsufficientKarmaError {
	return InsufficientKarmaError{un: un}
}

//=============================================================================

type InvalidHostnameError struct {
	h string
}

func (e InvalidHostnameError) Error() string {
	return "Invalid hostname: " + e.h
}
func NewInvalidHostnameError(h string) InvalidHostnameError {
	return InvalidHostnameError{h: h}
}

//=============================================================================

type WebUnreachableError struct {
	h string
}

func (h WebUnreachableError) Error() string {
	return "Host " + h.h + " is down; tried both HTTPS and HTTP protocols"
}

func NewWebUnreachableError(h string) WebUnreachableError {
	return WebUnreachableError{h: h}
}

//=============================================================================

type ProtocolSchemeMismatch struct {
	msg string
}

func (h ProtocolSchemeMismatch) Error() string {
	return h.msg
}
func NewProtocolSchemeMismatch(msg string) ProtocolSchemeMismatch {
	return ProtocolSchemeMismatch{msg: msg}
}

//=============================================================================
type ProtocolDowngradeError struct {
	msg string
}

func (h ProtocolDowngradeError) Error() string {
	return h.msg
}
func NewProtocolDowngradeError(msg string) ProtocolDowngradeError {
	return ProtocolDowngradeError{msg: msg}
}

//=============================================================================

type ProfileNotPublicError struct {
	msg string
}

func (p ProfileNotPublicError) Error() string {
	return p.msg
}

func NewProfileNotPublicError(s string) ProfileNotPublicError {
	return ProfileNotPublicError{msg: s}
}

//=============================================================================

type BadUsernameError struct {
	N   string
	msg string
}

func (e BadUsernameError) Error() string {
	if len(e.msg) == 0 {
		return "Bad username: '" + e.N + "'"
	}
	return e.msg
}

func NewBadUsernameError(n string) BadUsernameError {
	return BadUsernameError{N: n}
}

func NewBadUsernameErrorWithFullMessage(msg string) BadUsernameError {
	return BadUsernameError{msg: msg}
}

//=============================================================================

type NoUsernameError struct{}

func (e NoUsernameError) Error() string {
	return "No username known"
}

func NewNoUsernameError() NoUsernameError { return NoUsernameError{} }

//=============================================================================

type NoKeyringsError struct{}

func (k NoKeyringsError) Error() string {
	return "No keyrings available"
}

//=============================================================================

type KeyCannotSignError struct{}

func (s KeyCannotSignError) Error() string {
	return "Key cannot create signatures"
}

type KeyCannotVerifyError struct{}

func (k KeyCannotVerifyError) Error() string {
	return "Key cannot verify signatures"
}

type KeyCannotEncryptError struct{}

func (k KeyCannotEncryptError) Error() string {
	return "Key cannot encrypt data"
}

type KeyCannotDecryptError struct{}

func (k KeyCannotDecryptError) Error() string {
	return "Key cannot decrypt data"
}

type KeyUnimplementedError struct{}

func (k KeyUnimplementedError) Error() string {
	return "Key function isn't implemented yet"
}

type NoPGPEncryptionKeyError struct {
	User                    string
	HasKeybaseEncryptionKey bool
}

func (e NoPGPEncryptionKeyError) Error() string {
	var other string
	if e.HasKeybaseEncryptionKey {
		other = "; they do have a keybase key, so you can `keybase encrypt` to them instead"
	}
	return fmt.Sprintf("User %s doesn't have a PGP key%s", e.User, other)
}

type NoNaClEncryptionKeyError struct {
	Username     string
	HasPGPKey    bool
	HasPUK       bool
	HasDeviceKey bool
	HasPaperKey  bool
}

func (e NoNaClEncryptionKeyError) Error() string {
	var other string
	switch {
	case e.HasPUK:
		other = "; they have a per user key, so you can encrypt without the `--no-entity-keys` flag to them instead"
	case e.HasDeviceKey:
		other = "; they do have a device key, so you can encrypt without the `--no-device-keys` flag to them instead"
	case e.HasPaperKey:
		other = "; they do have a paper key, so you can encrypt without the `--no-paper-keys` flag to them instead"
	case e.HasPGPKey:
		other = "; they do have a PGP key, so you can `keybase pgp encrypt` to encrypt for them instead"
	}

	return fmt.Sprintf("User %s doesn't have the necessary key type(s)%s", e.Username, other)
}

type KeyPseudonymError struct {
	message string
}

func (e KeyPseudonymError) Error() string {
	if e.message != "" {
		return e.message
	}
	return "Bad Key Pseydonym or Nonce"
}

func NewKeyPseudonymError(message string) KeyPseudonymError {
	return KeyPseudonymError{message: message}
}

//=============================================================================

type DecryptBadPacketTypeError struct{}

func (d DecryptBadPacketTypeError) Error() string {
	return "Bad packet type; can't decrypt"
}

type DecryptBadNonceError struct{}

func (d DecryptBadNonceError) Error() string {
	return "Bad packet nonce; can't decrypt"
}

type DecryptBadSenderError struct{}

func (d DecryptBadSenderError) Error() string {
	return "Bad sender key"
}

type DecryptWrongReceiverError struct{}

func (d DecryptWrongReceiverError) Error() string {
	return "Bad receiver key"
}

type DecryptOpenError struct {
	What string
}

func NewDecryptOpenError(what string) DecryptOpenError {
	return DecryptOpenError{What: what}
}

func (d DecryptOpenError) Error() string {
	if len(d.What) == 0 {
		return "box.Open failure; ciphertext was corrupted or wrong key"
	}
	return fmt.Sprintf("failed to decrypt '%s'; ciphertext was corrupted or wrong key", d.What)
}

//=============================================================================

type NoConfigFileError struct{}

func (n NoConfigFileError) Error() string {
	return "No configuration file available"
}

//=============================================================================

type SelfTrackError struct{}

func (e SelfTrackError) Error() string {
	return "Cannot follow yourself"
}

//=============================================================================

type NoUIError struct {
	Which string
}

func (e NoUIError) Error() string {
	return fmt.Sprintf("no %s-UI was available", e.Which)
}

//=============================================================================

type NoConfigWriterError struct{}

func (e NoConfigWriterError) Error() string {
	return "Can't write; no ConfigWriter available"
}

//=============================================================================

type NoSessionWriterError struct{}

func (e NoSessionWriterError) Error() string {
	return "Can't write; no SessionWriter available"
}

//=============================================================================

type BadServiceError struct {
	Service string
}

func (e BadServiceError) Error() string {
	return e.Service + ": unsupported service"
}

type ServiceDoesNotSupportNewProofsError struct {
	Service string
}

func (e ServiceDoesNotSupportNewProofsError) Error() string {
	if len(e.Service) == 0 {
		return fmt.Sprintf("New proofs of that type are not supported")
	}
	return fmt.Sprintf("New %s proofs are not supported", e.Service)
}

//=============================================================================

type NotConfirmedError struct{}

func (e NotConfirmedError) Error() string {
	return "Not confirmed"
}

//=============================================================================

type SibkeyAlreadyExistsError struct{}

func (e SibkeyAlreadyExistsError) Error() string {
	return "Key is already selected for use on Keybase"
}

//=============================================================================

type ProofNotYetAvailableError struct{}

func (e ProofNotYetAvailableError) Error() string {
	return "Proof wasn't available; we'll keep trying"
}

type ProofNotFoundForServiceError struct {
	Service string
}

func (e ProofNotFoundForServiceError) Error() string {
	return fmt.Sprintf("proof not found for service %q", e.Service)
}

type ProofNotFoundForUsernameError struct {
	Service  string
	Username string
}

func (e ProofNotFoundForUsernameError) Error() string {
	return fmt.Sprintf("proof not found for %q on %q", e.Username, e.Service)
}

//=============================================================================

//=============================================================================

type KeyGenError struct {
	Msg string
}

func (e KeyGenError) Error() string {
	return fmt.Sprintf("key generation error: %s", e.Msg)
}

//=============================================================================

type KeyFamilyError struct {
	Msg string
}

func (e KeyFamilyError) Error() string {
	return fmt.Sprintf("Bad key family: %s", e.Msg)
}

//=============================================================================

type BadRevocationError struct {
	msg string
}

func (e BadRevocationError) Error() string {
	return fmt.Sprintf("Bad revocation: %s", e.msg)
}

//=============================================================================

type NoSigChainError struct{}

func (e NoSigChainError) Error() string {
	return "No sigchain was available"
}

//=============================================================================

type NotProvisionedError struct{}

func (e NotProvisionedError) Error() string {
	return "This device isn't provisioned (no 'device_kid' entry in config.json)"
}

//=============================================================================

type UIDMismatchError struct {
	Msg string
}

func (u UIDMismatchError) Error() string {
	return fmt.Sprintf("UID mismatch error: %s", u.Msg)
}

func NewUIDMismatchError(m string) UIDMismatchError {
	return UIDMismatchError{Msg: m}
}

//=============================================================================

type KeyRevokedError struct {
	msg string
}

func NewKeyRevokedError(m string) KeyRevokedError {
	return KeyRevokedError{m}
}

func (r KeyRevokedError) Error() string {
	return fmt.Sprintf("Key revoked: %s", r.msg)
}

//=============================================================================

type KeyExpiredError struct {
	msg string
}

func (r KeyExpiredError) Error() string {
	return fmt.Sprintf("Key expired: %s", r.msg)
}

//=============================================================================

type UnknownKeyTypeError struct {
	typ kbcrypto.AlgoType
}

func (e UnknownKeyTypeError) Error() string {
	return fmt.Sprintf("Unknown key type: %d", e.typ)
}

//=============================================================================

type SelfNotFoundError struct {
	msg string
}

func (e SelfNotFoundError) Error() string {
	return e.msg
}

type ChainLinkError struct {
	msg string
}

func (c ChainLinkError) Error() string {
	return fmt.Sprintf("Error in parsing chain Link: %s", c.msg)
}

type ChainLinkStubbedUnsupportedError struct {
	msg string
}

func (c ChainLinkStubbedUnsupportedError) Error() string {
	return c.msg
}

type SigchainV2Error struct {
	msg string
}

func (s SigchainV2Error) Error() string {
	return fmt.Sprintf("Error in sigchain v2 link: %s", s.msg)
}

type SigchainV2MismatchedFieldError struct {
	msg string
}

func (s SigchainV2MismatchedFieldError) Error() string {
	return fmt.Sprintf("Mismatched field in sigchain v2 link: %s", s.msg)
}

type SigchainV2StubbedFirstLinkError struct{}

func (s SigchainV2StubbedFirstLinkError) Error() string {
	return "First link can't be stubbed out"
}

type SigchainV2StubbedSignatureNeededError struct{}

func (s SigchainV2StubbedSignatureNeededError) Error() string {
	return "Stubbed-out link actually needs a signature"
}

type SigchainV2MismatchedHashError struct{}

func (s SigchainV2MismatchedHashError) Error() string {
	return "Sigchain V2 hash mismatch error"
}

type SigchainV2StubbedDisallowed struct{}

func (s SigchainV2StubbedDisallowed) Error() string {
	return "Link was stubbed but required"
}

type SigchainV2Required struct{}

func (s SigchainV2Required) Error() string {
	return "Link must use sig v2"
}

//=============================================================================

type ReverseSigError struct {
	msg string
}

func (r ReverseSigError) Error() string {
	return fmt.Sprintf("Error in reverse signature: %s", r.msg)
}

func NewReverseSigError(msgf string, a ...interface{}) ReverseSigError {
	return ReverseSigError{msg: fmt.Sprintf(msgf, a...)}
}

//=============================================================================

type ConfigError struct {
	fn  string
	msg string
}

func (c ConfigError) Error() string {
	return fmt.Sprintf("In config file %s: %s\n", c.fn, c.msg)
}

//=============================================================================

type NoUserConfigError struct{}

func (n NoUserConfigError) Error() string {
	return "No user config found for user"
}

//=============================================================================

type InactiveKeyError struct {
	kid keybase1.KID
}

func (i InactiveKeyError) Error() string {
	return fmt.Sprintf("The key '%s' is not active", i.kid)
}

//=============================================================================

type merkleClientErrorType int

const (
	merkleErrorNone merkleClientErrorType = iota
	merkleErrorNoKnownKey
	merkleErrorNoLegacyUIDRoot
	merkleErrorUIDMismatch
	merkleErrorNoSkipSequence
	merkleErrorSkipMissing
	merkleErrorSkipHashMismatch
	merkleErrorHashMeta
	merkleErrorBadResetChain
	merkleErrorNotFound
	merkleErrorBadSeqno
	merkleErrorBadLeaf
	merkleErrorNoUpdates
	merkleErrorBadSigID
	merkleErrorAncientSeqno
	merkleErrorKBFSBadTree
	merkleErrorKBFSMismatch
	merkleErrorBadRoot
	merkleErrorOldTree
	merkleErrorOutOfOrderCtime
	merkleErrorWrongSkipSequence
	merkleErrorWrongRootSkips
	merkleErrorFailedCheckpoint
	merkleErrorTooMuchClockDrift
)

type MerkleClientError struct {
	m string
	t merkleClientErrorType
}

func NewClientMerkleSkipHashMismatchError(m string) MerkleClientError {
	return MerkleClientError{
		t: merkleErrorSkipHashMismatch,
		m: m,
	}
}

func NewClientMerkleSkipMissingError(m string) MerkleClientError {
	return MerkleClientError{
		t: merkleErrorSkipMissing,
		m: m,
	}
}

func NewClientMerkleFailedCheckpointError(m string) MerkleClientError {
	return MerkleClientError{
		t: merkleErrorFailedCheckpoint,
		m: m,
	}
}

func (m MerkleClientError) Error() string {
	return fmt.Sprintf("Error checking merkle tree: %s", m.m)
}

func (m MerkleClientError) IsNotFound() bool {
	return m.t == merkleErrorNotFound
}

func (m MerkleClientError) IsOldTree() bool {
	return m.t == merkleErrorOldTree
}

func (m MerkleClientError) IsSkipHashMismatch() bool {
	return m.t == merkleErrorSkipHashMismatch
}

type MerklePathNotFoundError struct {
	k   string
	msg string
}

func (m MerklePathNotFoundError) Error() string {
	return fmt.Sprintf("For key '%s', Merkle path not found: %s", m.k, m.msg)
}

type MerkleClashError struct {
	c string
}

func (m MerkleClashError) Error() string {
	return fmt.Sprintf("Merkle tree clashed with server reply: %s", m.c)
}

//=============================================================================

type CanceledError struct {
	M string
}

func (c CanceledError) Error() string {
	return c.M
}

func NewCanceledError(m string) CanceledError {
	return CanceledError{M: m}
}

type InputCanceledError struct{}

func (e InputCanceledError) Error() string {
	return "Input canceled"
}

type SkipSecretPromptError struct{}

func (e SkipSecretPromptError) Error() string {
	return "Skipping secret prompt due to recent user cancel of secret prompt"
}

//=============================================================================

type NoDeviceError struct {
	Reason string
}

func NewNoDeviceError(s string) NoDeviceError {
	return NoDeviceError{s}
}

func (e NoDeviceError) Error() string {
	return fmt.Sprintf("No device found %s", e.Reason)
}

type TimeoutError struct{}

func (e TimeoutError) Error() string {
	return "Operation timed out"
}

type ReceiverDeviceError struct {
	Msg string
}

func NewReceiverDeviceError(expected, received keybase1.DeviceID) ReceiverDeviceError {
	return ReceiverDeviceError{Msg: fmt.Sprintf("Device ID mismatch in message receiver, got %q, expected %q", received, expected)}
}

func (e ReceiverDeviceError) Error() string {
	return e.Msg
}

type InvalidKexPhraseError struct{}

func (e InvalidKexPhraseError) Error() string {
	return "Invalid kex secret phrase"
}

var ErrNilUser = errors.New("User is nil")

//=============================================================================

type StreamExistsError struct{}

func (s StreamExistsError) Error() string { return "stream already exists" }

type StreamNotFoundError struct{}

func (s StreamNotFoundError) Error() string { return "stream wasn't found" }

type StreamWrongKindError struct{}

func (s StreamWrongKindError) Error() string { return "found a stream but not of right kind" }

//=============================================================================

type UntrackError struct {
	err string
}

func (e UntrackError) Error() string {
	return fmt.Sprintf("Unfollow error: %s", e.err)
}

func NewUntrackError(d string, a ...interface{}) UntrackError {
	return UntrackError{
		err: fmt.Sprintf(d, a...),
	}
}

//=============================================================================

type APINetError struct {
	Err error
}

func (e APINetError) Error() string {
	return fmt.Sprintf("API network error: %s", e.Err)
}

//=============================================================================

type NoDecryptionKeyError struct {
	Msg string
}

func (e NoDecryptionKeyError) Error() string {
	return fmt.Sprintf("decrypt error: %s", e.Msg)
}

//=============================================================================

type DecryptionError struct {
	Cause error
}

func (e DecryptionError) Error() string {
	if e.Cause == nil {
		return "Decryption error"
	}
	return fmt.Sprintf("Decryption error: %v", e.Cause)
}

//=============================================================================

type ChainLinkPrevHashMismatchError struct {
	Msg string
}

func (e ChainLinkPrevHashMismatchError) Error() string {
	return fmt.Sprintf("Chain link prev hash mismatch error: %s", e.Msg)
}

//=============================================================================

type ChainLinkWrongSeqnoError struct {
	Msg string
}

func (e ChainLinkWrongSeqnoError) Error() string {
	return fmt.Sprintf("Chain link wrong seqno error: %s", e.Msg)
}

func NewChainLinkWrongSeqnoError(s string) error {
	return ChainLinkWrongSeqnoError{s}
}

//=============================================================================

type ChainLinkHighSkipHashMismatchError struct {
	Msg string
}

func (e ChainLinkHighSkipHashMismatchError) Error() string {
	return fmt.Sprintf("Chain link HighSkipHash mismatch error: %s", e.Msg)
}

//=============================================================================

type ChainLinkWrongHighSkipSeqnoError struct {
	Msg string
}

func (e ChainLinkWrongHighSkipSeqnoError) Error() string {
	return fmt.Sprintf("Chain link wrong HighSkipSeqno error: %s", e.Msg)
}

//=============================================================================

type CtimeMismatchError struct {
	Msg string
}

func (e CtimeMismatchError) Error() string {
	return fmt.Sprintf("Ctime mismatch error: %s", e.Msg)
}

//=============================================================================

type ChainLinkFingerprintMismatchError struct {
	Msg string
}

func (e ChainLinkFingerprintMismatchError) Error() string {
	return e.Msg
}

//=============================================================================

type ChainLinkKIDMismatchError struct {
	Msg string
}

func (e ChainLinkKIDMismatchError) Error() string {
	return e.Msg
}

//=============================================================================

type UnknownSpecialKIDError struct {
	k keybase1.KID
}

func (u UnknownSpecialKIDError) Error() string {
	return fmt.Sprintf("Unknown special KID: %s", u.k)
}

type IdentifyTimeoutError struct{}

func (e IdentifyTimeoutError) Error() string {
	return "Identification expired."
}

//=============================================================================

type TrackBrokenError struct{}

func (e TrackBrokenError) Error() string {
	return "track of user was broken"
}

//=============================================================================

type IdentifyDidNotCompleteError struct{}

func (e IdentifyDidNotCompleteError) Error() string {
	return "Identification did not complete."
}

//=============================================================================

type IdentifyFailedError struct {
	Assertion string
	Reason    string
}

func (e IdentifyFailedError) Error() string {
	return fmt.Sprintf("For user %q: %s", e.Assertion, e.Reason)
}

//=============================================================================

type IdentifiesFailedError struct {
}

func (e IdentifiesFailedError) Error() string {
	return fmt.Sprintf("one or more identifies failed")
}

func NewIdentifiesFailedError() IdentifiesFailedError {
	return IdentifiesFailedError{}
}

//=============================================================================

type IdentifySummaryError struct {
	username NormalizedUsername
	problems []string
}

func NewIdentifySummaryError(failure keybase1.TLFIdentifyFailure) IdentifySummaryError {
	problem := "a followed proof failed"
	if failure.Breaks != nil {
		num := len(failure.Breaks.Proofs)
		problem = fmt.Sprintf("%d followed proof%s failed", num, GiveMeAnS(num))
	}
	return IdentifySummaryError{
		username: NewNormalizedUsername(failure.User.Username),
		problems: []string{problem},
	}
}

func (e IdentifySummaryError) Error() string {
	return fmt.Sprintf("failed to identify %q: %s",
		e.username,
		strings.Join(e.problems, "; "))
}

func (e IdentifySummaryError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_IDENTIFY, true
}

func (e IdentifySummaryError) Problems() []string {
	return e.problems
}

func IsIdentifyProofError(err error) bool {
	switch err.(type) {
	case ProofError, IdentifySummaryError:
		return true
	default:
		return false
	}
}

//=============================================================================

type NotLatestSubchainError struct {
	Msg string
}

func (e NotLatestSubchainError) Error() string {
	return e.Msg
}

type LoginSessionNotFound struct {
	SessionID int
}

func (e LoginSessionNotFound) Error() string {
	return fmt.Sprintf("No login session found for session id %d", e.SessionID)
}

type KeyVersionError struct{}

func (k KeyVersionError) Error() string {
	return "Invalid key version"
}

//=============================================================================

type PIDFileLockError struct {
	Filename string
}

func (e PIDFileLockError) Error() string {
	return fmt.Sprintf("error locking %s: server already running", e.Filename)
}

type SecretStoreError struct {
	Msg string
}

func (e SecretStoreError) Error() string {
	return "Secret store error: " + e.Msg
}

type PassphraseProvisionImpossibleError struct{}

func (e PassphraseProvisionImpossibleError) Error() string {
	return "Passphrase provision is not possible since you have at least one provisioned device or pgp key already"
}

type ProvisionViaDeviceRequiredError struct{}

func (e ProvisionViaDeviceRequiredError) Error() string {
	return "You must select an existing device to provision a new device"
}

type ProvisionUnavailableError struct{}

func (e ProvisionUnavailableError) Error() string {
	return "Provision unavailable as you don't have access to any of your devices"
}

type InvalidArgumentError struct {
	Msg string
}

func (e InvalidArgumentError) Error() string {
	return fmt.Sprintf("invalid argument: %s", e.Msg)
}

type RetryExhaustedError struct {
}

func (e RetryExhaustedError) Error() string {
	return "Prompt attempts exhausted."
}

//=============================================================================

type PGPPullLoggedOutError struct{}

func (e PGPPullLoggedOutError) Error() string {
	return "When running `pgp pull` logged out, you must specify users to pull keys for"
}

//=============================================================================

type UIDelegationUnavailableError struct{}

func (e UIDelegationUnavailableError) Error() string {
	return "This process does not support UI delegation"
}

//=============================================================================

type UnmetAssertionError struct {
	User   string
	Remote bool
}

func (e UnmetAssertionError) Error() string {
	which := "local"
	if e.Remote {
		which = "remote"
	}
	return fmt.Sprintf("Unmet %s assertions for user %q", which, e.User)
}

//=============================================================================

type ResolutionErrorKind int

const (
	ResolutionErrorGeneral ResolutionErrorKind = iota
	ResolutionErrorNotFound
	ResolutionErrorAmbiguous
	ResolutionErrorRateLimited
	ResolutionErrorInvalidInput
	ResolutionErrorRequestFailed
)

type ResolutionError struct {
	Input string
	Msg   string
	Kind  ResolutionErrorKind
}

func (e ResolutionError) Error() string {
	return fmt.Sprintf("In resolving '%s': %s", e.Input, e.Msg)
}

func IsResolutionError(err error) bool {
	_, ok := err.(ResolutionError)
	return ok
}

func IsResolutionNotFoundError(err error) bool {
	rerr, ok := err.(ResolutionError)
	if !ok {
		return false
	}
	return rerr.Kind == ResolutionErrorNotFound
}

//=============================================================================

type NoUIDError struct{}

func (e NoUIDError) Error() string {
	return "No UID given but one was expected"
}

//=============================================================================

type TrackingBrokeError struct{}

func (e TrackingBrokeError) Error() string {
	return "Following broke"
}

//=============================================================================

type KeybaseSaltpackError struct{}

func (e KeybaseSaltpackError) Error() string {
	return "Bad use of saltpack for Keybase"
}

//=============================================================================

type TrackStaleError struct {
	FirstTrack bool
}

func (e TrackStaleError) Error() string {
	return "Following statement was stale"
}

//=============================================================================

type InconsistentCacheStateError struct{}

func (e InconsistentCacheStateError) Error() string {
	return "Inconsistent cache state, likely after a DB reset; need a force reload"
}

//=============================================================================

type UnknownStreamError struct{}

func (e UnknownStreamError) Error() string {
	return "unknown stream format"
}

type UTF16UnsupportedError struct{}

func (e UTF16UnsupportedError) Error() string {
	return "UTF-16 not supported"
}

type WrongCryptoFormatError struct {
	Wanted, Received CryptoMessageFormat
	Operation        string
}

func (e WrongCryptoFormatError) Error() string {
	ret := "Wrong crypto message format"
	switch {
	case e.Wanted == CryptoMessageFormatPGP && e.Received == CryptoMessageFormatSaltpack:
		ret += "; wanted PGP but got saltpack"
		if len(e.Operation) > 0 {
			ret += "; try `keybase " + e.Operation + "` instead"
		}
	case e.Wanted == CryptoMessageFormatSaltpack && e.Received == CryptoMessageFormatPGP:
		ret += "; wanted saltpack but got PGP"
		if len(e.Operation) > 0 {
			ret += "; try `keybase pgp " + e.Operation + "` instead"
		}
	}
	return ret
}

//=============================================================================

type BadInvitationCodeError struct{}

func (e BadInvitationCodeError) Error() string {
	return "bad invitation code"
}

type NoMatchingGPGKeysError struct {
	Fingerprints    []string
	HasActiveDevice bool // true if the user has an active device that they chose not to use
}

func (e NoMatchingGPGKeysError) Error() string {
	return fmt.Sprintf("No private GPG keys found on this device that match account PGP keys %s", strings.Join(e.Fingerprints, ", "))
}

type DeviceAlreadyProvisionedError struct{}

func (e DeviceAlreadyProvisionedError) Error() string {
	return "Device already provisioned for current user"
}

type DirExecError struct {
	Path string
}

func (e DirExecError) Error() string {
	return fmt.Sprintf("file %q is a directory and not executable", e.Path)
}

type FileExecError struct {
	Path string
}

func (e FileExecError) Error() string {
	return fmt.Sprintf("file %q is not executable", e.Path)
}

func IsExecError(err error) bool {
	if err == nil {
		return false
	}

	switch err.(type) {
	case DirExecError:
		return true
	case FileExecError:
		return true
	case *exec.Error:
		return true
	case *os.PathError:
		return true
	}
	return false
}

//=============================================================================

type UserDeletedError struct {
	Msg string
}

func (e UserDeletedError) Error() string {
	if len(e.Msg) == 0 {
		return "User deleted"
	}
	return e.Msg
}

//=============================================================================

type DeviceNameInUseError struct{}

func (e DeviceNameInUseError) Error() string {
	return "device name already in use"
}

//=============================================================================

type DeviceBadNameError struct{}

func (e DeviceBadNameError) Error() string {
	return "device name is malformed"
}

//=============================================================================

type UnexpectedChatDataFromServer struct {
	Msg string
}

func (e UnexpectedChatDataFromServer) Error() string {
	return fmt.Sprintf("unexpected chat data from server: %s", e.Msg)
}

//=============================================================================

type ChatInternalError struct{}

func (e ChatInternalError) Error() string {
	return "chat internal error"
}

//=============================================================================

type ChatConvExistsError struct {
	ConvID chat1.ConversationID
}

func (e ChatConvExistsError) Error() string {
	return fmt.Sprintf("conversation already exists: %s", e.ConvID)
}

//=============================================================================

type ChatMessageCollisionError struct {
	HeaderHash string
}

func (e ChatMessageCollisionError) Error() string {
	return fmt.Sprintf("a message with that hash already exists: %s", e.HeaderHash)
}

//=============================================================================

type ChatCollisionError struct {
}

func (e ChatCollisionError) Error() string {
	return fmt.Sprintf("conversation id collision")
}

//=============================================================================

type ChatUnknownTLFIDError struct {
	TlfID chat1.TLFID
}

func (e ChatUnknownTLFIDError) Error() string {
	return fmt.Sprintf("unknown TLF ID: %s", hex.EncodeToString(e.TlfID))
}

//=============================================================================

type ChatNotInConvError struct {
	UID    gregor.UID
	ConvID chat1.ConversationID
}

func (e ChatNotInConvError) Error() string {
	return fmt.Sprintf("user is not in conversation: %s uid: %s", e.ConvID.String(), e.UID.String())
}

func (e ChatNotInConvError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

//=============================================================================

type ChatNotInTeamError struct {
	UID   gregor.UID
	TlfID chat1.TLFID
}

func (e ChatNotInTeamError) Error() string {
	return fmt.Sprintf("user is not in team: %v uid: %s", e.TlfID, e.UID.String())
}

func (e ChatNotInTeamError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

//=============================================================================

type ChatBadMsgError struct {
	Msg string
}

func (e ChatBadMsgError) Error() string {
	return e.Msg
}

func (e ChatBadMsgError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

//=============================================================================

type ChatBroadcastError struct {
	Msg string
}

func (e ChatBroadcastError) Error() string {
	return e.Msg
}

//=============================================================================

type ChatRateLimitError struct {
	Msg       string
	RateLimit chat1.RateLimit
}

func (e ChatRateLimitError) Error() string {
	return e.Msg
}

//=============================================================================

type ChatAlreadySupersededError struct {
	Msg string
}

func (e ChatAlreadySupersededError) Error() string {
	return e.Msg
}

func (e ChatAlreadySupersededError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

//=============================================================================

type ChatAlreadyDeletedError struct {
	Msg string
}

func (e ChatAlreadyDeletedError) Error() string {
	return e.Msg
}

func (e ChatAlreadyDeletedError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_ALREADY_DELETED, true
}

//=============================================================================

type ChatTLFFinalizedError struct {
	TlfID chat1.TLFID
}

func (e ChatTLFFinalizedError) Error() string {
	return fmt.Sprintf("unable to create conversation on finalized TLF: %s", e.TlfID)
}

//=============================================================================

type ChatDuplicateMessageError struct {
	OutboxID chat1.OutboxID
}

func (e ChatDuplicateMessageError) Error() string {
	return fmt.Sprintf("duplicate message send: outboxID: %s", e.OutboxID)
}

func (e ChatDuplicateMessageError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_DUPLICATE, true
}

//=============================================================================

type ChatClientError struct {
	Msg string
}

func (e ChatClientError) Error() string {
	return fmt.Sprintf("error from chat server: %s", e.Msg)
}

func (e ChatClientError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	if strings.HasPrefix(e.Msg, "Admins have set that you must be a team") {
		return chat1.OutboxErrorType_MINWRITER, true
	}
	return chat1.OutboxErrorType_MISC, true
}

//=============================================================================

type ChatStalePreviousStateError struct{}

func (e ChatStalePreviousStateError) Error() string {
	return "Unable to change chat channels"
}

//=============================================================================

type ChatEphemeralRetentionPolicyViolatedError struct {
	MaxAge gregor1.DurationSec
}

func (e ChatEphemeralRetentionPolicyViolatedError) Error() string {
	return fmt.Sprintf("messages in this conversation are required to be exploding with a maximum lifetime of %v", e.MaxAge.ToDuration())
}

//=============================================================================

type InvalidAddressError struct {
	Msg string
}

func (e InvalidAddressError) Error() string {
	return e.Msg
}

type ExistsError struct {
	Msg string
}

func (e ExistsError) Error() string {
	return e.Msg
}

//=============================================================================

type LevelDBOpenClosedError struct{}

func (e LevelDBOpenClosedError) Error() string {
	return "opening a closed DB"
}

//=============================================================================

type DBError struct {
	Msg string
}

func (e DBError) Error() string {
	return fmt.Sprintf("DB error: %s", e.Msg)
}

func NewDBError(s string) DBError {
	return DBError{Msg: s}
}

//=============================================================================

// These rekey types are not-exact duplicates of the libkbfs errors of the same name.

// NeedSelfRekeyError indicates that the folder in question needs to
// be rekeyed for the local device, and can be done so by one of the
// other user's devices.
type NeedSelfRekeyError struct {
	// Canonical tlf name
	Tlf string
	Msg string
}

func (e NeedSelfRekeyError) Error() string {
	return e.Msg
}

// NeedOtherRekeyError indicates that the folder in question needs to
// be rekeyed for the local device, and can only done so by one of the
// other users.
type NeedOtherRekeyError struct {
	// Canonical tlf name
	Tlf string
	Msg string
}

func (e NeedOtherRekeyError) Error() string {
	return e.Msg
}

//=============================================================================

type DeviceNotFoundError struct {
	Where  string
	ID     keybase1.DeviceID
	Loaded bool
}

func (e DeviceNotFoundError) Error() string {
	loaded := ""
	if !e.Loaded {
		loaded = " (no device keys loaded)"
	}
	return fmt.Sprintf("%s: no device found for ID=%s%s", e.Where, e.ID, loaded)
}

//=============================================================================

// PseudonymGetError is sometimes written by unmarshaling (no fields of) a server response.
type PseudonymGetError struct {
	msg string
}

func (e PseudonymGetError) Error() string {
	if e.msg == "" {
		return "Pseudonym could not be resolved"
	}
	return e.msg
}

var _ error = (*PseudonymGetError)(nil)

//=============================================================================

// PseudonymGetError is sometimes written by unmarshaling (some fields of) a server response.
type KeyPseudonymGetError struct {
	msg string
}

func (e KeyPseudonymGetError) Error() string {
	if e.msg == "" {
		return "Pseudonym could not be resolved"
	}
	return e.msg
}

var _ error = (*KeyPseudonymGetError)(nil)

//=============================================================================

type PerUserKeyImportError struct {
	msg string
}

func (e PerUserKeyImportError) Error() string {
	return fmt.Sprintf("per-user-key import error: %s", e.msg)
}

func NewPerUserKeyImportError(format string, args ...interface{}) PerUserKeyImportError {
	return PerUserKeyImportError{
		msg: fmt.Sprintf(format, args...),
	}
}

//=============================================================================

type LoginOfflineError struct {
	msg string
}

func NewLoginOfflineError(msg string) LoginOfflineError {
	return LoginOfflineError{msg: msg}
}

func (e LoginOfflineError) Error() string {
	return "LoginOffline error: " + e.msg
}

//=============================================================================

type EldestSeqnoMissingError struct{}

func (e EldestSeqnoMissingError) Error() string {
	return "user's eldest seqno has not been loaded"
}

//=============================================================================

type AccountResetError struct {
	expected keybase1.UserVersion
	received keybase1.Seqno
}

func NewAccountResetError(uv keybase1.UserVersion, r keybase1.Seqno) AccountResetError {
	return AccountResetError{expected: uv, received: r}
}

func (e AccountResetError) Error() string {
	if e.received == keybase1.Seqno(0) {
		return fmt.Sprintf("Account reset, and not reestablished (for user %s)", e.expected.String())
	}
	return fmt.Sprintf("Account reset, reestablished at %d (for user %s)", e.received, e.expected.String())
}

type BadSessionError struct {
	Desc string
}

func (e BadSessionError) Error() string {
	return fmt.Sprintf("bad session: %s", e.Desc)
}

type LoginStateTimeoutError struct {
	ActiveRequest    string
	AttemptedRequest string
	Duration         time.Duration
}

func (e LoginStateTimeoutError) Error() string {
	return fmt.Sprintf("LoginState request timeout - attempted: %s, active request: %s, duration: %s", e.ActiveRequest, e.AttemptedRequest, e.Duration)
}

type KBFSNotRunningError struct{}

func (e KBFSNotRunningError) Error() string {
	const err string = "Keybase services aren't running - KBFS client not found."
	switch runtime.GOOS {
	case "linux":
		return fmt.Sprintf("%s On Linux you need to start them after an update with `run_keybase` command.", err)
	default:
		return err
	}
}

type RevokeCurrentDeviceError struct{}

func (e RevokeCurrentDeviceError) Error() string {
	return "cannot revoke the current device without confirmation"
}

type RevokeLastDeviceError struct{}

func (e RevokeLastDeviceError) Error() string {
	return "cannot revoke the last device in your account without confirmation"
}

// users with PGP keys who try to revoke last device get this:
type RevokeLastDevicePGPError struct{}

func (e RevokeLastDevicePGPError) Error() string {
	return "You cannot revoke the last device in your account. You can reset your account here: keybase.io/#account-reset"
}

//=============================================================================

type ImplicitTeamDisplayNameError struct {
	msg string
}

func (e ImplicitTeamDisplayNameError) Error() string {
	return fmt.Sprintf("Error parsing implicit team name: %s", e.msg)
}

func NewImplicitTeamDisplayNameError(format string, args ...interface{}) ImplicitTeamDisplayNameError {
	return ImplicitTeamDisplayNameError{fmt.Sprintf(format, args...)}
}

type TeamVisibilityError struct {
	wantedPublic bool
	gotPublic    bool
}

func (e TeamVisibilityError) Error() string {
	pps := func(public bool) string {
		if public {
			return "public"
		}
		return "private"
	}
	return fmt.Sprintf("loaded for %v team but got %v team", pps(e.wantedPublic), pps(e.gotPublic))
}

func NewTeamVisibilityError(wantedPublic, gotPublic bool) TeamVisibilityError {
	return TeamVisibilityError{wantedPublic: wantedPublic, gotPublic: gotPublic}
}

type KeyMaskNotFoundError struct {
	App keybase1.TeamApplication
	Gen keybase1.PerTeamKeyGeneration
}

func (e KeyMaskNotFoundError) Error() string {
	msg := fmt.Sprintf("You don't have access to %s for this team", e.App)
	if e.Gen != keybase1.PerTeamKeyGeneration(0) {
		msg += fmt.Sprintf(" (at generation %d)", int(e.Gen))
	}
	return msg
}

type ProvisionFailedOfflineError struct{}

func (e ProvisionFailedOfflineError) Error() string {
	return "Device provisioning failed because the device is offline"
}

//=============================================================================

func UserErrorFromStatus(s keybase1.StatusCode) error {
	switch s {
	case keybase1.StatusCode_SCOk:
		return nil
	case keybase1.StatusCode_SCDeleted:
		return UserDeletedError{}
	default:
		return &APIError{Code: int(s), Msg: "user status error"}
	}
}

//=============================================================================

// InvalidRepoNameError indicates that a repo name is invalid.
type InvalidRepoNameError struct {
	Name string
}

func (e InvalidRepoNameError) Error() string {
	return fmt.Sprintf("Invalid repo name %q", e.Name)
}

//=============================================================================

// RepoAlreadyCreatedError is returned when trying to create a repo
// that already exists.
type RepoAlreadyExistsError struct {
	DesiredName  string
	ExistingName string
	ExistingID   string
}

func (e RepoAlreadyExistsError) Error() string {
	return fmt.Sprintf(
		"A repo named %s (id=%s) already existed when trying to create "+
			"a repo named %s", e.ExistingName, e.ExistingID, e.DesiredName)
}

//=============================================================================

// RepoDoesntExistError is returned when trying to delete a repo that doesn't exist.
type RepoDoesntExistError struct {
	Name string
}

func (e RepoDoesntExistError) Error() string {
	return fmt.Sprintf("There is no repo named %q.", e.Name)
}

//=============================================================================

// NoOpError is returned when an RPC call is issued but it would
// result in no change, so the call is dropped.
type NoOpError struct {
	Desc string
}

func (e NoOpError) Error() string {
	return e.Desc
}

//=============================================================================

type NoSpaceOnDeviceError struct {
	Desc string
}

func (e NoSpaceOnDeviceError) Error() string {
	return e.Desc
}

//=============================================================================

type TeamInviteBadTokenError struct{}

func (e TeamInviteBadTokenError) Error() string {
	return "invalid team invite token"
}

//=============================================================================

type TeamWritePermDeniedError struct{}

func (e TeamWritePermDeniedError) Error() string {
	return "permission denied to modify team"
}

//=============================================================================

type TeamInviteTokenReusedError struct{}

func (e TeamInviteTokenReusedError) Error() string {
	return "team invite token already used"
}

//=============================================================================

type TeamBadMembershipError struct{}

func (e TeamBadMembershipError) Error() string {
	return "cannot perform operation because not a member of the team"
}

//=============================================================================

type TeamProvisionalError struct {
	CanKey                bool
	IsPublic              bool
	PreResolveDisplayName string
}

func (e TeamProvisionalError) Error() string {
	ret := "team is provisional"
	if e.CanKey {
		ret += ", but the user can key"
	} else {
		ret += ", and the user cannot key"
	}
	return ret
}

func NewTeamProvisionalError(canKey bool, isPublic bool, dn string) error {
	return TeamProvisionalError{canKey, isPublic, dn}
}

//=============================================================================

type NoActiveDeviceError struct{}

func (e NoActiveDeviceError) Error() string { return "no active device" }

//=============================================================================

type NoTriplesecError struct{}

func (e NoTriplesecError) Error() string { return "No Triplesec was available after prompt" }
func NewNoTriplesecError() error         { return NoTriplesecError{} }

//=============================================================================

type HexWrongLengthError struct{ msg string }

func NewHexWrongLengthError(msg string) HexWrongLengthError { return HexWrongLengthError{msg} }

func (e HexWrongLengthError) Error() string { return e.msg }

//=============================================================================

type EphemeralPairwiseMACsMissingUIDsError struct{ UIDs []keybase1.UID }

func NewEphemeralPairwiseMACsMissingUIDsError(uids []keybase1.UID) EphemeralPairwiseMACsMissingUIDsError {
	return EphemeralPairwiseMACsMissingUIDsError{
		UIDs: uids,
	}
}

func (e EphemeralPairwiseMACsMissingUIDsError) Error() string {
	return fmt.Sprintf("Missing %d uids from pairwise macs", len(e.UIDs))
}

//=============================================================================

type RecipientNotFoundError struct {
	error
}

func NewRecipientNotFoundError(message string) error {
	return RecipientNotFoundError{
		error: fmt.Errorf(message),
	}
}

//=============================================================================

type TeamFTLOutdatedError struct {
	msg string
}

func NewTeamFTLOutdatedError(s string) error {
	return TeamFTLOutdatedError{s}
}

func (t TeamFTLOutdatedError) Error() string {
	return fmt.Sprintf("FTL outdated: %s", t.msg)
}

var _ error = TeamFTLOutdatedError{}

//=============================================================================

type FeatureFlagError struct {
	msg     string
	feature Feature
}

func NewFeatureFlagError(s string, f Feature) error {
	return FeatureFlagError{s, f}
}

func (f FeatureFlagError) Feature() Feature {
	return f.feature
}

func (f FeatureFlagError) Error() string {
	return fmt.Sprintf("Feature %q flagged off: %s", f.feature, f.msg)
}

var _ error = FeatureFlagError{}

//=============================================================================

type UserReverifyNeededError struct {
	msg string
}

func NewUserReverifyNeededError(s string) error {
	return UserReverifyNeededError{s}
}

func (e UserReverifyNeededError) Error() string {
	return fmt.Sprintf("User green link error: %s", e.msg)
}

//=============================================================================

type OfflineError struct {
}

func NewOfflineError() error {
	return OfflineError{}
}

func (e OfflineError) Error() string {
	return "Offline, and no cached results found"
}

//=============================================================================

type VerboseError interface {
	Error() string
	Verbose() string
}

type InvalidStellarAccountIDError struct {
	details string
}

func NewInvalidStellarAccountIDError(details string) InvalidStellarAccountIDError {
	return InvalidStellarAccountIDError{
		details: details,
	}
}

func (e InvalidStellarAccountIDError) Error() string {
	return "Invalid Stellar address."
}

func (e InvalidStellarAccountIDError) Verbose() string {
	return fmt.Sprintf("Invalid Stellar address: %s", e.details)
}

//=============================================================================

type ResetWithActiveDeviceError struct {
}

func (e ResetWithActiveDeviceError) Error() string {
	return "You cannot reset your account from a logged-in device."
}

//=============================================================================

type ResetMissingParamsError struct {
	msg string
}

func NewResetMissingParamsError(msg string) error {
	return ResetMissingParamsError{msg: msg}
}

func (e ResetMissingParamsError) Error() string {
	return e.msg
}

//============================================================================

type ChainLinkBadUnstubError struct {
	msg string
}

func NewChainLinkBadUnstubError(s string) error {
	return ChainLinkBadUnstubError{s}
}

func (c ChainLinkBadUnstubError) Error() string {
	return c.msg
}

//============================================================================

// AppOutdatedError indicates that an operation failed because the client does
// not support some necessary feature and needs to be updated.
type AppOutdatedError struct {
	cause error
}

func NewAppOutdatedError(cause error) AppOutdatedError {
	return AppOutdatedError{cause: cause}
}

func (e AppOutdatedError) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("AppOutdatedError: %v", e.cause.Error())
	}
	return fmt.Sprintf("AppOutdatedError")
}

//============================================================================

type PushSecretWithoutPasswordError struct {
	msg string
}

func NewPushSecretWithoutPasswordError(msg string) error {
	return PushSecretWithoutPasswordError{msg: msg}
}

func (e PushSecretWithoutPasswordError) Error() string {
	return e.msg
}

// HumanErrorer is an interface that errors can implement if they want to expose what went wrong to
// humans, either via the CLI or via the electron interface. It sometimes happens that errors get
// wrapped inside of other errors up a stack, and it's hard to know what to show the user.
// This can help.
type HumanErrorer interface {
	HumanError() error
}

// HumanError takes an error and returns the topmost human error that's in the error, maybe to export
// to the CLI, KBFS, or Electron. It's a mashup of the pkg/errors Error() function, and also our
// own desire to return the topmost HumanError.
//
// See https://github.com/pkg/errors/blob/master/errors.go for the original pkg/errors code
func HumanError(err error) error {
	type causer interface {
		Cause() error
	}

	for err != nil {
		humanErrorer, ok := err.(HumanErrorer)
		if ok {
			tmp := humanErrorer.HumanError()
			if tmp != nil {
				return tmp
			}
		}
		cause, ok := err.(causer)
		if !ok {
			break
		}
		err = cause.Cause()
	}
	return err
}

//============================================================================

type TeamContactSettingsBlockError struct {
	blockedUIDs      []keybase1.UID
	blockedUsernames []NormalizedUsername
}

func (e TeamContactSettingsBlockError) BlockedUIDs() []keybase1.UID {
	return e.blockedUIDs
}

func (e TeamContactSettingsBlockError) BlockedUsernames() []NormalizedUsername {
	return e.blockedUsernames
}

func (e TeamContactSettingsBlockError) Error() string {
	var tmp []string
	for _, u := range e.blockedUsernames {
		tmp = append(tmp, u.String())
	}
	return fmt.Sprintf("some users couldn't be contacted due to privacy settings (%s)", strings.Join(tmp, ","))
}
