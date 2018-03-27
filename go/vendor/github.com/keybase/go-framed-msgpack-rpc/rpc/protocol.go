package rpc

import (
	"sync"

	"golang.org/x/net/context"
)

type ServeHandlerDescription struct {
	MakeArg    func() interface{}
	Handler    func(ctx context.Context, arg interface{}) (ret interface{}, err error)
	MethodType MethodType
}

type MethodType int

const (
	MethodInvalid  MethodType = -1
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

type protocolMap map[string]Protocol

type SeqNumber int

type protocolHandler struct {
	wef       WrapErrorFunc
	mtx       sync.RWMutex
	protocols protocolMap
}

func newProtocolHandler(wef WrapErrorFunc) *protocolHandler {
	return &protocolHandler{
		wef:       wef,
		protocols: make(protocolMap),
	}
}

func (h *protocolHandler) registerProtocol(p Protocol) error {
	h.mtx.Lock()
	defer h.mtx.Unlock()

	if _, found := h.protocols[p.Name]; found {
		return newAlreadyRegisteredError(p.Name)
	}
	h.protocols[p.Name] = p
	return nil
}

func (h *protocolHandler) findServeHandler(name string) (*ServeHandlerDescription, WrapErrorFunc, error) {
	h.mtx.RLock()
	defer h.mtx.RUnlock()

	p, m := splitMethodName(name)
	prot, found := h.protocols[p]
	if !found {
		return nil, h.wef, newProtocolNotFoundError(p)
	}
	srv, found := prot.Methods[m]
	if !found {
		return nil, h.wef, newMethodNotFoundError(p, m)
	}
	return &srv, prot.WrapError, nil
}

func (h *protocolHandler) getArg(name string) (interface{}, error) {
	handler, _, err := h.findServeHandler(name)
	if err != nil {
		return nil, err
	}
	return handler.MakeArg(), nil
}
