package kex

import (
	"encoding/hex"
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
)

var GlobalTimeout = 5 * time.Minute

type Receiver struct {
	handler Handler
	seqno   int
	pollDur time.Duration
}

func NewReceiver(handler Handler) *Receiver {
	return &Receiver{handler: handler, pollDur: 20 * time.Second}
}

func (r *Receiver) Receive(ctx *Context) error {
	msgs, err := r.get(ctx)
	if err != nil {
		return err
	}
	for _, m := range msgs {
		switch m.Name {
		case startkexMsg:
			return r.handler.StartKexSession(ctx, m.Args.StrongID)
		case startrevkexMsg:
			return r.handler.StartReverseKexSession(ctx)
		case helloMsg:
			return r.handler.Hello(ctx, m.Args.DeviceID, m.Args.DevKeyID)
		case pleasesignMsg:
			return r.handler.PleaseSign(ctx, m.Args.SigningKey, m.Args.Sig, m.Args.DevType, m.Args.DevDesc)
		case doneMsg:
			return r.handler.Done(ctx, m.Args.MerkleTriple)
		default:
			return fmt.Errorf("unhandled message name: %q", m.Name)
		}
	}
	return nil
}

func (r *Receiver) get(ctx *Context) ([]*Msg, error) {
	res, err := G.API.Get(libkb.ApiArg{
		Endpoint:    "kex/receive",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"w":    libkb.S{Val: hex.EncodeToString(ctx.WeakID[:])},
			"dir":  libkb.I{Val: 1},
			"low":  libkb.I{Val: 0},
			"poll": libkb.I{Val: int(r.pollDur / time.Second)},
		},
	})
	if err != nil {
		return nil, err
	}

	msgs := res.Body.AtKey("msgs")
	n, err := msgs.Len()
	if err != nil {
		return nil, err
	}
	messages := make([]*Msg, n)
	for i := 0; i < n; i++ {
		messages[i], err = MsgImport(msgs.AtIndex(i))
		if err != nil {
			return nil, err
		}
	}

	return messages, nil
}
