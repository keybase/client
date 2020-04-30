// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"time"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// KeybaseServiceMeasured delegates to another KeybaseService instance
// but also keeps track of stats.
type KeybaseServiceMeasured struct {
	delegate                         KeybaseService
	resolveTimer                     metrics.Timer
	identifyTimer                    metrics.Timer
	normalizeSocialAssertionTimer    metrics.Timer
	resolveIdentifyImplicitTeamTimer metrics.Timer
	resolveImplicitTeamByIDTimer     metrics.Timer
	loadUserPlusKeysTimer            metrics.Timer
	loadTeamPlusKeysTimer            metrics.Timer
	createTeamTLFTimer               metrics.Timer
	getTeamSettingsTimer             metrics.Timer
	getCurrentMerkleRootTimer        metrics.Timer
	verifyMerkleRootTimer            metrics.Timer
	currentSessionTimer              metrics.Timer
	favoriteAddTimer                 metrics.Timer
	favoriteDeleteTimer              metrics.Timer
	favoriteListTimer                metrics.Timer
	encryptFavoritesTimer            metrics.Timer
	decryptFavoritesTimer            metrics.Timer
	notifyTimer                      metrics.Timer
	notifyPathUpdatedTimer           metrics.Timer
	putGitMetadataTimer              metrics.Timer
	onPathChangeTimer                metrics.Timer
	onChangeTimer                    metrics.Timer
}

var _ KeybaseService = KeybaseServiceMeasured{}

// NewKeybaseServiceMeasured creates and returns a new KeybaseServiceMeasured
// instance with the given delegate and registry.
func NewKeybaseServiceMeasured(delegate KeybaseService, r metrics.Registry) KeybaseServiceMeasured {
	resolveTimer := metrics.GetOrRegisterTimer("KeybaseService.Resolve", r)
	identifyTimer := metrics.GetOrRegisterTimer("KeybaseService.Identify", r)
	normalizeSocialAssertionTimer := metrics.GetOrRegisterTimer("KeybaseService.NormalizeSocialAssertion", r)
	resolveIdentifyImplicitTeamTimer := metrics.GetOrRegisterTimer(
		"KeybaseService.ResolveIdentifyImplicitTeam", r)
	resolveImplicitTeamByIDTimer := metrics.GetOrRegisterTimer(
		"KeybaseService.ResolveImplicitTeamByID", r)
	loadUserPlusKeysTimer := metrics.GetOrRegisterTimer("KeybaseService.LoadUserPlusKeys", r)
	loadTeamPlusKeysTimer := metrics.GetOrRegisterTimer("KeybaseService.LoadTeamPlusKeys", r)
	createTeamTLFTimer := metrics.GetOrRegisterTimer("KeybaseService.CreateTeamTLF", r)
	getTeamSettingsTimer := metrics.GetOrRegisterTimer("KeybaseService.GetTeamSettings", r)
	getCurrentMerkleRootTimer := metrics.GetOrRegisterTimer("KeybaseService.GetCurrentMerkleRoot", r)
	verifyMerkleRootTimer := metrics.GetOrRegisterTimer("KeybaseService.VerifyMerkleRoot", r)
	currentSessionTimer := metrics.GetOrRegisterTimer("KeybaseService.CurrentSession", r)
	favoriteAddTimer := metrics.GetOrRegisterTimer("KeybaseService.FavoriteAdd", r)
	favoriteDeleteTimer := metrics.GetOrRegisterTimer("KeybaseService.FavoriteDelete", r)
	favoriteListTimer := metrics.GetOrRegisterTimer("KeybaseService.FavoriteList", r)
	encryptFavoritesTimer := metrics.GetOrRegisterTimer("KeybaseService."+
		"EncryptFavorites", r)
	decryptFavoritesTimer := metrics.GetOrRegisterTimer("KeybaseService."+
		"DecryptFavorites", r)
	notifyTimer := metrics.GetOrRegisterTimer("KeybaseService.Notify", r)
	notifyPathUpdatedTimer := metrics.GetOrRegisterTimer("KeybaseService.NotifyPathUpdated", r)
	putGitMetadataTimer := metrics.GetOrRegisterTimer(
		"KeybaseService.PutGitMetadata", r)
	onPathChangeTimer := metrics.GetOrRegisterTimer(
		"KeybaseService.OnPathChangeTimer", r)
	onChangeTimer := metrics.GetOrRegisterTimer(
		"KeybaseService.OnChangeTimer", r)
	return KeybaseServiceMeasured{
		delegate:                         delegate,
		resolveTimer:                     resolveTimer,
		identifyTimer:                    identifyTimer,
		normalizeSocialAssertionTimer:    normalizeSocialAssertionTimer,
		resolveIdentifyImplicitTeamTimer: resolveIdentifyImplicitTeamTimer,
		resolveImplicitTeamByIDTimer:     resolveImplicitTeamByIDTimer,
		loadUserPlusKeysTimer:            loadUserPlusKeysTimer,
		loadTeamPlusKeysTimer:            loadTeamPlusKeysTimer,
		createTeamTLFTimer:               createTeamTLFTimer,
		getTeamSettingsTimer:             getTeamSettingsTimer,
		getCurrentMerkleRootTimer:        getCurrentMerkleRootTimer,
		verifyMerkleRootTimer:            verifyMerkleRootTimer,
		currentSessionTimer:              currentSessionTimer,
		favoriteAddTimer:                 favoriteAddTimer,
		favoriteDeleteTimer:              favoriteDeleteTimer,
		favoriteListTimer:                favoriteListTimer,
		encryptFavoritesTimer:            encryptFavoritesTimer,
		decryptFavoritesTimer:            decryptFavoritesTimer,
		notifyTimer:                      notifyTimer,
		notifyPathUpdatedTimer:           notifyPathUpdatedTimer,
		putGitMetadataTimer:              putGitMetadataTimer,
		onPathChangeTimer:                onPathChangeTimer,
		onChangeTimer:                    onChangeTimer,
	}
}

