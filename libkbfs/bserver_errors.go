package libkbfs

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

const (
	//BEBlockNonExistent is the error code for when backend cannot find a block
	BEBlockNonExistent = 2700
	//BEBackendFailure is the error code for when backend has hit an error
	BEBackendFailure = 2701
)

//BlockNonExistentError is an exportable error from bserver
type BlockNonExistentError struct {
	error
	Msg string
}

//BackendFailureError is an exportable error from bserver
type BackendFailureError struct {
	error
	Msg string
}

//ToStatus turns BlockNonExistentError to keybase1.Status, thus making it exportable
func (e BlockNonExistentError) ToStatus() (s keybase1.Status) {
	s.Code = BEBlockNonExistent
	s.Name = "BLOCK_NONEXISTENT"
	s.Desc = e.Msg
	return
}

//ToStatus turns BackendFailureError to keybase1.Status, thus making it exportable
func (e BackendFailureError) ToStatus() (s keybase1.Status) {
	s.Code = BEBackendFailure
	s.Name = "BACKEND_FAILURE"
	s.Desc = e.Msg
	return
}
