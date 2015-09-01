package kex

import (
	"crypto/hmac"
	"encoding/hex"
	"sort"
	"time"

	"github.com/keybase/client/go/libkb"
)

// HelloTimeout is the time the kex protocol will wait for the
// hello message from the existing sibling device.  It is long
// because it might take the user a while to access the existing
// device.
var HelloTimeout = 5 * time.Minute

// StartTimeout is the duration the existing sibling device will
// wait for a start message.  It is very short because the message
// should be on the server already.  If there are no messages
// waiting, then the secret phrase is likely incorrect.
var StartTimeout = 1 * time.Second

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
	done      chan struct{}
	sessToken string // api session token
	sessCsrf  string // api session csrf
	errs      chan error
	libkb.Contextified
}

// NewReceiver creates a Receiver that will route messages to the
// provided handler.  It will receive messages for the specified
// direction.
func NewReceiver(dir Direction, secret *Secret, sessToken, sessCsrf string, g *libkb.GlobalContext) *Receiver {
	sm := make(map[string]bool)
	return &Receiver{
		direction:    dir,
		secret:       secret,
		seen:         sm,
		Msgs:         make(chan *Msg, 10),
		errs:         make(chan error),
		sessToken:    sessToken,
		sessCsrf:     sessCsrf,
		done:         make(chan struct{}),
		Contextified: libkb.NewContextified(g),
	}
}

// Poll calls Receive until it gets ErrProtocolEOF.
func (r *Receiver) Poll(m *Meta) {
	for {
		_, err := r.Receive(m)
		if err == ErrProtocolEOF {
			r.G().Log.Debug("polling stopping due to EOF")
			return
		}
		if err != nil {
			if _, ok := err.(libkb.AppStatusError); ok {
				r.errs <- err
				return
			}
			r.G().Log.Debug("kex receiver poll continuing even though got error: %s (%T)", err, err)
		}
		select {
		case <-r.done:
			r.G().Log.Debug("polling stopping due to done chan closed")
			return
		default:
			continue
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
				close(r.done)
				return nil, ErrProtocolEOF
			}
			if m.Name() == name {
				return m, nil
			}
			if m.Name() == CancelMsg {
				close(r.done)
				return nil, libkb.CanceledError{}
			}

			r.G().Log.Info("message name: %s, expecting %s.  Ignoring this message.", m.Name(), name)
		case err := <-r.errs:
			r.G().Log.Info("error waiting for message %s: %s", name, err)
			return nil, err

		case <-time.After(timeout):
			r.G().Log.Info("timed out waiting for message %s", name)
			close(r.done)
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
			r.G().Log.Warning("[%s] message failed check: %s", msg, err)
			continue
		}

		// check to see if this receiver has seen this message before
		smac := hex.EncodeToString(msg.Body.Mac)
		if r.seen[smac] {
			r.G().Log.Warning("skipping message [%s:%s]: already seen", msg.Name(), smac)
			continue
		}

		r.seen[smac] = true

		if msg.Seqno > r.seqno {
			r.seqno = msg.Seqno
		}

		r.G().Log.Debug("received message [%s]", msg.Name())

		// set meta's sender and receiver
		// XXX why?
		// m.Sender = msg.Sender
		// m.Receiver = msg.Receiver

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
	r.G().Log.Debug("kex Receiver cancel")
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
	r.G().Log.Debug("get: {dir: %d, seqno: %d, w = %s}", r.direction, r.seqno, r.secret.WeakID())

	var j struct {
		Msgs   MsgList `json:"msgs"`
		Status struct {
			Code int    `json:"code"`
			Name string `json:"name"`
			Desc string `json:"desc"`
		}
	}
	args := libkb.APIArg{
		Endpoint:    "kex/receive",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"w":    r.secret.WeakID(),
			"dir":  libkb.I{Val: int(r.direction)},
			"low":  libkb.I{Val: r.seqno + 1},
			"poll": libkb.I{Val: int(PollDuration / time.Second)},
		},
		SessionR: r,
	}
	if err := r.G().API.GetDecode(args, &j); err != nil {
		return nil, err
	}
	if j.Status.Code != libkb.SCOk {
		return nil, libkb.AppStatusError{Code: j.Status.Code, Name: j.Status.Name, Desc: j.Status.Desc}
	}

	sort.Sort(j.Msgs)

	return j.Msgs, nil
}

func (r *Receiver) APIArgs() (token, csrf string) {
	return r.sessToken, r.sessCsrf
}
