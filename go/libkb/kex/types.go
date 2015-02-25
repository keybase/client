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
	Src       libkb.DeviceID
	Dst       libkb.DeviceID
	Seqno     int
	Direction Direction
}

type Context struct {
	Meta
}

func (c *Context) Swap() {
	c.Src, c.Dst = c.Dst, c.Src
}

type Handler interface {
	StartKexSession(ctx *Context, id StrongID) error
	StartReverseKexSession(ctx *Context) error
	Hello(ctx *Context, devID libkb.DeviceID, devKeyID libkb.KID) error
	PleaseSign(ctx *Context, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error
	Done(ctx *Context, mt libkb.MerkleTriple) error

	// XXX get rid of this when real client comm works
	RegisterTestDevice(srv Handler, device libkb.DeviceID) error
}
