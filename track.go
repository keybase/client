
package main

import (
	"github.com/keybase/protocol/go"
	"github.com/keybase/go-libkb"
	"net"
)

type TrackHandler struct {
	conn net.Conn
	ui *RemoteTrackUI
}

func (h TrackHandler) IdentifySelfStart(arg *keybase_1.IdentifySelfStartArg, res *keybase_1.IdentifyStartRes) error {
	// We might need to ID ourselves, to load us in here
	u, err := libkb.LoadMe(libkb.LoadUserArg{})
	if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else if _, not_selected := err.(libkb.NoSelectedKeyError); not_selected {
		h.identifySelf(u, res)
	} else {
		res.Status = libkb.ExportErrorAsStatus(err)
	}
	return nil
}

func (h TrackHandler) identifySelf(u *libkb.User, res *keybase_1.IdentifyStartRes) {
}

