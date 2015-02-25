package kex

import (
	"encoding/hex"

	"github.com/keybase/client/go/libkb"
)

type Sender struct {
}

func NewSender() *Sender {
	return &Sender{}
}

func (s *Sender) StartKexSession(ctx *Context, id StrongID) error {
	mb := &Body{Name: startkexMsg, Args: MsgArgs{StrongID: id}}
	return s.post(ctx, mb)
}

func (s *Sender) StartReverseKexSession(ctx *Context) error {
	return nil
}

func (s *Sender) Hello(ctx *Context, devID libkb.DeviceID, devKeyID libkb.KID) error {
	mb := &Body{Name: helloMsg, Args: MsgArgs{DeviceID: devID, DevKeyID: devKeyID}}
	return s.post(ctx, mb)
}

func (s *Sender) PleaseSign(ctx *Context, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	mb := &Body{Name: pleasesignMsg, Args: MsgArgs{SigningKey: eddsa, Sig: sig, DevType: devType, DevDesc: devDesc}}
	return s.post(ctx, mb)
}

func (s *Sender) Done(ctx *Context, mt libkb.MerkleTriple) error {
	mb := &Body{Name: doneMsg, Args: MsgArgs{MerkleTriple: mt}}
	return s.post(ctx, mb)
}

// XXX get rid of this when real client comm works
func (s *Sender) RegisterTestDevice(srv Handler, device libkb.DeviceID) error {
	return nil
}

func (s *Sender) post(ctx *Context, body *Body) error {
	msg := NewMsg(ctx, body)
	msg.Direction = 1
	mac, err := msg.MacSum()
	if err != nil {
		return err
	}
	msg.Mac = mac

	menc, err := msg.Body.Encode()
	if err != nil {
		return err
	}

	_, err = G.API.Post(libkb.ApiArg{
		Endpoint:    "kex/send",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"dir":      libkb.I{Val: msg.Direction},
			"I":        libkb.S{Val: hex.EncodeToString(msg.StrongID[:])},
			"msg":      libkb.S{Val: menc},
			"receiver": libkb.S{Val: msg.Dst.String()},
			"sender":   libkb.S{Val: msg.Src.String()},
			"seqno":    libkb.I{Val: msg.Seqno},
			"w":        libkb.S{Val: hex.EncodeToString(msg.WeakID[:])},
		},
	})
	return err
}
