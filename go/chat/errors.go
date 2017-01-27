package chat

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type UnboxingError interface {
	Error() string
	Inner() error
	IsPermanent() bool
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

func NewTransientUnboxingError(inner error) UnboxingError {
	return &TransientUnboxingError{
		inner:         inner,
		needRekey:     false,
		needRekeySelf: false,
	}
}

func NewTransientUnboxingNeedRekey(inner error, self bool) UnboxingError {
	return &TransientUnboxingError{
		inner:         inner,
		needRekey:     true,
		needRekeySelf: self,
	}
}

type TransientUnboxingError struct {
	inner         error
	needRekey     bool
	needRekeySelf bool
}

func (e TransientUnboxingError) Error() string {
	return fmt.Sprintf("error unboxing chat message: %s", e.inner.Error())
}

func (e TransientUnboxingError) IsPermanent() bool { return false }

func (e TransientUnboxingError) Inner() error { return e.inner }

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
	Kind    string
	Version int
}

func (e VersionError) Error() string {
	return fmt.Sprintf("chat version error: unhandled %s version %d", e.Kind, e.Version)
}

func NewHeaderVersionError(version chat1.HeaderPlaintextVersion) VersionError {
	return VersionError{
		Kind:    "header",
		Version: int(version),
	}
}

func NewBodyVersionError(version chat1.BodyPlaintextVersion) VersionError {
	return VersionError{
		Kind:    "body",
		Version: int(version),
	}
}
