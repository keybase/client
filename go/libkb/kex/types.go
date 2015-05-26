package kex

import (
	"encoding/hex"
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// Direction of the message.  From device X to device Y, or from
// device Y to device X.
type Direction int

const (
	// DirectionYtoX is for messages intended for device X from device Y
	DirectionYtoX Direction = 1
	// DirectionXtoY is for messages intended for device Y from device X
	DirectionXtoY = 2
)

// StrongID is the strong session id type.
type StrongID [32]byte

// String returns a hex encoding of StrongID.
func (s StrongID) String() string {
	return hex.EncodeToString(s[:])
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (s *StrongID) UnmarshalJSON(data []byte) error {
	b, err := libkb.HexDecodeQuoted(data)
	if err != nil {
		return err
	}
	copy(s[:], b)
	return nil
}

// WeakID is the weak session id type.
type WeakID [16]byte

// String returns a hex encoding of WeakID.
func (w WeakID) String() string {
	return hex.EncodeToString(w[:])
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (w *WeakID) UnmarshalJSON(data []byte) error {
	b, err := libkb.HexDecodeQuoted(data)
	if err != nil {
		return err
	}
	copy(w[:], b)
	return nil
}

// SecretKey is the shared secret key type.
type SecretKey [32]byte

// Meta is the metadata that is sent with every kex message.
type Meta struct {
	UID       keybase1.UID
	WeakID    WeakID   `json:"w"` // `w` in doc
	StrongID  StrongID `json:"I"` // `I` in doc
	Sender    libkb.DeviceID
	Receiver  libkb.DeviceID
	Seqno     int
	Direction Direction `json:"dir"`
}

// NewMeta creates a new Meta object.  Its main utility is
// creating the WeakID based off of the StrongID.
func NewMeta(uid keybase1.UID, strong StrongID, sender, receiver libkb.DeviceID, dir Direction) *Meta {
	m := &Meta{
		UID:       uid,
		StrongID:  strong,
		Sender:    sender,
		Receiver:  receiver,
		Direction: dir,
	}
	copy(m.WeakID[:], m.StrongID[0:16])
	return m
}

// Swap exchanges Sender and Receiver.
func (m *Meta) Swap() {
	m.Sender, m.Receiver = m.Receiver, m.Sender
}

// Handler is the key exchange protocol interface.  Anything
// receiving kex messages will implement this, as well as anything
// sending kex messages.
type Handler interface {
	StartKexSession(m *Meta, id StrongID) error
	StartReverseKexSession(m *Meta) error
	Hello(m *Meta, devID libkb.DeviceID, devKeyID libkb.KID) error
	PleaseSign(m *Meta, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error
	Done(m *Meta) error
	Cancel(m *Meta) error
}

// ErrProtocolEOF is returned by Receive when the message body has
// the EOF flag set.
var ErrProtocolEOF = errors.New("EOF")
