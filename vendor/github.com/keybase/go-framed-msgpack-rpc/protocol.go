package rpc

import (
	"golang.org/x/net/context"
)

type ServeHandlerDescription struct {
	MakeArg    func() interface{}
	Handler    func(ctx context.Context, arg interface{}) (ret interface{}, err error)
	MethodType MethodType
}

type MethodType int

const (
	MethodCall     MethodType = 0
	MethodResponse MethodType = 1
	MethodNotify   MethodType = 2
	MethodCancel   MethodType = 3
)

type ErrorUnwrapper interface {
	MakeArg() interface{}
	UnwrapError(arg interface{}) (appError error, dispatchError error)
}

type Protocol struct {
	Name      string
	Methods   map[string]ServeHandlerDescription
	WrapError WrapErrorFunc
}

type seqNumber int
