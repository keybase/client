package auth

import (
	"errors"
	"fmt"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// ErrShutdown is raised when an operation is pending but the CA is shutting down
var ErrShutdown = errors.New("shutting down")

// ErrCanceled is raised when an API operation is canceled midstream.
var ErrCanceled = errors.New("canceled")

// BadUsernameError is raised when the given username disagreeds with the expected
// username
type BadUsernameError struct {
	expected libkb.NormalizedUsername
	received libkb.NormalizedUsername
}

func (e BadUsernameError) Error() string {
	return fmt.Sprintf("bad username; wanted %s but got %s", e.expected, e.received)
}

// BadKeyError is raised when the given KID is not valid for the given UID.
type BadKeyError struct {
	uid keybase1.UID
	kid keybase1.KID
}

func (e BadKeyError) Error() string {
	return fmt.Sprintf("Bad key error: %s not active for %s", e.kid, e.uid)
}
