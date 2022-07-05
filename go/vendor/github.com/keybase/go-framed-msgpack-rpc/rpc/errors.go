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
	return PacketizerError{msg: fmt.Sprintf(d, a...)}
}

type DispatcherError struct {
	msg string
}

func (p DispatcherError) Error() string {
	return "dispatcher error: " + p.msg
}

func NewDispatcherError(d string, a ...interface{}) DispatcherError {
	return DispatcherError{msg: fmt.Sprintf(d, a...)}
}

type ReceiverError struct {
	msg string
}

func (p ReceiverError) Error() string {
	return "receiver error: " + p.msg
}

func NewReceiverError(d string, a ...interface{}) ReceiverError {
	return ReceiverError{msg: fmt.Sprintf(d, a...)}
}

type MethodNotFoundError struct {
	p string
	m string
}

func newMethodNotFoundError(p, m string) MethodNotFoundError {
	return MethodNotFoundError{
		p: p,
		m: m,
	}
}

func (m MethodNotFoundError) Error() string {
	return fmt.Sprintf("method '%s' not found in protocol '%s'", m.m, m.p)
}

type ProtocolNotFoundError struct {
	p string
}

func newProtocolNotFoundError(p string) ProtocolNotFoundError {
	return ProtocolNotFoundError{p: p}
}

func (p ProtocolNotFoundError) Error() string {
	return "protocol not found: " + p.p
}

type AlreadyRegisteredError struct {
	p string
}

func newAlreadyRegisteredError(p string) AlreadyRegisteredError {
	return AlreadyRegisteredError{p: p}
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

func NewTypeError(expected, actual interface{}) TypeError {
	return TypeError{p: fmt.Sprintf("Invalid type for arguments. Expected: %T, actual: %T", expected, actual)}
}

type CallNotFoundError struct {
	seqno SeqNumber
}

func newCallNotFoundError(s SeqNumber) CallNotFoundError {
	return CallNotFoundError{seqno: s}
}

func (c CallNotFoundError) Error() string {
	return fmt.Sprintf("Call not found for sequence number %d", c.seqno)
}

type NilResultError struct {
	seqno SeqNumber
}

func (c NilResultError) Error() string {
	return fmt.Sprintf("Nil result supplied for sequence number %d", c.seqno)
}

type RPCDecodeError struct {
	err   error
	typ   MethodType
	len   int
	name  string
	ctype CompressionType
}

func (r RPCDecodeError) Error() string {
	return fmt.Sprintf("RPC error. type: %s, method: %s, length: %d, compression: %v, error: %v", r.typ, r.name, r.len, r.ctype, r.err)
}

func newRPCDecodeError(t MethodType, n string, l int, ctype CompressionType, err error) RPCDecodeError {
	return RPCDecodeError{
		err:   err,
		typ:   t,
		len:   l,
		ctype: ctype,
		name:  n,
	}
}

func newRPCMessageFieldDecodeError(i int, err error) error {
	return fmt.Errorf("error decoding message field at position %d, error: %v", i, err)
}

func unboxRPCError(err error) error {
	switch e := err.(type) {
	case RPCDecodeError:
		return e.err
	default:
		return err
	}
}
