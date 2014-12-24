
package main

import (
	"github.com/keybase/protocol/go"
	"github.com/keybase/go-libkb"
	"fmt"
)

type BadTrackSessionError struct {
	i int	
}

func (e BadTrackSessionError) Error() string {
	return fmt.Sprintf("Bad track session; either not found or read (%d)", e.i)
}

func (e BadTrackSessionError) ToStatus() keybase_1.Status {
	return keybase_1.Status {
		Code : libkb.SC_BAD_TRACK_SESSION,
		Name : "BAD_TRACK_SESISON",
		Desc : fmt.Sprintf("Track session %d wasn't found", e.i),
	}	
}

