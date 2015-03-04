package libkb

import (
	"errors"
	"fmt"
	"strings"

	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
//

type ProofError interface {
	error
	GetStatus() ProofStatus
	GetDesc() string
}

func ProofErrorIsSoft(pe ProofError) bool {
	s := int(pe.GetStatus())
	return s >= PROOF_BASE_ERROR && s < PROOF_BASE_HARD_ERROR
}

func ProofErrorToState(pe ProofError) int {
	if pe == nil {
		return PROOF_STATE_OK
	} else if s := pe.GetStatus(); s == PROOF_NO_HINT || s == PROOF_UNKNOWN_TYPE {
		return PROOF_STATE_NONE
	} else {
		return PROOF_STATE_TEMP_FAILURE
	}
}

type ProofErrorImpl struct {
	Status ProofStatus
	Desc   string
}

func NewProofError(s ProofStatus, d string, a ...interface{}) *ProofErrorImpl {
	return &ProofErrorImpl{s, fmt.Sprintf(d, a...)}
}

func (e *ProofErrorImpl) Error() string {
	return fmt.Sprintf("%s (code=%d)", e.Desc, int(e.Status))
}

func (e *ProofErrorImpl) GetStatus() ProofStatus { return e.Status }
func (e *ProofErrorImpl) GetDesc() string        { return e.Desc }

type ProofApiError struct {
	ProofErrorImpl
	url string
}

// Might be overkill, let's revisit...
//func (e *ProofApiError) Error() string {
//	return fmt.Sprintf("%s (url=%s; code=%d)", e.Desc, e.url, int(e.Status))
//}

func NewProofApiError(s ProofStatus, u string, d string, a ...interface{}) *ProofApiError {
	base := NewProofError(s, d, a...)
	return &ProofApiError{*base, u}
}

//=============================================================================

func XapiError(err error, u string) *ProofApiError {
	if ae, ok := err.(*ApiError); ok {
		var code ProofStatus = PROOF_NONE
		switch ae.Code / 100 {
		case 3:
			code = PROOF_HTTP_300
		case 4:
			code = PROOF_HTTP_400
		case 5:
			code = PROOF_HTTP_500
		default:
			code = PROOF_HTTP_OTHER
		}
		return NewProofApiError(code, u, ae.Msg)
	} else {
		return NewProofApiError(PROOF_INTERNAL_ERROR, u, err.Error())
	}
}

//=============================================================================

type FailedAssertionError struct {
	user string
	bad  []AssertionUrl
}

func (u FailedAssertionError) Error() string {
	v := make([]string, len(u.bad), len(u.bad))
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
	wanted, got KID
}

func (w WrongKidError) Error() string {
	return fmt.Sprintf("Wanted KID=%s; but got KID=%s", w.wanted, w.got)
}

//=============================================================================

type WrongKeyError struct {
	wanted, got *PgpFingerprint
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
	uid UID
	msg string
}

func (u UserNotFoundError) Error() string {
	return fmt.Sprintf("User %s wasn't found (%s)", u.uid, u.msg)
}

//=============================================================================

type AlreadyRegisteredError struct {
	Uid UID
}

func (u AlreadyRegisteredError) Error() string {
	return fmt.Sprintf("Already registered (with uid=%s)", u.Uid)
}

//=============================================================================

type WrongSigError struct {
	b string
}

func (e WrongSigError) Error() string {
	return "Found wrong signature: " + e.b
}

type BadSigError struct {
	e string
}

func (e BadSigError) Error() string {
	return e.e
}

//=============================================================================

type NotFoundError struct {
	msg string
}

func (e NotFoundError) Error() string {
	return e.msg
}

//=============================================================================

type NoKeyError struct {
	msg string
}

func (u NoKeyError) Error() string {
	if len(u.msg) > 0 {
		return u.msg
	} else {
		return "No public key found"
	}
}

type NoEldestKeyError struct {
}

func (e NoEldestKeyError) Error() string {
	return "No Eldest key found"
}

//=============================================================================

type NoSecretKeyError struct {
}

func (u NoSecretKeyError) Error() string {
	return "No secret key available"
}

//=============================================================================

type TooManyKeysError struct {
	n  int
	fp PgpFingerprint
}

func (e TooManyKeysError) Error() string {
	return fmt.Sprintf("Too many keys (%d) found for %s", e.n, e.fp)
}

//=============================================================================

type NoSelectedKeyError struct {
	wanted *PgpFingerprint
}

func (n NoSelectedKeyError) Error() string {
	return "Please login again to verify your public key"
}

//=============================================================================

type KeyExistsError struct {
	Key *PgpFingerprint
}

func (k KeyExistsError) Error() string {
	ret := "Key already exists for user"
	if k.Key != nil {
		fmt.Sprintf("%s (%s)", ret, k.Key)
	}
	return ret
}

//=============================================================================

type PassphraseError struct {
	msg string
}

func (p PassphraseError) Error() string {
	msg := "Bad passphrase"
	if len(p.msg) != 0 {
		msg = msg + ": " + p.msg
	}
	return msg
}

//=============================================================================

type BadKeyError struct {
	Msg string
}

func (p BadKeyError) Error() string {
	msg := "Bad key found"
	if len(p.Msg) != 0 {
		msg = msg + ": " + p.Msg
	}
	return msg
}

//=============================================================================

type BadFingerprintError struct {
	fp1, fp2 PgpFingerprint
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

func (a AppStatusError) IsBadField(s string) bool {
	_, found := a.Fields[s]
	return found
}

func NewAppStatusError(jw *jsonw.Wrapper) AppStatusError {
	code, _ := jw.AtKey("code").GetInt64()
	desc, _ := jw.AtKey("desc").GetString()
	name, _ := jw.AtKey("name").GetString()
	tab := make(map[string]string)
	fields := jw.AtKey("fields")
	if keys, _ := fields.Keys(); keys != nil && len(keys) > 0 {
		for _, k := range keys {
			tab[k], _ = fields.AtKey(k).GetString()
		}
	}
	return AppStatusError{
		Code:   int(code),
		Name:   name,
		Desc:   desc,
		Fields: tab,
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

	return fmt.Sprintf("Failure from server: %s%s (error %d)", a.Desc, fields, a.Code)
}

//=============================================================================

type GpgError struct {
	m string
}

func (e GpgError) Error() string {
	return fmt.Sprintf("GPG error: %s", e.m)
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

//=============================================================================

type LoginRequiredError struct {
}

func (e LoginRequiredError) Error() string {
	return "Login required"
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

//=============================================================================

type InvalidHostnameError struct {
	h string
}

func (e InvalidHostnameError) Error() string {
	return "Invalid hostname: " + e.h
}

//=============================================================================

type WebUnreachableError struct {
	h string
}

func (h WebUnreachableError) Error() string {
	return "Host " + h.h + " is down; tried both HTTPS and HTTP protocols"
}

//=============================================================================

type ProtocolDowngradeError struct {
	msg string
}

func (h ProtocolDowngradeError) Error() string {
	return h.msg
}

//=============================================================================

type BadUsernameError struct {
	n string
}

func (e BadUsernameError) Error() string {
	return "Bad username: '" + e.n + "'"
}

//=============================================================================

type NoUsernameError struct{}

func (e NoUsernameError) Error() string {
	return "No username known"
}

//=============================================================================

type UnmarshalError struct {
	t string
}

func (u UnmarshalError) Error() string {
	return "Bad " + u.t + " packet"
}

type VerificationError struct{}

func (v VerificationError) Error() string {
	return "Verification failed"
}

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

//=============================================================================

type NoConfigFile struct{}

func (n NoConfigFile) Error() string {
	return "No configuration file available"
}

//=============================================================================

type SelfTrackError struct{}

func (e SelfTrackError) Error() string {
	return "Cannot track yourself"
}

//=============================================================================

type NoUiError struct {
	which string
}

func (e NoUiError) Error() string {
	return fmt.Sprintf("no %s-UI was available", e.which)
}

//=============================================================================

type NoConfigWriterError struct{}

func (e NoConfigWriterError) Error() string {
	return "Can't write; no ConfigWriter available"
}

//=============================================================================

type BadServiceError struct {
	n string
}

func (e BadServiceError) Error() string {
	return e.n + ": unsupported service"
}

//=============================================================================

type NotConfirmedError struct{}

func (e NotConfirmedError) Error() string {
	return "Not confirmed"
}

//=============================================================================

type ProofNotYetAvailableError struct{}

func (e ProofNotYetAvailableError) Error() string {
	return "Proof wasn't available; we'll keep trying"
}

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

type UidMismatchError struct {
	Msg string
}

func (u UidMismatchError) Error() string {
	return fmt.Sprintf("UID mismatch error: %s", u.Msg)
}

//=============================================================================

type KeyRevokedError struct {
	msg string
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
	typ int
}

func (e UnknownKeyTypeError) Error() string {
	return fmt.Sprintf("Unknown key type: %d", e.typ)
}

//=============================================================================

type LoadUserError struct {
	msg string
}

func (e LoadUserError) Error() string {
	return fmt.Sprintf("LoadUser error: %s", e.msg)
}

type ChainLinkError struct {
	msg string
}

func (c ChainLinkError) Error() string {
	return fmt.Sprintf("Error in parsing chain Link: %s", c.msg)
}

//=============================================================================

type ReverseSigError struct {
	msg string
}

func (r ReverseSigError) Error() string {
	return fmt.Sprintf("Error in reverse signature: %s", r.msg)
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
	kid KID
}

func (i InactiveKeyError) Error() string {
	return fmt.Sprintf("The key '%s' is not active", i.kid)
}

//=============================================================================

type MerkleClientError struct {
	m string
}

func (m MerkleClientError) Error() string {
	return fmt.Sprintf("Error checking merkle tree: %s", m.m)
}

type MerkleNotFoundError struct {
	k   string
	msg string
}

func (m MerkleNotFoundError) Error() string {
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
	m string
}

func (c CanceledError) Error() string {
	return c.m
}

//=============================================================================

var ErrNoDevice = errors.New("No device found")
var ErrTimeout = errors.New("Operation timed out")
var ErrNilUser = errors.New("User is nil")
var ErrReceiverDevice = errors.New("Device ID mismatch in message receiver")
var ErrInvalidKexSession = errors.New("Invalid kex session ID")
