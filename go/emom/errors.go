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

type WrongReplyError struct {
	wanted   emom1.Seqno
	received emom1.Seqno
}

func (w WrongReplyError) Error() string {
	return fmt.Sprintf("Server sent wrong reply: wanted %d but got %d", w.wanted, w.received)
}
