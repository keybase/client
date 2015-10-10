package rpc

import (
	"errors"
)

type message struct {
	method          string
	seqno           int
	res             interface{}
	err             interface{}
	remainingFields int
	decodeSlots     []interface{}
}

func decodeMessage(dec decoder, m *message, i interface{}) error {
	err := dec.Decode(i)
	if err == nil {
		m.remainingFields--
	}
	return err
}

func decodeToNull(dec decoder, m *message) error {
	var err error
	for err == nil && m.remainingFields > 0 {
		i := new(interface{})
		decodeMessage(dec, m, i)
	}
	return err
}

func decodeError(dec decoder, m *message, f ErrorUnwrapper) (appErr error, dispatchErr error) {
	var s string
	if f != nil {
		arg := f.MakeArg()
		err := decodeMessage(dec, m, arg)
		if err != nil {
			return nil, err
		}
		return f.UnwrapError(arg)
	}
	if dispatchErr = decodeMessage(dec, m, &s); dispatchErr == nil && len(s) > 0 {
		appErr = errors.New(s)
	}
	return appErr, dispatchErr
}
