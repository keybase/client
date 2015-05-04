package service

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
)

type BadTrackSessionError struct {
	i int
}

func (e BadTrackSessionError) Error() string {
	return fmt.Sprintf("Bad track session; either not found or read (%d)", e.i)
}

func (e BadTrackSessionError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: libkb.SC_BAD_TRACK_SESSION,
		Name: "BAD_TRACK_SESISON",
		Desc: fmt.Sprintf("Track session %d wasn't found", e.i),
	}
}

type NotConnectedError struct{}

func (e NotConnectedError) Error() string {
	return "Not connected"
}
