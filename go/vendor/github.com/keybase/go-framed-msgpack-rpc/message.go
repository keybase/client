package rpc

import (
	"errors"
)

type message struct {
	method          string
	seqno           seqNumber
	res             interface{}
	err             interface{}
	remainingFields int
	decodeSlots     []interface{}
}

func decodeIntoMessage(dec decoder, m *message) error {
	for _, s := range m.decodeSlots {
		if err := decodeField(dec, m, s); err != nil {
			return err
		}
	}
	return nil
}

func decodeField(dec decoder, m *message, i interface{}) error {
	err := dec.Decode(i)
	m.remainingFields--
	return err
}

func decodeToNull(dec decoder, m *message) error {
	var err error
	for err == nil && m.remainingFields > 0 {
		i := new(interface{})
		err = decodeField(dec, m, i)
	}
	return err
}

func decodeError(dec decoder, m *message, f ErrorUnwrapper) (appErr error, dispatchErr error) {
	if f != nil {
		arg := f.MakeArg()
		err := decodeField(dec, m, arg)
		if err != nil {
			return nil, err
		}
		return f.UnwrapError(arg)
	}
	var s string
	if dispatchErr = decodeField(dec, m, &s); dispatchErr == nil && len(s) > 0 {
		appErr = errors.New(s)
	}
	return appErr, dispatchErr
}
