package kex

import (
	"encoding/hex"

	"github.com/keybase/client/go/libkb"
)

// Sender is an implementation of the kex Handler interface that
// sends messages to the api server.
type Sender struct {
	seqno     int
	direction Direction
}

// NewSender creates a Sender for the given message direction.
func NewSender(dir Direction) *Sender {
	return &Sender{direction: dir}
}

// StartKexSession sends the StartKexSession message to the
// server.
func (s *Sender) StartKexSession(m *Meta, id StrongID) error {
	mb := &Body{Name: startkexMsg, Args: MsgArgs{StrongID: id}}
	return s.send(m, mb)
}

// StartReverseKexSession sends the StartReverseKexSession message
// to the server.
func (s *Sender) StartReverseKexSession(m *Meta) error {
	return nil
}

// Hello sends the Hello message to the server.
func (s *Sender) Hello(m *Meta, devID libkb.DeviceID, devKeyID libkb.KID) error {
	mb := &Body{Name: helloMsg, Args: MsgArgs{DeviceID: devID, DevKeyID: devKeyID}}
	return s.send(m, mb)
}

// PleaseSign sends the PleaseSign message to the server.
func (s *Sender) PleaseSign(m *Meta, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	mb := &Body{Name: pleasesignMsg, Args: MsgArgs{SigningKey: eddsa, Sig: sig, DevType: devType, DevDesc: devDesc}}
	return s.send(m, mb)
}

// Done sends the Done message to the server.
func (s *Sender) Done(m *Meta, mt libkb.MerkleTriple) error {
	mb := &Body{Name: doneMsg, Args: MsgArgs{MerkleTriple: mt}}
	return s.send(m, mb)
}

// RegisterTestDevice is used for testing.
// XXX get rid of this when real client comm works
func (s *Sender) RegisterTestDevice(srv Handler, device libkb.DeviceID) error {
	return nil
}

// CorruptStartKexSession sends a startkex message with a
// corrupted MAC.  This is for testing, clearly.  It's an exposed
// function since only an engine test can test this.
func (s *Sender) CorruptStartKexSession(m *Meta, id StrongID) error {
	mb := &Body{Name: startkexMsg, Args: MsgArgs{StrongID: id}}
	msg, err := s.genMsg(m, mb)
	if err != nil {
		return err
	}
	// flip bits in first byte of mac to corrupt it
	msg.Mac[0] = ^msg.Mac[0]
	return s.post(msg)
}

func (s *Sender) send(m *Meta, body *Body) error {
	msg, err := s.genMsg(m, body)
	if err != nil {
		return err
	}
	return s.post(msg)
}

func (s *Sender) genMsg(m *Meta, body *Body) (*Msg, error) {
	msg := NewMsg(m, body)
	msg.Direction = s.direction
	s.seqno++
	msg.Seqno = s.seqno
	mac, err := msg.MacSum()
	if err != nil {
		return nil, err
	}
	msg.Mac = mac
	return msg, nil
}

func (s *Sender) post(msg *Msg) error {
	menc, err := msg.Body.Encode()
	if err != nil {
		return err
	}

	_, err = G.API.Post(libkb.ApiArg{
		Endpoint:    "kex/send",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"dir":      libkb.I{Val: int(msg.Direction)},
			"I":        libkb.S{Val: hex.EncodeToString(msg.StrongID[:])},
			"msg":      libkb.S{Val: menc},
			"receiver": libkb.S{Val: msg.Receiver.String()},
			"sender":   libkb.S{Val: msg.Sender.String()},
			"seqno":    libkb.I{Val: msg.Seqno},
			"w":        libkb.S{Val: hex.EncodeToString(msg.WeakID[:])},
		},
	})
	return err
}
