package emom

import (
	errors "errors"
	fmt "fmt"
	emom1 "github.com/keybase/client/go/protocol/emom1"
)

type ServerSequenceError struct {
	msg string
}

func (s ServerSequenceError) Error() string {
	return fmt.Sprintf("server sequence error: %s", s.msg)
}

func newServerSequenceError(s string, args ...interface{}) ServerSequenceError {
	return ServerSequenceError{
		msg: fmt.Sprintf(s, args...),
	}
}

var MACError = errors.New("Error checking MAC on ciphertexts")
var SequencerTimeoutError = errors.New("Timed out waiting for sequencing")

type WrongReplyError struct {
	wanted   emom1.Seqno
	received emom1.Seqno
}

func (w WrongReplyError) Error() string {
	return fmt.Sprintf("Server sent wrong reply: wanted %d but got %d", w.wanted, w.received)
}

type HandshakeError struct {
	msg string
}

func NewHandshakeError(s string, args ...interface{}) HandshakeError {
	return HandshakeError{
		msg: fmt.Sprintf(s, args...),
	}
}

func (h HandshakeError) Error() string {
	return fmt.Sprintf("Handshake error: %s", h.msg)
}

type ClientSequenceError struct {
	msg string
}

func newClientSequenceError(s string, args ...interface{}) ClientSequenceError {
	return ClientSequenceError{
		msg: fmt.Sprintf(s, args...),
	}
}

func (c ClientSequenceError) Error() string {
	return fmt.Sprintf("Client sequence error: %s", c.msg)
}

type ServerError struct {
	msg string
}

func newServerError(s string, args ...interface{}) ServerError {
	return ServerError{
		msg: fmt.Sprintf(s, args...),
	}
}

func (s ServerError) Error() string {
	return fmt.Sprintf("Server error: %s", s.msg)
}

type UserAuthError struct {
	msg string
}

func newUserAuthError(s string, args ...interface{}) UserAuthError {
	return UserAuthError{
		msg: fmt.Sprintf(s, args...),
	}
}

func (u UserAuthError) Error() string {
	return fmt.Sprintf("User auth error: %s", u.msg)
}

var NoSessionKeyError = errors.New("no available session key")
