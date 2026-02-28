package kvstore

import "github.com/keybase/client/go/libkb"

type KVCacheError struct {
	Message string
}

func (e KVCacheError) Error() string {
	return e.Message
}

func NewKVRevisionError(msg string) error {
	if msg == "" {
		msg = "revision out of date"
	}
	return libkb.AppStatusError{
		Code: libkb.SCTeamStorageWrongRevision,
		Name: "KVTeamStorageWrongRevision",
		Desc: msg,
	}
}
