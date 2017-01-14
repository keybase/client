package storage

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
)

type ChatStorageError interface {
	error
	ShouldClear() bool
	Message() string
}

type ChatStorageInternalError struct {
	Msg string
}

func (e ChatStorageInternalError) ShouldClear() bool {
	return true
}

func (e ChatStorageInternalError) Error() string {
	return fmt.Sprintf("internal chat storage error: %s", e.Msg)
}

func (e ChatStorageInternalError) Message() string {
	return e.Msg
}

func NewChatStorageInternalError(d utils.DebugLabeler, msg string, args ...interface{}) ChatStorageInternalError {
	d.Debug(context.Background(), "internal chat storage error: "+msg, args...)
	return ChatStorageInternalError{Msg: fmt.Sprintf(msg, args...)}
}

type ChatStorageMissError struct {
	Msg string
}

func (e ChatStorageMissError) Error() string {
	if len(e.Msg) > 0 {
		return "chat cache miss: " + e.Msg
	}
	return "chat cache miss"
}

func (e ChatStorageMissError) ShouldClear() bool {
	return false
}

func (e ChatStorageMissError) Message() string {
	return e.Error()
}

type ChatStorageRemoteError struct {
	Msg string
}

func (e ChatStorageRemoteError) Error() string {
	return fmt.Sprintf("chat remote error: %s", e.Msg)
}

func (e ChatStorageRemoteError) ShouldClear() bool {
	return false
}

func (e ChatStorageRemoteError) Message() string {
	return e.Msg
}

type ChatStorageMiscError struct {
	Msg string
}

func (e ChatStorageMiscError) Error() string {
	return e.Msg
}

func (e ChatStorageMiscError) ShouldClear() bool {
	return false
}

func (e ChatStorageMiscError) Message() string {
	return e.Msg
}

type ChatStorageVersionMismatchError struct {
	old, new chat1.InboxVers
}

func NewChatStorageVersionMismatchError(oldVers chat1.InboxVers, newVers chat1.InboxVers) ChatStorageVersionMismatchError {
	return ChatStorageVersionMismatchError{
		old: oldVers,
		new: newVers,
	}
}

func (e ChatStorageVersionMismatchError) Error() string {
	return fmt.Sprintf("version mismatch error: old %d new: %d", e.old, e.new)
}

func (e ChatStorageVersionMismatchError) ShouldClear() bool {
	return true
}

func (e ChatStorageVersionMismatchError) Message() string {
	return e.Error()
}
