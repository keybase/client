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

type ReceiverError struct {
	msg string
}

func (p ReceiverError) Error() string {
	return "dispatcher error: " + p.msg
}

func NewReceiverError(d string, a ...interface{}) ReceiverError {
	return ReceiverError{fmt.Sprintf(d, a...)}
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
	m string
	s seqNumber
}

func newCanceledError(method string, seq seqNumber) CanceledError {
	return CanceledError{
		m: method,
		s: seq,
	}
}

func (c CanceledError) Error() string {
	return fmt.Sprintf("call canceled: method %s, seqid %d", c.m, c.s)
}

type CallNotFoundError struct {
	seqno seqNumber
}

func (c CallNotFoundError) Error() string {
	return fmt.Sprintf("Call not found for sequence number %d", c.seqno)
}

type NilResultError struct {
	seqno seqNumber
}

func (c NilResultError) Error() string {
	return fmt.Sprintf("Nil result supplied for sequence number %d", c.seqno)
}

type RPCDecodeError struct {
	typ MethodType
	len int
	err error
}

func (r RPCDecodeError) Error() string {
	return fmt.Sprintf("RPC error: type %d, length %d, error: %v", r.typ, r.len, r.err)
}

func newRPCDecodeError(t MethodType, l int, e error) error {
	return RPCDecodeError{
		typ: t,
		len: l,
		err: e,
	}
}

func newRPCMessageFieldDecodeError(i int, err error) error {
	return fmt.Errorf("error decoding message field at position %d, error: %v", i, err)
}
