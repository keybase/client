package kex

import (
	"crypto/hmac"
	"encoding/hex"
	"sort"
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
	seqno     int
	direction Direction
	seen      map[string]bool
	secret    *Secret
	Msgs      chan *Msg
	done      bool
	sessToken string // api session token
	sessCsrf  string // api session csrf
}

// NewReceiver creates a Receiver that will route messages to the
// provided handler.  It will receive messages for the specified
// direction.
func NewReceiver(dir Direction, secret *Secret, sessToken, sessCsrf string) *Receiver {
	sm := make(map[string]bool)
	ch := make(chan *Msg, 10)
	return &Receiver{direction: dir, secret: secret, seen: sm, Msgs: ch, sessToken: sessToken, sessCsrf: sessCsrf}
}

// Poll calls Receive until it gets ErrProtocolEOF.
func (r *Receiver) Poll(m *Meta) {
	for {
		_, err := r.Receive(m)
		if err == ErrProtocolEOF {
			G.Log.Debug("polling stopping due to EOF")
			return
		}
		if r.done {
			G.Log.Debug("polling stopping due to done flag")
			return
		}
	}
}

// Next gets messages from the message channel, looking for one
// that matches name.  If none are received for the duration of
// timeout, it will return libkb.ErrTimeout.  If the channel is
// closed, it will return ErrProtocolEOF.
func (r *Receiver) Next(name MsgName, timeout time.Duration) (*Msg, error) {
	for {
		select {
		case m, ok := <-r.Msgs:
			if !ok {
				r.done = true
				return nil, ErrProtocolEOF
			}
			if m.Name() == name {
				return m, nil
			}
			if m.Name() == CancelMsg {
				r.done = true
				return nil, libkb.CanceledError{}
			}

			G.Log.Info("message name: %s, expecting %s.  Ignoring this message.", m.Name, name)

		case <-time.After(timeout):
			G.Log.Info("timed out waiting for message %s", name)
			r.done = true
			return nil, libkb.ErrTimeout
		}
	}
}

// Receive gets the next set of messages from the server and
// routes them to the handler.  It returns the number of messages
// it received successfully.
func (r *Receiver) Receive(m *Meta) (int, error) {
	msgs, err := r.get()
	if err != nil {
		return 0, err
	}
	var count int
	for _, msg := range msgs {

		if err := r.check(msg); err != nil {
			G.Log.Warning("[%s] message failed check: %s", msg, err)
			continue
		}

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

		// set meta's sender and receiver
		m.Sender = msg.Sender
		m.Receiver = msg.Receiver

		r.Msgs <- msg

		count++

		// if the message has the EOF flag set, we are done receiving messages
		// so break out now.
		if msg.Body.EOF {
			close(r.Msgs)
			return count, ErrProtocolEOF
		}
	}

	return count, nil
}

// Cancel stops the reciever.
func (r *Receiver) Cancel() error {
	close(r.Msgs)
	return nil
}

// check verifies the validity of the message.  It checks the
// HMAC, the StrongID (I), and the WeakID (w).
func (r *Receiver) check(msg *Msg) error {
	// verify that the HMAC matches
	sum, err := msg.MacSum(r.secret.Secret())
	if err != nil {
		return err
	}
	if !hmac.Equal(sum, msg.Body.Mac) {
		return ErrMACMismatch
	}

	if !hmac.Equal(r.secret.StrongIDSlice(), msg.StrongID[:]) {
		return ErrStrongIDMismatch
	}

	if !hmac.Equal(r.secret.WeakIDSlice(), msg.WeakID[:]) {
		return ErrWeakIDMismatch
	}

	return nil
}

// get performs a Get request to long poll for a set of messages.
func (r *Receiver) get() (MsgList, error) {
	libkb.G.Log.Debug("get: {dir: %d, seqno: %d, w = %s}", r.direction, r.seqno, r.secret.WeakID())

	var j struct {
		Msgs MsgList `json:"msgs"`
	}
	args := libkb.ApiArg{
		Endpoint:    "kex/receive",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"w":    r.secret.WeakID(),
			"dir":  libkb.I{Val: int(r.direction)},
			"low":  libkb.I{Val: r.seqno + 1},
			"poll": libkb.I{Val: int(PollDuration / time.Second)},
		},
		SessionR: r,
	}
	if err := libkb.G.API.GetDecode(args, &j); err != nil {
		return nil, err
	}

	sort.Sort(j.Msgs)

	return j.Msgs, nil
}

func (r *Receiver) APIArgs() (token, csrf string) {
	return r.sessToken, r.sessCsrf
}
