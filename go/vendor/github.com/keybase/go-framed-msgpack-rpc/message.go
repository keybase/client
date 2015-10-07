package rpc

import (
	"errors"
)

type message struct {
	t        transporter
	nFields  int
	nDecoded int
}

func (m *message) Decode(i interface{}) (err error) {
	err = m.t.Decode(i)
	if err == nil {
		m.nDecoded++
	}
	return err
}

func (m *message) WrapError(f WrapErrorFunc, e error) interface{} {
	if f != nil {
		return f(e)
	} else if e == nil {
		return nil
	} else {
		return e.Error()
	}
}

func (m *message) DecodeError(f UnwrapErrorFunc) (app error, dispatch error) {
	var s string
	if f != nil {
		app, dispatch = f(m.makeDecodeNext(nil))
	} else if dispatch = m.Decode(&s); dispatch == nil && len(s) > 0 {
		app = errors.New(s)
	}
	return
}

func (m *message) Encode(i interface{}) error {
	return m.t.Encode(i)
}

func (m *message) decodeToNull() error {
	var err error
	for err == nil && m.nDecoded < m.nFields {
		var i interface{}
		m.Decode(&i)
	}
	return err
}

func (m *message) makeDecodeNext(debugHook func(interface{})) DecodeNext {
	// Reserve the next object
	m.t.Lock()
	return func(i interface{}) error {
		ret := m.Decode(i)
		if debugHook != nil {
			debugHook(i)
		}
		m.t.Unlock()
		return ret
	}
}