// Resolve implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Resolve(
	ctx context.Context, assertion string,
	offline keybase1.OfflineAvailability) (
	name kbname.NormalizedUsername, uid keybase1.UserOrTeamID, err error) {
	k.resolveTimer.Time(func() {
		name, uid, err = k.delegate.Resolve(ctx, assertion, offline)
	})
	return name, uid, err
}

// Identify implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	name kbname.NormalizedUsername, id keybase1.UserOrTeamID, err error) {
	k.identifyTimer.Time(func() {
		name, id, err = k.delegate.Identify(ctx, assertion, reason, offline)
	})
	return name, id, err
}

// NormalizeSocialAssertion implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (res keybase1.SocialAssertion, err error) {
	k.normalizeSocialAssertionTimer.Time(func() {
		res, err = k.delegate.NormalizeSocialAssertion(
			ctx, assertion)
	})
	return res, err
}

// ResolveIdentifyImplicitTeam implements the KeybaseService interface
// for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) ResolveIdentifyImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	doIdentifies bool, reason string, offline keybase1.OfflineAvailability) (
	info idutil.ImplicitTeamInfo, err error) {
	k.resolveIdentifyImplicitTeamTimer.Time(func() {
		info, err = k.delegate.ResolveIdentifyImplicitTeam(
			ctx, assertions, suffix, tlfType, doIdentifies, reason, offline)
	})
	return info, err
}

// ResolveImplicitTeamByID implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) ResolveImplicitTeamByID(
	ctx context.Context, teamID keybase1.TeamID) (name string, err error) {
	k.resolveImplicitTeamByIDTimer.Time(func() {
		name, err = k.delegate.ResolveImplicitTeamByID(ctx, teamID)
	})
	return name, err
}

