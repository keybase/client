package kex

import (
	"github.com/keybase/client/go/libkb"
)

type Direction int

const (
	DirectionYtoX Direction = 1 // messages intended for device X
	DirectionXtoY           = 2 // messages intended for device Y
)

type StrongID [32]byte
type WeakID [16]byte

type Meta struct {
	UID       libkb.UID
	WeakID    WeakID   // `w` in doc
	StrongID  StrongID // `I` in doc
	Sender    libkb.DeviceID
	Receiver  libkb.DeviceID
	Seqno     int
	Direction Direction
}

func NewMeta(uid libkb.UID, strong StrongID, sender, receiver libkb.DeviceID, dir Direction) *Meta {
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

func (m *Meta) Swap() {
	m.Sender, m.Receiver = m.Receiver, m.Sender
}

type Handler interface {
	StartKexSession(m *Meta, id StrongID) error
	StartReverseKexSession(m *Meta) error
	Hello(m *Meta, devID libkb.DeviceID, devKeyID libkb.KID) error
	PleaseSign(m *Meta, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error
	Done(m *Meta, mt libkb.MerkleTriple) error

	// XXX get rid of this when real client comm works
	RegisterTestDevice(srv Handler, device libkb.DeviceID) error
}
