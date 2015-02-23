package engine

import (
	"encoding/hex"
	"time"

	"github.com/keybase/go/libkb"
)

var KexGlobalTimeout = 5 * time.Minute

type KexSender struct {
}

func NewKexSender() *KexSender {
	return &KexSender{}
}

func (s *KexSender) StartKexSession(ctx *KexContext, id KexStrongID) error {
	return s.post(ctx, "start kex")
}

func (s *KexSender) StartReverseKexSession(ctx *KexContext) error {
	return nil
}

func (s *KexSender) Hello(ctx *KexContext, devID libkb.DeviceID, devKeyID libkb.KID) error {
	return nil
}

func (s *KexSender) PleaseSign(ctx *KexContext, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	return nil
}

func (s *KexSender) Done(ctx *KexContext, mt libkb.MerkleTriple) error {
	return nil
}

// XXX get rid of this when real client comm works
func (s *KexSender) RegisterTestDevice(srv KexHandler, device libkb.DeviceID) error {
	return nil
}

func (s *KexSender) post(ctx *KexContext, msg string) error {
	_, err := G.API.Post(libkb.ApiArg{
		Endpoint:    "kex/send",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"sender":   libkb.S{Val: ctx.Src.String()},
			"receiver": libkb.S{Val: ctx.Dst.String()},
			"dir":      libkb.I{Val: 1},
			"I":        libkb.S{Val: hex.EncodeToString(ctx.StrongID[:])},
			"w":        libkb.S{Val: hex.EncodeToString(ctx.WeakID[:])},
			"seqno":    libkb.I{Val: ctx.Seqno},
			"msg":      libkb.S{Val: msg},
		},
	})
	return err
}

type KexReceiver struct {
	handler KexHandler
	seqno   int
	pollDur time.Duration
}

func NewKexReceiver(handler KexHandler) *KexReceiver {
	return &KexReceiver{handler: handler, pollDur: 20 * time.Second}
}

func (r *KexReceiver) Receive() error {
	return nil
}

func (r *KexReceiver) ReceiveFilter(name string) error {
	return nil
}