// LoadUserPlusKeys implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) LoadUserPlusKeys(
	ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID,
	offline keybase1.OfflineAvailability) (userInfo idutil.UserInfo, err error) {
	k.loadUserPlusKeysTimer.Time(func() {
		userInfo, err = k.delegate.LoadUserPlusKeys(
			ctx, uid, pollForKID, offline)
	})
	return userInfo, err
}

// LoadTeamPlusKeys implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) LoadTeamPlusKeys(ctx context.Context,
	tid keybase1.TeamID, tlfType tlf.Type, desiredKeyGen kbfsmd.KeyGen,
	desiredUser keybase1.UserVersion, desiredKey kbfscrypto.VerifyingKey,
	desiredRole keybase1.TeamRole, offline keybase1.OfflineAvailability) (
	teamInfo idutil.TeamInfo, err error) {
	k.loadTeamPlusKeysTimer.Time(func() {
		teamInfo, err = k.delegate.LoadTeamPlusKeys(
			ctx, tid, tlfType, desiredKeyGen, desiredUser, desiredKey,
			desiredRole, offline)
	})
	return teamInfo, err
}

// CreateTeamTLF implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) CreateTeamTLF(
	ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) (err error) {
	k.createTeamTLFTimer.Time(func() {
		err = k.delegate.CreateTeamTLF(ctx, teamID, tlfID)
	})
	return err
}

// GetTeamSettings implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) GetTeamSettings(
	ctx context.Context, teamID keybase1.TeamID,
	offline keybase1.OfflineAvailability) (
	settings keybase1.KBFSTeamSettings, err error) {
	k.getTeamSettingsTimer.Time(func() {
		settings, err = k.delegate.GetTeamSettings(ctx, teamID, offline)
	})
	return settings, err
}

// GetCurrentMerkleRoot implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) GetCurrentMerkleRoot(ctx context.Context) (
	root keybase1.MerkleRootV2, updateTime time.Time, err error) {
	k.getCurrentMerkleRootTimer.Time(func() {
		root, updateTime, err = k.delegate.GetCurrentMerkleRoot(ctx)
	})
	return root, updateTime, err
}

// VerifyMerkleRoot implements the KBPKI interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) VerifyMerkleRoot(
	ctx context.Context, root keybase1.MerkleRootV2,
	kbfsRoot keybase1.KBFSRoot) (err error) {
	k.verifyMerkleRootTimer.Time(func() {
		err = k.delegate.VerifyMerkleRoot(ctx, root, kbfsRoot)
	})
	return err
}

// CurrentSession implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) CurrentSession(ctx context.Context, sessionID int) (
	sessionInfo idutil.SessionInfo, err error) {
	k.currentSessionTimer.Time(func() {
		sessionInfo, err = k.delegate.CurrentSession(ctx, sessionID)
	})
	return sessionInfo, err
}

// FavoriteAdd implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FavoriteAdd(ctx context.Context, folder keybase1.FolderHandle) (err error) {
	k.favoriteAddTimer.Time(func() {
		err = k.delegate.FavoriteAdd(ctx, folder)
	})
	return err
}

// FavoriteDelete implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FavoriteDelete(ctx context.Context, folder keybase1.FolderHandle) (err error) {
	k.favoriteDeleteTimer.Time(func() {
		err = k.delegate.FavoriteDelete(ctx, folder)
	})
	return err
}

// FavoriteList implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FavoriteList(ctx context.Context, sessionID int) (
	favorites keybase1.FavoritesResult, err error) {
	k.favoriteListTimer.Time(func() {
		favorites, err = k.delegate.FavoriteList(ctx, sessionID)
	})
	return favorites, err
}

// EncryptFavorites implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) EncryptFavorites(ctx context.Context,
	dataIn []byte) (dataOut []byte, err error) {
	k.favoriteListTimer.Time(func() {
		dataOut, err = k.delegate.EncryptFavorites(ctx, dataIn)
	})
	return dataOut, err
}

