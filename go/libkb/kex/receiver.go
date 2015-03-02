package kex

import (
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
)

// StartTimeout is the time the kex protocol will wait for the
// first message when the sibling device starts the key exchange.
var StartTimeout = 5 * time.Minute

// IntraTimeout is the time the kex protocol will wait for
// messages once the key exchange has begun.
var IntraTimeout = 1 * time.Minute

// PollDuration is the long poll duration for a kex/receive api call.
var PollDuration = 20 * time.Second

// Receiver gets kex messages from the server and routes them to a
// kex Handler.
type Receiver struct {
	handler   Handler
	seqno     int
	direction Direction
	seen      map[string]bool
}

// NewReceiver creates a Receiver that will route messages to the
// provided handler.  It will receive messages for the specified
// direction.
func NewReceiver(handler Handler, dir Direction) *Receiver {
	sm := make(map[string]bool)
	return &Receiver{handler: handler, direction: dir, seen: sm}
}

// Receive gets the next set of messages from the server and
// routes them to the handler.  It returns the number of messages
// it received successfully.
func (r *Receiver) Receive(m *Meta) (int, error) {
	msgs, err := r.get(m)
	if err != nil {
		return 0, err
	}
	var count int
	var errorList []error
	for _, msg := range msgs {

		// check to see if this receiver has seen this message before
		smac := hex.EncodeToString(msg.Body.Mac)
		if _, seen := r.seen[smac]; seen {
			G.Log.Warning("skipping message [%s:%s]: already seen", msg.Name, smac)
		} else {
			r.seen[smac] = true
		}

		if msg.Seqno > r.seqno {
			r.seqno = msg.Seqno
		}

		G.Log.Debug("received message [%s]", msg.Name)

		// set context's sender and receiver
		m.Sender = msg.Sender
		m.Receiver = msg.Receiver

		switch msg.Name {
		case startkexMsg:
			err = r.handler.StartKexSession(m, msg.Args.StrongID)
		case startrevkexMsg:
			err = r.handler.StartReverseKexSession(m)
		case helloMsg:
			err = r.handler.Hello(m, msg.Args.DeviceID, msg.Args.DevKeyID)
		case pleasesignMsg:
			err = r.handler.PleaseSign(m, msg.Args.SigningKey, msg.Args.Sig, msg.Args.DevType, msg.Args.DevDesc)
		case doneMsg:
			err = r.handler.Done(m)
		default:
			err = fmt.Errorf("unhandled message name: %q", msg.Name)
		}

		if err == nil {
			count++
		} else {
			errorList = append(errorList, err)
		}

		// if the message has the EOF flag set, we are done receiving messages
		// so break out now.
		if msg.EOF {
			return count, ErrProtocolEOF
		}
	}

	if len(errorList) > 0 {
		var es []string
		for _, e := range errorList {
			es = append(es, e.Error())
		}
		return count, fmt.Errorf("receive message errors: %s", strings.Join(es, ", "))
	}

	return count, nil
}

// ReceiveTimeout will repeatedly call Receive until Receive
// processes at least one message, or the timeout duration is
// reached.
func (r *Receiver) ReceiveTimeout(m *Meta, timeout time.Duration) error {
	start := time.Now()
	for time.Since(start) < timeout {
		n, err := r.Receive(m)
		if err != nil {
			G.Log.Warning(err.Error())
		}
		if n > 0 {
			return nil
		}
	}
	return libkb.ErrTimeout
}

// get performs a Get request to long poll for a set of messages.
func (r *Receiver) get(m *Meta) (MsgList, error) {
	G.Log.Debug("get: {dir: %d, seqno: %d, w = %x, uid = %x}", r.direction, r.seqno, m.WeakID, G.GetMyUID())
	res, err := G.API.Get(libkb.ApiArg{
		Endpoint:    "kex/receive",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"w":    libkb.S{Val: hex.EncodeToString(m.WeakID[:])},
			"dir":  libkb.I{Val: int(r.direction)},
			"low":  libkb.I{Val: r.seqno + 1},
			"poll": libkb.I{Val: int(PollDuration / time.Second)},
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
			}
			G.Log.Warning("Received message with bad HMAC.  Ignoring it.")
		} else {
			messages = append(messages, m)
		}
	}

	sort.Sort(messages)

	return messages, nil
}
