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

func decodeIntoMessage(dec decoder, m *message) error {
	for _, s := range m.decodeSlots {
		if err := decodeMessage(dec, m, s); err != nil {
			return err
		}
	}
	return nil
}

func decodeMessage(dec decoder, m *message, i interface{}) error {
	err := dec.Decode(i)
	// TODO need to verify whether codec.Decode pulls from the reader if
	// the decode fails, or whether the reader stays in the same state
	// as before the Decode
	m.remainingFields--
	return err
}

func decodeToNull(dec decoder, m *message) error {
	var err error
	for err == nil && m.remainingFields > 0 {
		i := new(interface{})
		err = decodeMessage(dec, m, i)
	}
	return err
}

func decodeError(dec decoder, m *message, f ErrorUnwrapper) (appErr error, dispatchErr error) {
	if f != nil {
		arg := f.MakeArg()
		err := decodeMessage(dec, m, arg)
		if err != nil {
			return nil, err
		}
		return f.UnwrapError(arg)
	}
	var s string
	if dispatchErr = decodeMessage(dec, m, &s); dispatchErr == nil && len(s) > 0 {
		appErr = errors.New(s)
	}
	return appErr, dispatchErr
}
