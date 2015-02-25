package kex

import (
	"encoding/hex"

	"github.com/keybase/client/go/libkb"
)

type Sender struct {
	seqno     int
	direction Direction
}

func NewSender(dir Direction) *Sender {
	return &Sender{direction: dir}
}

func (s *Sender) StartKexSession(ctx *Context, id StrongID) error {
	mb := &Body{Name: startkexMsg, Args: MsgArgs{StrongID: id}}
	return s.send(ctx, mb)
}

func (s *Sender) StartReverseKexSession(ctx *Context) error {
	return nil
}

func (s *Sender) Hello(ctx *Context, devID libkb.DeviceID, devKeyID libkb.KID) error {
	mb := &Body{Name: helloMsg, Args: MsgArgs{DeviceID: devID, DevKeyID: devKeyID}}
	return s.send(ctx, mb)
}

func (s *Sender) PleaseSign(ctx *Context, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	mb := &Body{Name: pleasesignMsg, Args: MsgArgs{SigningKey: eddsa, Sig: sig, DevType: devType, DevDesc: devDesc}}
	return s.send(ctx, mb)
}

func (s *Sender) Done(ctx *Context, mt libkb.MerkleTriple) error {
	mb := &Body{Name: doneMsg, Args: MsgArgs{MerkleTriple: mt}}
	return s.send(ctx, mb)
}

// XXX get rid of this when real client comm works
func (s *Sender) RegisterTestDevice(srv Handler, device libkb.DeviceID) error {
	return nil
}

// CorruptStartKexSession sends a startkex message with a
// corrupted MAC.  This is for testing, clearly.  It's an exposed
// function since only an engine test can test this.
func (s *Sender) CorruptStartKexSession(ctx *Context, id StrongID) error {
	mb := &Body{Name: startkexMsg, Args: MsgArgs{StrongID: id}}
	msg, err := s.genMsg(ctx, mb)
	if err != nil {
		return err
	}
	// flip bits in first byte of mac to corrupt it
	msg.Mac[0] = ^msg.Mac[0]
	return s.post(msg)
}

func (s *Sender) send(ctx *Context, body *Body) error {
	msg, err := s.genMsg(ctx, body)
	if err != nil {
		return err
	}
	return s.post(msg)
}

func (s *Sender) genMsg(ctx *Context, body *Body) (*Msg, error) {
	msg := NewMsg(ctx, body)
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