// DecryptFavorites implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) DecryptFavorites(ctx context.Context,
	dataIn []byte) (dataOut []byte, err error) {
	k.favoriteListTimer.Time(func() {
		dataOut, err = k.delegate.DecryptFavorites(ctx, dataIn)
	})
	return dataOut, err
}

// NotifyOnlineStatusChanged implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) NotifyOnlineStatusChanged(
	ctx context.Context, online bool) (err error) {
	k.notifyTimer.Time(func() {
		err = k.delegate.NotifyOnlineStatusChanged(ctx, online)
	})
	return err
}

// Notify implements the KeybaseService interface for KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Notify(ctx context.Context, notification *keybase1.FSNotification) (err error) {
	k.notifyTimer.Time(func() {
		err = k.delegate.Notify(ctx, notification)
	})
	return err
}

// NotifyPathUpdated implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) NotifyPathUpdated(
	ctx context.Context, path string) (err error) {
	k.notifyPathUpdatedTimer.Time(func() {
		err = k.delegate.NotifyPathUpdated(ctx, path)
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

// NotifyOverallSyncStatus implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) NotifyOverallSyncStatus(
	ctx context.Context, status keybase1.FolderSyncStatus) (err error) {
	k.notifyTimer.Time(func() {
		err = k.delegate.NotifyOverallSyncStatus(ctx, status)
	})
	return err
}

// NotifyFavoritesChanged implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) NotifyFavoritesChanged(
	ctx context.Context) (err error) {
	k.notifyTimer.Time(func() {
		err = k.delegate.NotifyFavoritesChanged(ctx)
	})
	return err
}

// FlushUserFromLocalCache implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) FlushUserFromLocalCache(
	ctx context.Context, uid keybase1.UID) {
	k.delegate.FlushUserFromLocalCache(ctx, uid)
}

// ClearCaches implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) ClearCaches(ctx context.Context) {
	k.delegate.ClearCaches(ctx)
}

// EstablishMountDir implements the KeybaseDaemon interface for KeybaseDaemonLocal.
func (k KeybaseServiceMeasured) EstablishMountDir(ctx context.Context) (string, error) {
	return k.delegate.EstablishMountDir(ctx)
}

// PutGitMetadata implements the KeybaseDaemon interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) PutGitMetadata(
	ctx context.Context, folder keybase1.FolderHandle, repoID keybase1.RepoID,
	metadata keybase1.GitLocalMetadata) (err error) {
	k.putGitMetadataTimer.Time(func() {
		err = k.delegate.PutGitMetadata(ctx, folder, repoID, metadata)
	})
	return err
}

// OnPathChange implements the SubscriptionNotifier interface.
func (k KeybaseServiceMeasured) OnPathChange(clientID SubscriptionManagerClientID,
	subscriptionIDs []SubscriptionID, path string, topics []keybase1.PathSubscriptionTopic) {
	k.onPathChangeTimer.Time(func() {
		k.delegate.OnPathChange(clientID, subscriptionIDs, path, topics)
	})
}

// OnNonPathChange implements the SubscriptionNotifier interface.
func (k KeybaseServiceMeasured) OnNonPathChange(
	clientID SubscriptionManagerClientID,
	subscriptionIDs []SubscriptionID, topic keybase1.SubscriptionTopic) {
	k.onChangeTimer.Time(func() {
		k.delegate.OnNonPathChange(clientID, subscriptionIDs, topic)
	})
}

// GetKVStoreClient implements the KeybaseService interface.
func (k KeybaseServiceMeasured) GetKVStoreClient() keybase1.KvstoreInterface {
	return k.delegate.GetKVStoreClient()
}

// Shutdown implements the KeybaseService interface for
// KeybaseServiceMeasured.
func (k KeybaseServiceMeasured) Shutdown() {
	k.delegate.Shutdown()
}
