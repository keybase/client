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

type InvalidTokenTypeError struct {
	expected string
	received string
}

func (e InvalidTokenTypeError) Error() string {
	return fmt.Sprintf("Invalid token type, expected: %s, received: %s",
		e.expected, e.received)
}

type MaxTokenExpiresError struct {
	creationTime int64
	expireIn     int
	now          int64
	maxExpireIn  int
	remaining    int
}

func (e MaxTokenExpiresError) Error() string {
	return fmt.Sprintf("Max token expiration exceeded, ctime/expire_in: %d/%d, "+
		"now/max: %d/%d, remaining: %d", e.creationTime, e.expireIn,
		e.now, e.maxExpireIn, e.remaining)
}

type TokenExpiredError struct {
	creationTime int64
	expireIn     int
	now          int64
}

func (e TokenExpiredError) Error() string {
	return fmt.Sprintf("Token expired, ctime/expire_in: %d/%d, now: %d",
		e.creationTime, e.expireIn, e.now)
}

type InvalidTokenKeyError struct {
	expected string
	received string
}

func (e InvalidTokenKeyError) Error() string {
	return fmt.Sprintf("Invalid token key, expected: %s, received: %s",
		e.expected, e.received)
}
