// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// KeybaseServiceMeasured delegates to another KeybaseService instance
// but also keeps track of stats.
type KeybaseServiceMeasured struct {
	delegate                  KeybaseService
	resolveTimer              metrics.Timer
	identifyTimer             metrics.Timer
	loadUserPlusKeysTimer     metrics.Timer
	loadTeamPlusKeysTimer     metrics.Timer
	loadUnverifiedKeysTimer   metrics.Timer
	getCurrentMerkleRootTimer metrics.Timer
	currentSessionTimer       metrics.Timer
	favoriteAddTimer          metrics.Timer
	favoriteDeleteTimer       metrics.Timer
	favoriteListTimer         metrics.Timer
	notifyTimer               metrics.Timer
}

var _ KeybaseService = KeybaseServiceMeasured{}

// NewKeybaseServiceMeasured creates and returns a new KeybaseServiceMeasured
// instance with the given delegate and registry.
func NewKeybaseServiceMeasured(delegate KeybaseService, r metrics.Registry) KeybaseServiceMeasured {
	resolveTimer := metrics.GetOrRegisterTimer("KeybaseService.Resolve", r)
	identifyTimer := metrics.GetOrRegisterTimer("KeybaseService.Identify", r)
	loadUserPlusKeysTimer := metrics.GetOrRegisterTimer("KeybaseService.LoadUserPlusKeys", r)
	loadTeamPlusKeysTimer := metrics.GetOrRegisterTimer("KeybaseService.LoadTeamPlusKeys", r)
	loadUnverifiedKeysTimer := metrics.GetOrRegisterTimer("KeybaseService.LoadUnverifiedKeys", r)
	getCurrentMerkleRootTimer := metrics.GetOrRegisterTimer("KeybaseService.GetCurrentMerkleRoot", r)
	currentSessionTimer := metrics.GetOrRegisterTimer("KeybaseService.CurrentSession", r)
	favoriteAddTimer := metrics.GetOrRegisterTimer("KeybaseService.FavoriteAdd", r)
	favoriteDeleteTimer := metrics.GetOrRegisterTimer("KeybaseService.FavoriteDelete", r)
	favoriteListTimer := metrics.GetOrRegisterTimer("KeybaseService.FavoriteList", r)
	notifyTimer := metrics.GetOrRegisterTimer("KeybaseService.Notify", r)
	return KeybaseServiceMeasured{
		delegate:                  delegate,
		resolveTimer:              resolveTimer,
		identifyTimer:             identifyTimer,
		loadUserPlusKeysTimer:     loadUserPlusKeysTimer,
		loadTeamPlusKeysTimer:     loadTeamPlusKeysTimer,
		loadUnverifiedKeysTimer:   loadUnverifiedKeysTimer,
		getCurrentMerkleRootTimer: getCurrentMerkleRootTimer,
		currentSessionTimer:       currentSessionTimer,
		favoriteAddTimer:          favoriteAddTimer,
		favoriteDeleteTimer:       favoriteDeleteTimer,
		favoriteListTimer:         favoriteListTimer,
		notifyTimer:               notifyTimer,
	}
}

// Resolve implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Resolve(ctx context.Context, assertion string) (
	name libkb.NormalizedUsername, uid keybase1.UserOrTeamID, err error) {
	k.resolveTimer.Time(func() {
		name, uid, err = k.delegate.Resolve(ctx, assertion)
	})
	return name, uid, err
}

// Identify implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Identify(ctx context.Context, assertion, reason string) (
	name libkb.NormalizedUsername, id keybase1.UserOrTeamID, err error) {
	k.identifyTimer.Time(func() {
		name, id, err = k.delegate.Identify(ctx, assertion, reason)
	})
	return name, id, err
}

// LoadUserPlusKeys implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) LoadUserPlusKeys(ctx context.Context,
	uid keybase1.UID, pollForKID keybase1.KID) (userInfo UserInfo, err error) {
	k.loadUserPlusKeysTimer.Time(func() {
		userInfo, err = k.delegate.LoadUserPlusKeys(ctx, uid, pollForKID)
	})
	return userInfo, err
}

// LoadTeamPlusKeys implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) LoadTeamPlusKeys(ctx context.Context,
	tid keybase1.TeamID, desiredKeyGen KeyGen, desiredUser keybase1.UserVersion,
	desiredRole keybase1.TeamRole) (teamInfo TeamInfo, err error) {
	k.loadTeamPlusKeysTimer.Time(func() {
		teamInfo, err = k.delegate.LoadTeamPlusKeys(
			ctx, tid, desiredKeyGen, desiredUser, desiredRole)
	})
	return teamInfo, err
}

// GetCurrentMerkleRoot implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) GetCurrentMerkleRoot(ctx context.Context) (
	root keybase1.MerkleRootV2, err error) {
	k.getCurrentMerkleRootTimer.Time(func() {
		root, err = k.delegate.GetCurrentMerkleRoot(ctx)
	})
	return root, err
}

// LoadUnverifiedKeys implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) LoadUnverifiedKeys(ctx context.Context, uid keybase1.UID) (
	keys []keybase1.PublicKey, err error) {
	k.loadUnverifiedKeysTimer.Time(func() {
		keys, err = k.delegate.LoadUnverifiedKeys(ctx, uid)
	})
	return keys, err
}

// CurrentSession implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) CurrentSession(ctx context.Context, sessionID int) (
	sessionInfo SessionInfo, err error) {
	k.currentSessionTimer.Time(func() {
		sessionInfo, err = k.delegate.CurrentSession(ctx, sessionID)
	})
	return sessionInfo, err
}

// FavoriteAdd implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FavoriteAdd(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteAddTimer.Time(func() {
		err = k.delegate.FavoriteAdd(ctx, folder)
	})
	return err
}

// FavoriteDelete implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FavoriteDelete(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteDeleteTimer.Time(func() {
		err = k.delegate.FavoriteDelete(ctx, folder)
	})
	return err
}

// FavoriteList implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FavoriteList(ctx context.Context, sessionID int) (
	favorites []keybase1.Folder, err error) {
	k.favoriteListTimer.Time(func() {
		favorites, err = k.delegate.FavoriteList(ctx, sessionID)
	})
	return favorites, err
}

// Notify implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Notify(ctx context.Context, notification *keybase1.FSNotification) (err error) {
	k.notifyTimer.Time(func() {
		err = k.delegate.Notify(ctx, notification)
	})
	return err
}

// NotifySyncStatus implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) NotifySyncStatus(ctx context.Context,
	status *keybase1.FSPathSyncStatus) (err error) {
	k.notifyTimer.Time(func() {
		err = k.delegate.NotifySyncStatus(ctx, status)
	})
	return err
}

// FlushUserFromLocalCache implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FlushUserFromLocalCache(
	ctx context.Context, uid keybase1.UID) {
	k.delegate.FlushUserFromLocalCache(ctx, uid)
}

// FlushUserUnverifiedKeysFromLocalCache implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FlushUserUnverifiedKeysFromLocalCache(
	ctx context.Context, uid keybase1.UID) {
	k.delegate.FlushUserUnverifiedKeysFromLocalCache(ctx, uid)
}

// EstablishMountDir implements the KeybaseDaemon interface for KeybaseDaemonLocal.
func (k KeybaseServiceMeasured) EstablishMountDir(ctx context.Context) (string, error) {
	return k.delegate.EstablishMountDir(ctx)
}

// Shutdown implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Shutdown() {
	k.delegate.Shutdown()
}
