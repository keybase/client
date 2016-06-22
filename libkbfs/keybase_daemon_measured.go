// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// KeybaseDaemonMeasured delegates to another KeybaseDaemon instance
// but also keeps track of stats.
type KeybaseDaemonMeasured struct {
	delegate                KeybaseDaemon
	resolveTimer            metrics.Timer
	identifyTimer           metrics.Timer
	loadUserPlusKeysTimer   metrics.Timer
	loadUnverifiedKeysTimer metrics.Timer
	currentSessionTimer     metrics.Timer
	favoriteAddTimer        metrics.Timer
	favoriteDeleteTimer     metrics.Timer
	favoriteListTimer       metrics.Timer
	notifyTimer             metrics.Timer
}

var _ KeybaseDaemon = KeybaseDaemonMeasured{}

// NewKeybaseDaemonMeasured creates and returns a new KeybaseDaemonMeasured
// instance with the given delegate and registry.
func NewKeybaseDaemonMeasured(delegate KeybaseDaemon, r metrics.Registry) KeybaseDaemonMeasured {
	resolveTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.Resolve", r)
	identifyTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.Identify", r)
	loadUserPlusKeysTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.LoadUserPlusKeys", r)
	loadUnverifiedKeysTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.LoadUnverifiedKeys", r)
	currentSessionTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.CurrentSession", r)
	favoriteAddTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.FavoriteAdd", r)
	favoriteDeleteTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.FavoriteDelete", r)
	favoriteListTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.FavoriteList", r)
	notifyTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.Notify", r)
	return KeybaseDaemonMeasured{
		delegate:                delegate,
		resolveTimer:            resolveTimer,
		identifyTimer:           identifyTimer,
		loadUserPlusKeysTimer:   loadUserPlusKeysTimer,
		loadUnverifiedKeysTimer: loadUnverifiedKeysTimer,
		currentSessionTimer:     currentSessionTimer,
		favoriteAddTimer:        favoriteAddTimer,
		favoriteDeleteTimer:     favoriteDeleteTimer,
		favoriteListTimer:       favoriteListTimer,
		notifyTimer:             notifyTimer,
	}
}

// Resolve implements the KeybaseDaemon interface for KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) Resolve(ctx context.Context, assertion string) (
	name libkb.NormalizedUsername, uid keybase1.UID, err error) {
	k.resolveTimer.Time(func() {
		name, uid, err = k.delegate.Resolve(ctx, assertion)
	})
	return name, uid, err
}

// Identify implements the KeybaseDaemon interface for KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) Identify(ctx context.Context, assertion, reason string) (
	userInfo UserInfo, err error) {
	k.identifyTimer.Time(func() {
		userInfo, err = k.delegate.Identify(ctx, assertion, reason)
	})
	return userInfo, err
}

// LoadUserPlusKeys implements the KeybaseDaemon interface for KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) LoadUserPlusKeys(ctx context.Context, uid keybase1.UID) (
	userInfo UserInfo, err error) {
	k.loadUserPlusKeysTimer.Time(func() {
		userInfo, err = k.delegate.LoadUserPlusKeys(ctx, uid)
	})
	return userInfo, err
}

// LoadUnverifiedKeys implements the KeybaseDaemon interface for KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) LoadUnverifiedKeys(ctx context.Context, uid keybase1.UID) (
	verifyingKeys []VerifyingKey, cryptKeys []CryptPublicKey, err error) {
	k.loadUnverifiedKeysTimer.Time(func() {
		verifyingKeys, cryptKeys, err = k.delegate.LoadUnverifiedKeys(ctx, uid)
	})
	return verifyingKeys, cryptKeys, err
}

// CurrentSession implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) CurrentSession(ctx context.Context, sessionID int) (
	sessionInfo SessionInfo, err error) {
	k.currentSessionTimer.Time(func() {
		sessionInfo, err = k.delegate.CurrentSession(ctx, sessionID)
	})
	return sessionInfo, err
}

// FavoriteAdd implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) FavoriteAdd(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteAddTimer.Time(func() {
		err = k.delegate.FavoriteAdd(ctx, folder)
	})
	return err
}

// FavoriteDelete implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) FavoriteDelete(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteDeleteTimer.Time(func() {
		err = k.delegate.FavoriteDelete(ctx, folder)
	})
	return err
}

// FavoriteList implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) FavoriteList(ctx context.Context, sessionID int) (
	favorites []keybase1.Folder, err error) {
	k.favoriteListTimer.Time(func() {
		favorites, err = k.delegate.FavoriteList(ctx, sessionID)
	})
	return favorites, err
}

// Notify implements the KeybaseDaemon interface for KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) Notify(ctx context.Context, notification *keybase1.FSNotification) (err error) {
	k.notifyTimer.Time(func() {
		err = k.delegate.Notify(ctx, notification)
	})
	return err
}

// FlushUserFromLocalCache implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) FlushUserFromLocalCache(
	ctx context.Context, uid keybase1.UID) {
	k.delegate.FlushUserFromLocalCache(ctx, uid)
}

// Shutdown implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) Shutdown() {
	k.delegate.Shutdown()
}
