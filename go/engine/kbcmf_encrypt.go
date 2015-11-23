// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type KBCMFEncryptArg struct {
	Recips       []string // user assertions
	Source       io.Reader
	Sink         io.WriteCloser
	TrackOptions keybase1.TrackOptions
}

// KBCMFEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type KBCMFEncrypt struct {
	arg *KBCMFEncryptArg
	libkb.Contextified
}

// NewKBCMFEncrypt creates a KBCMFEncrypt engine.
func NewKBCMFEncrypt(arg *KBCMFEncryptArg, g *libkb.GlobalContext) *KBCMFEncrypt {
	return &KBCMFEncrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *KBCMFEncrypt) Name() string {
	return "KBCMFEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *KBCMFEncrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *KBCMFEncrypt) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine.
func (e *KBCMFEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceKeyfinder{},
	}
}

// Run starts the engine.
func (e *KBCMFEncrypt) Run(ctx *Context) (err error) {
	kfarg := &DeviceKeyfinderArg{
		Users:        e.arg.Recips,
		TrackOptions: e.arg.TrackOptions,
	}

	kf := NewDeviceKeyfinder(kfarg, e.G())
	if err := RunEngine(kf, ctx); err != nil {
		return err
	}

	ks := newDeviceKeyset()

	uplus := kf.UsersPlusDeviceKeys()
	for _, up := range uplus {
		for _, k := range up.Keys {
			ks.Add(k)
		}
	}

	recipients := ks.Sorted()
	return libkb.KBCMFEncrypt(e.arg.Source, e.arg.Sink, recipients)
}

// deviceKeyset maintains a set of device keys, preserving insertion order.
type deviceKeyset struct {
	index []keybase1.KID
	keys  map[keybase1.KID]keybase1.PublicKey
}

// newDeviceKeyset creates an empty deviceKeyset.
func newDeviceKeyset() *deviceKeyset {
	return &deviceKeyset{keys: make(map[keybase1.KID]keybase1.PublicKey)}
}

// Add adds bundle to the deviceKeyset.  If a key already exists, it
// will be ignored.
func (k *deviceKeyset) Add(pk keybase1.PublicKey) {
	kid := pk.KID
	if _, ok := k.keys[kid]; ok {
		return
	}
	k.keys[kid] = pk
	k.index = append(k.index, kid)
}

// Sorted returns the unique keys in insertion order.
func (k *deviceKeyset) Sorted() []keybase1.PublicKey {
	var sorted []keybase1.PublicKey
	for _, kid := range k.index {
		sorted = append(sorted, k.keys[kid])
	}
	return sorted
}
