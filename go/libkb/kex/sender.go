package kex

import (
	"encoding/hex"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// Sender is an implementation of the kex Handler interface that
// sends messages to the api server.
type Sender struct {
	seqno     chan int
	direction Direction
	secret    SecretKey
	sessToken string // api session token
	sessCsrf  string // api session csrf
	done      chan struct{}
	libkb.Contextified
}

// NewSender creates a Sender for the given message direction.
func NewSender(dir Direction, secret SecretKey, sessToken, sessCsrf string, gc *libkb.GlobalContext) *Sender {
	s := &Sender{
		seqno:        make(chan int),
		direction:    dir,
		secret:       secret,
		sessToken:    sessToken,
		sessCsrf:     sessCsrf,
		done:         make(chan struct{}),
		Contextified: libkb.NewContextified(gc),
	}
	go s.sequence()
	return s
}

// StartKexSession sends the StartKexSession message to the
// server.
func (s *Sender) StartKexSession(m *Meta, id StrongID) error {
	mb := &Body{Name: StartKexMsg, Args: MsgArgs{StrongID: id}}
	return s.send(m, mb)
}

// StartReverseKexSession sends the StartReverseKexSession message
// to the server.
func (s *Sender) StartReverseKexSession(m *Meta) error {
	return nil
}

// Hello sends the Hello message to the server.
func (s *Sender) Hello(m *Meta, devID keybase1.DeviceID, devKeyID keybase1.KID) error {
	mb := &Body{Name: HelloMsg, Args: MsgArgs{DeviceID: devID, DevKeyID: devKeyID}}
	return s.send(m, mb)
}

// PleaseSign sends the PleaseSign message to the server.
func (s *Sender) PleaseSign(m *Meta, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	mb := &Body{Name: PleaseSignMsg, Args: MsgArgs{SigningKey: eddsa, Sig: sig, DevType: devType, DevDesc: devDesc}, EOF: true}
	return s.send(m, mb)
}

// Done sends the Done message to the server.
func (s *Sender) Done(m *Meta) error {
	mb := &Body{Name: DoneMsg, EOF: true}
	err := s.send(m, mb)
	close(s.done)
	return err
}

// Cancel sends the Cancel message to the server.
func (s *Sender) Cancel(m *Meta) error {
	mb := &Body{Name: CancelMsg, EOF: true}
	err := s.send(m, mb)
	close(s.done)
	return err
}

// CorruptStartKexSession sends a startkex message with a
// corrupted MAC.  This is for testing, clearly.  It's an exposed
// function since only an engine test can test this.
func (s *Sender) CorruptStartKexSession(m *Meta, id StrongID) error {
	mb := &Body{Name: StartKexMsg, Args: MsgArgs{StrongID: id}}
	msg, err := s.genMsg(m, mb)
	if err != nil {
		return err
	}
	// flip bits in first byte of mac to corrupt it
	msg.Body.Mac[0] = ^msg.Body.Mac[0]
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
	msg.Seqno = <-s.seqno
	mac, err := msg.MacSum(s.secret)
	if err != nil {
		return nil, err
	}
	msg.Body.Mac = mac
	return msg, nil
}

func (s *Sender) post(msg *Msg) error {
	menc, err := msg.Body.Encode()
	if err != nil {
		return err
	}

	libkb.G.Log.Debug("posting message %s {dir: %d, seqno: %d, w: %x, uid: %x}", msg.Name(), msg.Direction, msg.Seqno, msg.WeakID, msg.UID)

	_, err = s.G().API.Post(libkb.APIArg{
		Endpoint:    "kex/send",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"dir":      libkb.I{Val: int(msg.Direction)},
			"I":        libkb.S{Val: hex.EncodeToString(msg.StrongID[:])},
			"msg":      libkb.S{Val: menc},
			"receiver": libkb.S{Val: msg.Receiver.String()},
			"sender":   libkb.S{Val: msg.Sender.String()},
			"seqno":    libkb.I{Val: msg.Seqno},
			"w":        libkb.S{Val: hex.EncodeToString(msg.WeakID[:])},
		},
		Contextified: libkb.NewContextified(s.G()),
		SessionR:     s,
	})
	return err
}

func (s *Sender) APIArgs() (token, csrf string) {
	return s.sessToken, s.sessCsrf
}

func (s *Sender) sequence() {
	n := 1
	for {
		select {
		case s.seqno <- n:
			n++
		case <-s.done:
			return
		}
	}
}
