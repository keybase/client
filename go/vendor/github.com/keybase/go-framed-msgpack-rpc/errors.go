package rpc

import (
	"fmt"
)

type PacketizerError struct {
	msg string
}

func (p PacketizerError) Error() string {
	return "packetizer error: " + p.msg
}

func NewPacketizerError(d string, a ...interface{}) PacketizerError {
	return PacketizerError{fmt.Sprintf(d, a...)}
}

type DispatcherError struct {
	msg string
}

func (p DispatcherError) Error() string {
	return "dispatcher error: " + p.msg
}

func NewDispatcherError(d string, a ...interface{}) DispatcherError {
	return DispatcherError{fmt.Sprintf(d, a...)}
}

type MethodNotFoundError struct {
	p string
	m string
}

func (m MethodNotFoundError) Error() string {
	return fmt.Sprintf("method '%s' not found in protocol '%s'", m.m, m.p)
}

type ProtocolNotFoundError struct {
	p string
}

func (p ProtocolNotFoundError) Error() string {
	return "protocol not found: " + p.p
}

type DisconnectedError struct{}

func (e DisconnectedError) Error() string {
	return "disconnected; no connection to remote"
}

type AlreadyRegisteredError struct {
	p string
}

func (a AlreadyRegisteredError) Error() string {
	return a.p + ": protocol already registered"
}

type TypeError struct {
	p string
}

func (t TypeError) Error() string {
	return t.p
}

func NewTypeError(expected, actual interface{}) error {
	return TypeError{fmt.Sprintf("Invalid type for arguments. Expected: %T, actual: %T", expected, actual)}
}

type CanceledError struct {
	p string
}

func newCanceledError(method string, seq seqNumber) CanceledError {
	return CanceledError{
		p: fmt.Sprintf("call canceled: method %s, seqid %d", method, seq),
	}
}

func (c CanceledError) Error() string {
	return c.p
}

type CallNotFoundError struct {
	seqno seqNumber
}

func (c CallNotFoundError) Error() string {
	return fmt.Sprintf("Call not found for sequence number %d", c.seqno)
}
