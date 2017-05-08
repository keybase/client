package chat

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

var ErrChatServerTimeout = errors.New("timeout calling chat server")

type UnboxingError interface {
	Error() string
	Inner() error
	IsPermanent() bool
	ExportType() chat1.MessageUnboxedErrorType
}

var _ error = (UnboxingError)(nil)

func NewPermanentUnboxingError(inner error) UnboxingError {
	return &PermanentUnboxingError{inner}
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
	default:
		return chat1.MessageUnboxedErrorType_MISC
	}
}

func NewTransientUnboxingError(inner error) UnboxingError {
	return &TransientUnboxingError{inner}
}

type TransientUnboxingError struct{ inner error }

func (e TransientUnboxingError) Error() string {
	return fmt.Sprintf("error unboxing chat message: %s", e.inner.Error())
}

func (e TransientUnboxingError) IsPermanent() bool { return false }

func (e TransientUnboxingError) Inner() error { return e.inner }

func (e TransientUnboxingError) ExportType() chat1.MessageUnboxedErrorType {
	return chat1.MessageUnboxedErrorType_MISC
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
	return fmt.Sprintf("chat version error: unhandled %s version %d critical: %v", e.Kind, e.Version,
		e.Critical)
}

func (e VersionError) ExportType() chat1.MessageUnboxedErrorType {
	if e.Critical {
		return chat1.MessageUnboxedErrorType_BADVERSION_CRITICAL
	}
	return chat1.MessageUnboxedErrorType_BADVERSION
}

func NewMessageBoxedVersionError(version chat1.MessageBoxedVersion) VersionError {
	return VersionError{
		Kind:     "messageboxed",
		Version:  int(version),
		Critical: true,
	}
}

func NewHeaderVersionError(version chat1.HeaderPlaintextVersion,
	defaultHeader chat1.HeaderPlaintextUnsupported) VersionError {
	return VersionError{
		Kind:     "header",
		Version:  int(version),
		Critical: defaultHeader.Mi.Crit,
	}
}

func NewBodyVersionError(version chat1.BodyPlaintextVersion, defaultBody chat1.BodyPlaintextUnsupported) VersionError {
	return VersionError{
		Kind:     "body",
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
