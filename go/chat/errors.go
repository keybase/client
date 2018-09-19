package chat

import (
	"errors"
	"fmt"
	"net"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

var ErrChatServerTimeout = errors.New("timeout calling chat server")
var ErrDuplicateConnection = errors.New("error calling chat server")
var ErrKeyServerTimeout = errors.New("timeout calling into key server")

type InternalError interface {
	// verbose error info for debugging but not user display
	InternalError() string
}

type UnboxingError interface {
	InternalError
	Error() string
	Inner() error
	IsPermanent() bool
	ExportType() chat1.MessageUnboxedErrorType
	VersionKind() chat1.VersionKind
	VersionNumber() int
	IsCritical() bool
}

var _ error = (UnboxingError)(nil)

func NewPermanentUnboxingError(inner error) UnboxingError {
	return PermanentUnboxingError{inner}
}

type PermanentUnboxingError struct{ inner error }

func (e PermanentUnboxingError) Error() string {
	return fmt.Sprintf("error unboxing chat message: %s", e.inner.Error())
}

func (e PermanentUnboxingError) IsPermanent() bool { return true }

func (e PermanentUnboxingError) Inner() error { return e.inner }

func (e PermanentUnboxingError) ExportType() chat1.MessageUnboxedErrorType {
	switch err := e.inner.(type) {
	case VersionError:
		return err.ExportType()
	case EphemeralUnboxingError:
		return chat1.MessageUnboxedErrorType_EPHEMERAL
	case NotAuthenticatedForThisDeviceError:
		return chat1.MessageUnboxedErrorType_PAIRWISE_MISSING
	default:
		return chat1.MessageUnboxedErrorType_MISC
	}
}

func (e PermanentUnboxingError) VersionKind() chat1.VersionKind {
	switch err := e.inner.(type) {
	case VersionError:
		return err.VersionKind()
	default:
		return ""
	}
}

func (e PermanentUnboxingError) VersionNumber() int {
	switch err := e.inner.(type) {
	case VersionError:
		return err.VersionNumber()
	default:
		return 0
	}
}

func (e PermanentUnboxingError) IsCritical() bool {
	switch err := e.inner.(type) {
	case VersionError:
		return err.IsCritical()
	default:
		return false
	}
}

func (e PermanentUnboxingError) InternalError() string {
	switch err := e.Inner().(type) {
	case InternalError:
		return err.InternalError()
	default:
		return err.Error()
	}
}

//=============================================================================

func NewTransientUnboxingError(inner error) UnboxingError {
	return TransientUnboxingError{inner}
}

type TransientUnboxingError struct{ inner error }

func (e TransientUnboxingError) Error() string {
	return fmt.Sprintf("error unboxing chat message (transient): %s", e.inner.Error())
}

func (e TransientUnboxingError) IsPermanent() bool { return false }

func (e TransientUnboxingError) Inner() error { return e.inner }

func (e TransientUnboxingError) ExportType() chat1.MessageUnboxedErrorType {
	return chat1.MessageUnboxedErrorType_MISC
}

func (e TransientUnboxingError) VersionKind() chat1.VersionKind {
	return ""
}

func (e TransientUnboxingError) VersionNumber() int {
	return 0
}

func (e TransientUnboxingError) IsCritical() bool {
	return false
}

func (e TransientUnboxingError) InternalError() string {
	switch err := e.Inner().(type) {
	case InternalError:
		return err.InternalError()
	default:
		return err.Error()
	}
}

//=============================================================================

type EphemeralAlreadyExpiredError struct{ inner error }

func NewEphemeralAlreadyExpiredError() EphemeralAlreadyExpiredError {
	return EphemeralAlreadyExpiredError{}
}

func (e EphemeralAlreadyExpiredError) Error() string {
	return "Unable to decrypt already exploded message"
}

func (e EphemeralAlreadyExpiredError) InternalError() string {
	return e.Error()
}

//=============================================================================

type EphemeralUnboxingError struct{ inner error }

func NewEphemeralUnboxingError(inner error) EphemeralUnboxingError {
	return EphemeralUnboxingError{inner}
}

func (e EphemeralUnboxingError) Error() string {
	return "Unable to decrypt exploding message. Missing keys"
}

func (e EphemeralUnboxingError) InternalError() string {
	return e.inner.Error()
}

//=============================================================================

type PublicTeamEphemeralKeyError struct{}

func NewPublicTeamEphemeralKeyError() PublicTeamEphemeralKeyError {
	return PublicTeamEphemeralKeyError{}
}

func (e PublicTeamEphemeralKeyError) Error() string {
	return "Cannot use ephemeral messages for a public team."
}

//=============================================================================

type NotAuthenticatedForThisDeviceError struct{}

func NewNotAuthenticatedForThisDeviceError() NotAuthenticatedForThisDeviceError {
	return NotAuthenticatedForThisDeviceError{}
}

func (e NotAuthenticatedForThisDeviceError) Error() string {
	return "this message is not authenticated for this device"
}

//=============================================================================

type InvalidMACError struct{}

func NewInvalidMACError() InvalidMACError {
	return InvalidMACError{}
}

func (e InvalidMACError) Error() string {
	return "invalid MAC"
}

//=============================================================================

type ConsistencyErrorCode int

const (
	DuplicateID ConsistencyErrorCode = iota
	OutOfOrderID
	InconsistentHash
	IncorrectHash
)

type ChatThreadConsistencyError interface {
	error
	Code() ConsistencyErrorCode
}

type chatThreadConsistencyErrorImpl struct {
	msg  string
	code ConsistencyErrorCode
}

func (e chatThreadConsistencyErrorImpl) Error() string {
	return e.msg
}

func (e chatThreadConsistencyErrorImpl) Code() ConsistencyErrorCode {
	return e.code
}

func NewChatThreadConsistencyError(code ConsistencyErrorCode, msg string, formatArgs ...interface{}) ChatThreadConsistencyError {
	return &chatThreadConsistencyErrorImpl{
		code: code,
		msg:  fmt.Sprintf(msg, formatArgs...),
	}
}

//=============================================================================

type BoxingError struct {
	Msg  string
	Perm bool
}

func NewBoxingError(msg string, perm bool) BoxingError {
	return BoxingError{
		Msg:  msg,
		Perm: perm,
	}
}

func (e BoxingError) Error() string {
	return fmt.Sprintf("boxing error: %s perm: %v", e.Msg, e.Perm)
}

func (e BoxingError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	if e.Perm {
		return chat1.OutboxErrorType_MISC, true
	}
	return 0, false
}

//=============================================================================

type BoxingCryptKeysError struct {
	Err error
}

func NewBoxingCryptKeysError(err error) BoxingCryptKeysError {
	return BoxingCryptKeysError{
		Err: err,
	}
}

func (e BoxingCryptKeysError) Error() string {
	return fmt.Sprintf("boxing error: unable to get crypt keys: %s", e.Err.Error())
}

func (e BoxingCryptKeysError) Inner() error {
	return e.Err
}

func (e BoxingCryptKeysError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	if _, ok := e.Err.(libkb.IdentifySummaryError); ok {
		return chat1.OutboxErrorType_IDENTIFY, true
	}
	return 0, false
}

//=============================================================================

type BodyHashInvalid struct{}

func (e BodyHashInvalid) Error() string {
	return "chat body hash invalid"
}

type VersionError struct {
	Kind     string
	Version  int
	Critical bool
}

func (e VersionError) Error() string {
	return fmt.Sprintf("Unable to decrypt because current client is out of date. Please update your version of Keybase! Chat version error: [ unhandled: %s version: %d critical: %v ]", e.Kind, e.Version, e.Critical)
}

func (e VersionError) ExportType() chat1.MessageUnboxedErrorType {
	if e.Critical {
		return chat1.MessageUnboxedErrorType_BADVERSION_CRITICAL
	}
	return chat1.MessageUnboxedErrorType_BADVERSION
}

func (e VersionError) VersionKind() chat1.VersionKind {
	return chat1.VersionKind(e.Kind)
}

func (e VersionError) VersionNumber() int {
	return e.Version
}

func (e VersionError) IsCritical() bool {
	return e.Critical
}

func NewMessageBoxedVersionError(version chat1.MessageBoxedVersion) VersionError {
	return VersionError{
		Kind:     string(chat1.VersionErrorMessageBoxed),
		Version:  int(version),
		Critical: true,
	}
}

func NewHeaderVersionError(version chat1.HeaderPlaintextVersion,
	defaultHeader chat1.HeaderPlaintextUnsupported) VersionError {
	return VersionError{
		Kind:     string(chat1.VersionErrorHeader),
		Version:  int(version),
		Critical: defaultHeader.Mi.Crit,
	}
}

func NewBodyVersionError(version chat1.BodyPlaintextVersion, defaultBody chat1.BodyPlaintextUnsupported) VersionError {
	return VersionError{
		Kind:     string(chat1.VersionErrorBody),
		Version:  int(version),
		Critical: defaultBody.Mi.Crit,
	}
}

//=============================================================================

type HeaderMismatchError struct {
	Field string
}

var _ error = (*HeaderMismatchError)(nil)

func (e HeaderMismatchError) Error() string {
	return fmt.Sprintf("chat header mismatch on %q", e.Field)
}

func NewHeaderMismatchError(field string) HeaderMismatchError {
	return HeaderMismatchError{Field: field}
}

//=============================================================================

type OfflineError struct {
}

func (e OfflineError) Error() string {
	return "operation failed: no connection to chat server"
}

type OfflineClient struct {
}

func (e OfflineClient) Call(ctx context.Context, method string, arg interface{}, res interface{}) error {
	return OfflineError{}
}

func (e OfflineClient) Notify(ctx context.Context, method string, arg interface{}) error {
	return OfflineError{}
}

//=============================================================================

type DuplicateTopicNameError struct {
	TopicName string
}

func (e DuplicateTopicNameError) Error() string {
	return fmt.Sprintf("channel name %s is already in use", e.TopicName)
}

//=============================================================================

type ImpteamUpgradeBadteamError struct {
	Msg string
}

func (e ImpteamUpgradeBadteamError) Error() string {
	return fmt.Sprintf("bad iteam found in upgraded conv: %s", e.Msg)
}

//=============================================================================

type UnknownTLFNameError struct {
	tlfName string
}

func NewUnknownTLFNameError(name string) UnknownTLFNameError {
	return UnknownTLFNameError{
		tlfName: name,
	}
}

func (e UnknownTLFNameError) Error() string {
	return fmt.Sprintf("unknown conversation name: %s", e.tlfName)
}

//=============================================================================

type AttachmentUploadError struct {
	Msg string
}

func NewAttachmentUploadError(msg string) AttachmentUploadError {
	return AttachmentUploadError{
		Msg: msg,
	}
}

func (e AttachmentUploadError) Error() string {
	return fmt.Sprintf("attachment failed to upload; %s", e.Msg)
}

//=============================================================================

type SenderTestImmediateFailError struct {
}

func (e SenderTestImmediateFailError) Error() string {
	return "sender test immediate fail error"
}

func (e SenderTestImmediateFailError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

//=============================================================================

type DecryptionKeyNotFoundError struct {
	generation            int
	kbfsEncrypted, public bool
}

func NewDecryptionKeyNotFoundError(generation int, public, kbfsEncrypted bool) DecryptionKeyNotFoundError {
	return DecryptionKeyNotFoundError{
		generation:    generation,
		kbfsEncrypted: kbfsEncrypted,
		public:        public,
	}
}

func (e DecryptionKeyNotFoundError) Error() string {
	return fmt.Sprintf("decryption key not found for generation: %v kbfsEncrypted: %v public: %v",
		e.generation, e.kbfsEncrypted, e.public)
}

//=============================================================================

type OfflineErrorKind int

const (
	OfflineErrorKindOnline OfflineErrorKind = iota
	OfflineErrorKindOfflineBasic
	OfflineErrorKindOfflineReconnect
)

func IsOfflineError(err error) OfflineErrorKind {
	// Check type
	switch terr := err.(type) {
	case net.Error:
		return OfflineErrorKindOfflineReconnect
	case libkb.APINetError:
		return OfflineErrorKindOfflineBasic
	case OfflineError:
		return OfflineErrorKindOfflineBasic
	case TransientUnboxingError:
		return IsOfflineError(terr.Inner())
	}
	// Check error itself
	switch err {
	case context.DeadlineExceeded:
		fallthrough
	case context.Canceled:
		fallthrough
	case ErrChatServerTimeout:
		return OfflineErrorKindOfflineReconnect
	case ErrDuplicateConnection:
		return OfflineErrorKindOfflineBasic
	}
	return OfflineErrorKindOnline
}

//=============================================================================

type FTLError struct {
	msg string
}

func NewFTLError(s string) error {
	return &FTLError{msg: s}
}

func (f FTLError) Error() string {
	return fmt.Sprintf("FTL Error: %s", f.msg)
}
