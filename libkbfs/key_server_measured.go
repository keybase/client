// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/protocol/keybase1"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// KeyServerMeasured delegates to another KeyServer instance but
// also keeps track of stats.
type KeyServerMeasured struct {
	delegate    KeyServer
	getTimer    metrics.Timer
	putTimer    metrics.Timer
	deleteTimer metrics.Timer
}

var _ KeyServer = KeyServerMeasured{}

// NewKeyServerMeasured creates and returns a new KeyServerMeasured
// instance with the given delegate and registry.
func NewKeyServerMeasured(delegate KeyServer, r metrics.Registry) KeyServerMeasured {
	getTimer := metrics.GetOrRegisterTimer("KeyServer.GetTLFCryptKeyServerHalf", r)
	putTimer := metrics.GetOrRegisterTimer("KeyServer.PutTLFCryptKeyServerHalves", r)
	deleteTimer := metrics.GetOrRegisterTimer("KeyServer.DeleteTLFCryptKeyServerHalf", r)
	return KeyServerMeasured{
		delegate:    delegate,
		getTimer:    getTimer,
		putTimer:    putTimer,
		deleteTimer: deleteTimer,
	}
}

// GetTLFCryptKeyServerHalf implements the KeyServer interface for
// KeyServerMeasured.
func (b KeyServerMeasured) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID TLFCryptKeyServerHalfID, key CryptPublicKey) (
	serverHalf TLFCryptKeyServerHalf, err error) {
	b.getTimer.Time(func() {
		serverHalf, err = b.delegate.GetTLFCryptKeyServerHalf(ctx, serverHalfID, key)
	})
	return serverHalf, err
}

// PutTLFCryptKeyServerHalves implements the KeyServer interface for
// KeyServerMeasured.
func (b KeyServerMeasured) PutTLFCryptKeyServerHalves(ctx context.Context,
	serverKeyHalves map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf) (err error) {
	b.putTimer.Time(func() {
		err = b.delegate.PutTLFCryptKeyServerHalves(ctx, serverKeyHalves)
	})
	return err
}

// DeleteTLFCryptKeyServerHalf implements the KeyServer interface for
// KeyServerMeasured.
func (b KeyServerMeasured) DeleteTLFCryptKeyServerHalf(ctx context.Context,
	uid keybase1.UID, kid keybase1.KID,
	serverHalfID TLFCryptKeyServerHalfID) (err error) {
	b.deleteTimer.Time(func() {
		err = b.delegate.DeleteTLFCryptKeyServerHalf(
			ctx, uid, kid, serverHalfID)
	})
	return err
}

// Shutdown implements the KeyServer interface for KeyServerMeasured.
func (b KeyServerMeasured) Shutdown() {
	b.delegate.Shutdown()
}
