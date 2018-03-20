package storage

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
)

type Error interface {
	error
	ShouldClear() bool
	Message() string
}

type InternalError struct {
	Msg string
}

func (e InternalError) ShouldClear() bool {
	return true
}

func (e InternalError) Error() string {
	return fmt.Sprintf("internal chat storage error: %s", e.Msg)
}

func (e InternalError) Message() string {
	return e.Msg
}

func NewInternalError(ctx context.Context, d utils.DebugLabeler, msg string, args ...interface{}) InternalError {
	d.Debug(ctx, "internal chat storage error: "+msg, args...)
	return InternalError{Msg: fmt.Sprintf(msg, args...)}
}

type MissError struct {
	Msg string
}

func (e MissError) Error() string {
	if len(e.Msg) > 0 {
		return "chat cache miss: " + e.Msg
	}
	return "chat cache miss"
}

func (e MissError) ShouldClear() bool {
	return false
}

func (e MissError) Message() string {
	return e.Error()
}

type RemoteError struct {
	Msg string
}

func (e RemoteError) Error() string {
	return fmt.Sprintf("chat remote error: %s", e.Msg)
}

func (e RemoteError) ShouldClear() bool {
	return false
}

func (e RemoteError) Message() string {
	return e.Msg
}

type MiscError struct {
	Msg string
}

func (e MiscError) Error() string {
	return e.Msg
}

func (e MiscError) ShouldClear() bool {
	return false
}

func (e MiscError) Message() string {
	return e.Msg
}

type VersionMismatchError struct {
	old, new chat1.InboxVers
}

func NewVersionMismatchError(oldVers chat1.InboxVers, newVers chat1.InboxVers) VersionMismatchError {
	return VersionMismatchError{
		old: oldVers,
		new: newVers,
	}
}

func (e VersionMismatchError) Error() string {
	return fmt.Sprintf("version mismatch error: old %d new: %d", e.old, e.new)
}

func (e VersionMismatchError) ShouldClear() bool {
	return false
}

func (e VersionMismatchError) Message() string {
	return e.Error()
}

type AbortedError struct{}

func NewAbortedError() AbortedError {
	return AbortedError{}
}

func (e AbortedError) Error() string {
	return "request aborted"
}

func (e AbortedError) ShouldClear() bool {
	return false
}

func (e AbortedError) Message() string {
	return e.Error()
}

func isAbortedRequest(ctx context.Context) Error {
	// Check context for aborted request
	select {
	case <-ctx.Done():
		return NewAbortedError()
	default:
	}
	return nil
}
