package kex

import (
	"encoding/hex"
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/libkb"
)

var GlobalTimeout = 5 * time.Minute

type Receiver struct {
	handler   Handler
	seqno     int
	pollDur   time.Duration
	direction Direction
}

func NewReceiver(handler Handler, dir Direction) *Receiver {
	return &Receiver{handler: handler, pollDur: 20 * time.Second, direction: dir}
}

func (r *Receiver) Receive(ctx *Context) error {
	msgs, err := r.get(ctx)
	if err != nil {
		return err
	}
	for _, m := range msgs {
		G.Log.Info("Receive: message %s: seqno = %d, receiver seqno = %d", m.Name, m.Seqno, r.seqno)
		G.Log.Info("Receive: message %s: ctx.sender = %s, ctx.receiver = %s", m.Name, ctx.Sender, ctx.Receiver)
		G.Log.Info("Receive: message %s: m.sender = %s, m.receiver = %s", m.Name, m.Sender, m.Receiver)
		if m.Seqno > r.seqno {
			r.seqno = m.Seqno
		}

		/*
			zd := libkb.DeviceID{}
			if ctx.Sender == zd {
				ctx.Sender = m.Sender
			}
		*/

		// set context's sender and receiver
		ctx.Sender = m.Sender
		ctx.Receiver = m.Receiver

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

func (r *Receiver) get(ctx *Context) (MsgList, error) {
	G.Log.Info("get: w = %x, dir = %d, seqno = %d", ctx.WeakID, r.direction, r.seqno)
	res, err := G.API.Get(libkb.ApiArg{
		Endpoint:    "kex/receive",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"w":    libkb.S{Val: hex.EncodeToString(ctx.WeakID[:])},
			"dir":  libkb.I{Val: int(r.direction)},
			"low":  libkb.I{Val: r.seqno + 1},
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

	var messages MsgList
	for i := 0; i < n; i++ {
		m, err := MsgImport(msgs.AtIndex(i))
		if err != nil {
			if err != ErrMACMismatch {
				return nil, err
			} else {
				G.Log.Warning("Received message with bad HMAC.  Ignoring it.")
			}
		} else {
			messages = append(messages, m)
		}
	}

	sort.Sort(messages)

	return messages, nil
}
