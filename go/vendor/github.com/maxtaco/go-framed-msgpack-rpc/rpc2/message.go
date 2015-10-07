package rpc2

import (
	"errors"
)

type Message struct {
	t        Transporter
	nFields  int
	nDecoded int
}

func NewMessage(t Transporter, nFields int) Message {
	return Message{t, nFields, 0}
}

func (m *Message) Decode(i interface{}) (err error) {
	err = m.t.Decode(i)
	if err == nil {
		m.nDecoded++
	}
	return err
}

func (m *Message) WrapError(f WrapErrorFunc, e error) interface{} {
	if f != nil {
		return f(e)
	} else if e == nil {
		return nil
	} else {
		return e.Error()
	}
}

func (m *Message) DecodeError(f UnwrapErrorFunc) (app error, dispatch error) {
	var s string
	if f != nil {
		app, dispatch = f(m.makeDecodeNext(nil))
	} else if dispatch = m.Decode(&s); dispatch == nil && len(s) > 0 {
		app = errors.New(s)
	}
	return
}

func (m *Message) Encode(i interface{}) error {
	return m.t.Encode(i)
}

func (m *Message) decodeToNull() error {
	var err error
	for err == nil && m.nDecoded < m.nFields {
		var i interface{}
		m.Decode(&i)
	}
	return err
}

func (m *Message) makeDecodeNext(debugHook func(interface{})) DecodeNext {
	// Reserve the next object
	m.t.ReadLock()
	return func(i interface{}) error {
		ret := m.Decode(i)
		if debugHook != nil {
			debugHook(i)
		}
		m.t.ReadUnlock()
		return ret
	}
}
