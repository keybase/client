package auth

import (
	"errors"
	"fmt"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

var ErrShutdown = errors.New("shutting down")
var ErrCanceled = errors.New("canceled")

type BadUsernameError struct {
	expected libkb.NormalizedUsername
	received libkb.NormalizedUsername
}

func (e BadUsernameError) Error() string {
	return fmt.Sprintf("bad username; wanted %s but got %s", e.expected, e.received)
}

type BadKeyError struct {
	uid keybase1.UID
	kid keybase1.KID
}

func (e BadKeyError) Error() string {
	return fmt.Sprintf("Bad key error: %s not active for %s", e.kid, e.uid)
}
