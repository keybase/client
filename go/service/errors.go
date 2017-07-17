// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type BadTrackSessionError struct {
	i int
}

func (e BadTrackSessionError) Error() string {
	return fmt.Sprintf("Bad track session; either not found or read (%d)", e.i)
}

func (e BadTrackSessionError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: libkb.SCBadTrackSession,
		Name: "BAD_TRACK_SESSION",
		Desc: fmt.Sprintf("Follow session %d wasn't found", e.i),
	}
}

type NotConnectedError struct{}

func (e NotConnectedError) Error() string {
	return "Not connected"
}
