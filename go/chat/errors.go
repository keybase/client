package chat

import (
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

var ErrChatServerTimeout = errors.New("timeout calling chat server")
var ErrDuplicateConnection = errors.New("error calling chat server")
var ErrKeyServerTimeout = errors.New("timeout calling into key server")

func NewPermanentUnboxingError(inner error) types.UnboxingError {
	return PermanentUnboxingError{inner}
}

type PermanentUnboxingError struct{ inner error }

func (e PermanentUnboxingError) Error() string {
	switch err := e.inner.(type) {
	case EphemeralUnboxingError, NotAuthenticatedForThisDeviceError:
		return err.Error()
	default:
		return fmt.Sprintf("Unable to decrypt chat message: %s", err.Error())
	}
}

func (e PermanentUnboxingError) IsPermanent() bool { return true }

func (e PermanentUnboxingError) Inner() error { return e.inner }

func (e PermanentUnboxingError) ExportType() chat1.MessageUnboxedErrorType {
	switch err := e.inner.(type) {
	case VersionError:
		return err.ExportType()
	case EphemeralUnboxingError:
		return chat1.MessageUnboxedErrorType_EPHEMERAL
	case NotAuthenticatedForThisDeviceError, InvalidMACError:
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
	case types.InternalError:
		return err.InternalError()
	default:
		return err.Error()
	}
}

func (e PermanentUnboxingError) ToStatus() (status keybase1.Status) {
	if ee, ok := e.inner.(libkb.ExportableError); ok {
		status = ee.ToStatus()
		status.Desc = e.Error()
	} else {
		status = keybase1.Status{
			Name: "GENERIC",
			Code: libkb.SCGeneric,
			Desc: e.Error(),
		}
	}
	return status
}

//=============================================================================

func NewTransientUnboxingError(inner error) types.UnboxingError {
	return TransientUnboxingError{inner}
}

type TransientUnboxingError struct{ inner error }

func (e TransientUnboxingError) Error() string {
	return fmt.Sprintf("Unable to decrypt chat message (transient): %s", e.inner.Error())
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
	case types.InternalError:
		return err.InternalError()
	default:
		return err.Error()
	}
}

func (e TransientUnboxingError) ToStatus() (status keybase1.Status) {
	if ee, ok := e.inner.(libkb.ExportableError); ok {
		status = ee.ToStatus()
		status.Desc = e.Error()
	} else {
		status = keybase1.Status{
			Name: "GENERIC",
			Code: libkb.SCGeneric,
			Desc: e.Error(),
		}
	}
	return status
}

//=============================================================================

type EphemeralAlreadyExpiredError struct{}

func NewEphemeralAlreadyExpiredError() EphemeralAlreadyExpiredError {
	return EphemeralAlreadyExpiredError{}
}

func (e EphemeralAlreadyExpiredError) Error() string {
	return "Exploding message is expired"
}

func (e EphemeralAlreadyExpiredError) InternalError() string {
	return e.Error()
}

//=============================================================================

type EphemeralUnboxingError struct {
	inner ephemeral.EphemeralKeyError
}

func NewEphemeralUnboxingError(inner ephemeral.EphemeralKeyError) EphemeralUnboxingError {
	return EphemeralUnboxingError{inner}
}

func (e EphemeralUnboxingError) Error() string {
	return e.inner.HumanError()
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
	return "Cannot use exploding messages for a public team."
}

//=============================================================================

type NotAuthenticatedForThisDeviceError struct{ inner ephemeral.EphemeralKeyError }

func NewNotAuthenticatedForThisDeviceError(mctx libkb.MetaContext, tlfID chat1.TLFID,
	contentCtime gregor1.Time) NotAuthenticatedForThisDeviceError {
	inner := ephemeral.NewNotAuthenticatedForThisDeviceError(mctx, tlfID, contentCtime)
	return NotAuthenticatedForThisDeviceError{inner: inner}
}

func (e NotAuthenticatedForThisDeviceError) Error() string {
	return e.inner.HumanError()
}

func (e NotAuthenticatedForThisDeviceError) InternalError() string {
	return e.inner.Error()
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
	return fmt.Sprintf("encryption error: %s perm: %v", e.Msg, e.Perm)
}

func (e BoxingError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	if e.Perm {
		return chat1.OutboxErrorType_MISC, true
	}
	return 0, false
}

//=============================================================================

type RestrictedBotChannelError struct{}

func NewRestrictedBotChannelError() RestrictedBotChannelError {
	return RestrictedBotChannelError{}
}

func (e RestrictedBotChannelError) Error() string {
	return "bot restricted from sending to this channel"
}

func (e RestrictedBotChannelError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_RESTRICTEDBOT, true
}

//=============================================================================

type BoxingCryptKeysError struct {
	Err error
}

// Cause implements the pkg/errors Cause() method, also cloned in libkb via HumanError,
// so that we know which error to show to the human being using keybase (rather than
// for our own internal uses).
func (e BoxingCryptKeysError) Cause() error {
	return e.Err
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

func (e OfflineClient) Call(ctx context.Context, method string, arg interface{},
	res interface{}, timeout time.Duration) error {
	return OfflineError{}
}

func (e OfflineClient) CallCompressed(ctx context.Context, method string, arg interface{},
	res interface{}, ctype rpc.CompressionType, timeout time.Duration) error {
	return OfflineError{}
}

func (e OfflineClient) Notify(ctx context.Context, method string, arg interface{}, timeout time.Duration) error {
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

type ImpteamBadteamError struct {
	Msg string
}

func (e ImpteamBadteamError) Error() string {
	return fmt.Sprintf("bad iteam found in conv: %s", e.Msg)
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
	Msg  string
	Perm bool
}

func NewAttachmentUploadError(msg string, perm bool) AttachmentUploadError {
	return AttachmentUploadError{
		Msg:  msg,
		Perm: perm,
	}
}

func (e AttachmentUploadError) Error() string {
	return fmt.Sprintf("attachment failed to upload; %s", e.Msg)
}

func (e AttachmentUploadError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, e.Perm
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
	case ErrChatServerTimeout:
		return OfflineErrorKindOfflineReconnect
	case ErrDuplicateConnection:
		return OfflineErrorKindOfflineBasic
	}

	// Unfortunately, Go throws these without a type and they can occasionally
	// propagate up. The strings were copied from
	// https://golang.org/src/crypto/tls/conn.go
	switch err.Error() {
	case "tls: use of closed connection",
		"tls: protocol is shutdown":
		return OfflineErrorKindOfflineReconnect
	}
	return OfflineErrorKindOnline
}

func IsRekeyError(err error) (typ chat1.ConversationErrorType, ok bool) {
	switch err := err.(type) {
	case types.UnboxingError:
		return IsRekeyError(err.Inner())
	case libkb.NeedSelfRekeyError:
		return chat1.ConversationErrorType_SELFREKEYNEEDED, true
	case libkb.NeedOtherRekeyError:
		return chat1.ConversationErrorType_OTHERREKEYNEEDED, true
	default:
		if teams.IsTeamReadError(err) {
			return chat1.ConversationErrorType_OTHERREKEYNEEDED, true
		}
	}
	return chat1.ConversationErrorType_NONE, false
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
