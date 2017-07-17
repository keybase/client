// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// KeybaseServiceBase implements most of KeybaseService from protocol
// defined clients.
type KeybaseServiceBase struct {
	context         Context
	identifyClient  keybase1.IdentifyInterface
	userClient      keybase1.UserInterface
	teamsClient     keybase1.TeamsInterface
	merkleClient    keybase1.MerkleInterface
	sessionClient   keybase1.SessionInterface
	favoriteClient  keybase1.FavoriteInterface
	kbfsClient      keybase1.KbfsInterface
	kbfsMountClient keybase1.KbfsMountInterface
	log             logger.Logger

	config Config

	sessionCacheLock sync.RWMutex
	// Set to the zero value when invalidated.
	cachedCurrentSession SessionInfo

	userCacheLock sync.RWMutex
	// Map entries are removed when invalidated.
	userCache               map[keybase1.UID]UserInfo
	userCacheUnverifiedKeys map[keybase1.UID][]keybase1.PublicKey

	teamCacheLock sync.RWMutex
	// Map entries are removed when invalidated.
	teamCache map[keybase1.TeamID]TeamInfo

	lastNotificationFilenameLock sync.Mutex
	lastNotificationFilename     string
	lastSyncNotificationPath     string
}

// NewKeybaseServiceBase makes a new KeybaseService.
func NewKeybaseServiceBase(config Config, kbCtx Context, log logger.Logger) *KeybaseServiceBase {
	k := KeybaseServiceBase{
		config:                  config,
		context:                 kbCtx,
		log:                     log,
		userCache:               make(map[keybase1.UID]UserInfo),
		userCacheUnverifiedKeys: make(map[keybase1.UID][]keybase1.PublicKey),
		teamCache:               make(map[keybase1.TeamID]TeamInfo),
	}
	return &k
}

// FillClients sets the client protocol implementations needed for a KeybaseService.
func (k *KeybaseServiceBase) FillClients(
	identifyClient keybase1.IdentifyInterface,
	userClient keybase1.UserInterface, teamsClient keybase1.TeamsInterface,
	merkleClient keybase1.MerkleInterface,
	sessionClient keybase1.SessionInterface,
	favoriteClient keybase1.FavoriteInterface,
	kbfsClient keybase1.KbfsInterface,
	kbfsMountClient keybase1.KbfsMountInterface) {
	k.identifyClient = identifyClient
	k.userClient = userClient
	k.teamsClient = teamsClient
	k.merkleClient = merkleClient
	k.sessionClient = sessionClient
	k.favoriteClient = favoriteClient
	k.kbfsClient = kbfsClient
	k.kbfsMountClient = kbfsMountClient
}

type addVerifyingKeyFunc func(kbfscrypto.VerifyingKey)
type addCryptPublicKeyFunc func(kbfscrypto.CryptPublicKey)

// processKey adds the given public key to the appropriate verifying
// or crypt list (as return values), and also updates the given name
// map and parent map in place.
func processKey(publicKey keybase1.PublicKey,
	addVerifyingKey addVerifyingKeyFunc,
	addCryptPublicKey addCryptPublicKeyFunc,
	kidNames map[keybase1.KID]string,
	parents map[keybase1.KID]keybase1.KID) error {
	if len(publicKey.PGPFingerprint) > 0 {
		return nil
	}
	// Import the KID to validate it.
	key, err := libkb.ImportKeypairFromKID(publicKey.KID)
	if err != nil {
		return err
	}
	if publicKey.IsSibkey {
		addVerifyingKey(kbfscrypto.MakeVerifyingKey(key.GetKID()))
	} else {
		addCryptPublicKey(kbfscrypto.MakeCryptPublicKey(key.GetKID()))
	}
	if publicKey.DeviceDescription != "" {
		kidNames[publicKey.KID] = publicKey.DeviceDescription
	}

	if publicKey.ParentID != "" {
		parentKID, err := keybase1.KIDFromStringChecked(
			publicKey.ParentID)
		if err != nil {
			return err
		}
		parents[publicKey.KID] = parentKID
	}
	return nil
}

// updateKIDNamesFromParents sets the name of each KID without a name
// that has a a parent with a name, to that parent's name.
func updateKIDNamesFromParents(kidNames map[keybase1.KID]string,
	parents map[keybase1.KID]keybase1.KID) {
	for kid, parent := range parents {
		if _, ok := kidNames[kid]; ok {
			continue
		}
		if parentName, ok := kidNames[parent]; ok {
			kidNames[kid] = parentName
		}
	}
}

func filterKeys(keys []keybase1.PublicKey) (
	verifyingKeys []kbfscrypto.VerifyingKey,
	cryptPublicKeys []kbfscrypto.CryptPublicKey,
	kidNames map[keybase1.KID]string, err error) {
	kidNames = make(map[keybase1.KID]string, len(keys))
	parents := make(map[keybase1.KID]keybase1.KID, len(keys))

	addVerifyingKey := func(key kbfscrypto.VerifyingKey) {
		verifyingKeys = append(verifyingKeys, key)
	}
	addCryptPublicKey := func(key kbfscrypto.CryptPublicKey) {
		cryptPublicKeys = append(cryptPublicKeys, key)
	}

	for _, publicKey := range keys {
		err := processKey(publicKey, addVerifyingKey, addCryptPublicKey,
			kidNames, parents)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	updateKIDNamesFromParents(kidNames, parents)
	return verifyingKeys, cryptPublicKeys, kidNames, nil
}

func filterRevokedKeys(keys []keybase1.RevokedKey) (
	map[kbfscrypto.VerifyingKey]keybase1.KeybaseTime,
	map[kbfscrypto.CryptPublicKey]keybase1.KeybaseTime,
	map[keybase1.KID]string, error) {
	verifyingKeys := make(map[kbfscrypto.VerifyingKey]keybase1.KeybaseTime)
	cryptPublicKeys := make(map[kbfscrypto.CryptPublicKey]keybase1.KeybaseTime)
	var kidNames = map[keybase1.KID]string{}
	var parents = map[keybase1.KID]keybase1.KID{}

	for _, revokedKey := range keys {
		addVerifyingKey := func(key kbfscrypto.VerifyingKey) {
			verifyingKeys[key] = revokedKey.Time
		}
		addCryptPublicKey := func(key kbfscrypto.CryptPublicKey) {
			cryptPublicKeys[key] = revokedKey.Time
		}
		err := processKey(revokedKey.Key, addVerifyingKey, addCryptPublicKey,
			kidNames, parents)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	updateKIDNamesFromParents(kidNames, parents)
	return verifyingKeys, cryptPublicKeys, kidNames, nil

}

func (k *KeybaseServiceBase) getCachedCurrentSession() SessionInfo {
	k.sessionCacheLock.RLock()
	defer k.sessionCacheLock.RUnlock()
	return k.cachedCurrentSession
}

func (k *KeybaseServiceBase) setCachedCurrentSession(s SessionInfo) {
	k.sessionCacheLock.Lock()
	defer k.sessionCacheLock.Unlock()
	k.cachedCurrentSession = s
}

func (k *KeybaseServiceBase) getCachedUserInfo(uid keybase1.UID) UserInfo {
	k.userCacheLock.RLock()
	defer k.userCacheLock.RUnlock()
	return k.userCache[uid]
}

func (k *KeybaseServiceBase) setCachedUserInfo(uid keybase1.UID, info UserInfo) {
	k.userCacheLock.Lock()
	defer k.userCacheLock.Unlock()
	if info.Name == libkb.NormalizedUsername("") {
		delete(k.userCache, uid)
	} else {
		k.userCache[uid] = info
	}
}

func (k *KeybaseServiceBase) getCachedUnverifiedKeys(uid keybase1.UID) (
	[]keybase1.PublicKey, bool) {
	k.userCacheLock.RLock()
	defer k.userCacheLock.RUnlock()
	if unverifiedKeys, ok := k.userCacheUnverifiedKeys[uid]; ok {
		return unverifiedKeys, true
	}
	return nil, false
}

func (k *KeybaseServiceBase) setCachedUnverifiedKeys(uid keybase1.UID, pk []keybase1.PublicKey) {
	k.userCacheLock.Lock()
	defer k.userCacheLock.Unlock()
	k.userCacheUnverifiedKeys[uid] = pk
}

func (k *KeybaseServiceBase) clearCachedUnverifiedKeys(uid keybase1.UID) {
	k.userCacheLock.Lock()
	defer k.userCacheLock.Unlock()
	delete(k.userCacheUnverifiedKeys, uid)
}

func (k *KeybaseServiceBase) getCachedTeamInfo(tid keybase1.TeamID) TeamInfo {
	k.teamCacheLock.RLock()
	defer k.teamCacheLock.RUnlock()
	return k.teamCache[tid]
}

func (k *KeybaseServiceBase) setCachedTeamInfo(
	tid keybase1.TeamID, info TeamInfo) {
	k.teamCacheLock.Lock()
	defer k.teamCacheLock.Unlock()
	if info.Name == libkb.NormalizedUsername("") {
		delete(k.teamCache, tid)
	} else {
		k.teamCache[tid] = info
	}
}

func (k *KeybaseServiceBase) clearCaches() {
	k.setCachedCurrentSession(SessionInfo{})
	func() {
		k.userCacheLock.Lock()
		defer k.userCacheLock.Unlock()
		k.userCache = make(map[keybase1.UID]UserInfo)
		k.userCacheUnverifiedKeys = make(map[keybase1.UID][]keybase1.PublicKey)
	}()
	k.teamCacheLock.Lock()
	defer k.teamCacheLock.Unlock()
	k.teamCache = make(map[keybase1.TeamID]TeamInfo)
}

// LoggedIn implements keybase1.NotifySessionInterface.
func (k *KeybaseServiceBase) LoggedIn(ctx context.Context, name string) error {
	k.log.CDebugf(ctx, "Current session logged in: %s", name)
	// Since we don't have the whole session, just clear the cache and
	// repopulate it.  The `CurrentSession` call executes the "logged
	// in" flow.
	k.setCachedCurrentSession(SessionInfo{})
	const sessionID = 0
	_, err := k.CurrentSession(ctx, sessionID)
	if err != nil {
		k.log.CDebugf(ctx, "Getting current session failed when %s is logged "+
			"in, so pretending user has logged out: %v",
			name, err)
		if k.config != nil {
			serviceLoggedOut(ctx, k.config)
		}
		return nil
	}

	return nil
}

// LoggedOut implements keybase1.NotifySessionInterface.
func (k *KeybaseServiceBase) LoggedOut(ctx context.Context) error {
	k.log.CDebugf(ctx, "Current session logged out")
	k.setCachedCurrentSession(SessionInfo{})
	if k.config != nil {
		serviceLoggedOut(ctx, k.config)
	}
	return nil
}

// KeyfamilyChanged implements keybase1.NotifyKeyfamilyInterface.
func (k *KeybaseServiceBase) KeyfamilyChanged(ctx context.Context,
	uid keybase1.UID) error {
	k.log.CDebugf(ctx, "Key family for user %s changed", uid)
	k.setCachedUserInfo(uid, UserInfo{})
	k.clearCachedUnverifiedKeys(uid)

	if k.getCachedCurrentSession().UID == uid {
		// Ignore any errors for now, we don't want to block this
		// notification and it's not worth spawning a goroutine for.
		k.config.MDServer().CheckForRekeys(context.Background())
	}

	return nil
}

// ReachabilityChanged implements keybase1.ReachabiltyInterface.
func (k *KeybaseServiceBase) ReachabilityChanged(ctx context.Context,
	reachability keybase1.Reachability) error {
	k.log.CDebugf(ctx, "CheckReachability invoked: %v", reachability)
	k.config.MDServer().CheckReachability(ctx)
	return nil
}

// StartReachability implements keybase1.ReachabilityInterface.
func (k *KeybaseServiceBase) StartReachability(ctx context.Context) (res keybase1.Reachability, err error) {
	return k.CheckReachability(ctx)
}

// CheckReachability implements keybase1.ReachabilityInterface.
func (k *KeybaseServiceBase) CheckReachability(ctx context.Context) (res keybase1.Reachability, err error) {
	res.Reachable = keybase1.Reachable_NO
	if k.config.MDServer().IsConnected() {
		res.Reachable = keybase1.Reachable_YES
	}
	return res, nil
}

// PaperKeyCached implements keybase1.NotifyPaperKeyInterface.
func (k *KeybaseServiceBase) PaperKeyCached(ctx context.Context,
	arg keybase1.PaperKeyCachedArg) error {
	k.log.CDebugf(ctx, "Paper key for %s cached", arg.Uid)

	if k.getCachedCurrentSession().UID == arg.Uid {
		// Ignore any errors for now, we don't want to block this
		// notification and it's not worth spawning a goroutine for.
		k.config.MDServer().CheckForRekeys(context.Background())
	}

	return nil
}

// ClientOutOfDate implements keybase1.NotifySessionInterface.
func (k *KeybaseServiceBase) ClientOutOfDate(ctx context.Context,
	arg keybase1.ClientOutOfDateArg) error {
	k.log.CDebugf(ctx, "Client out of date: %v", arg)
	return nil
}

// ConvertIdentifyError converts a errors during identify into KBFS errors
func ConvertIdentifyError(assertion string, err error) error {
	switch err.(type) {
	case libkb.NotFoundError:
		return NoSuchUserError{assertion}
	case libkb.ResolutionError:
		return NoSuchUserError{assertion}
	}
	return err
}

// Resolve implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	res, err := k.identifyClient.Resolve3(ctx, assertion)
	if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			ConvertIdentifyError(assertion, err)
	}
	return libkb.NewNormalizedUsername(res.Name), res.Id, nil
}

// Identify implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) Identify(ctx context.Context, assertion, reason string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	// setting UseDelegateUI to true here will cause daemon to use
	// registered identify ui providers instead of terminal if any
	// are available.  If not, then it will use the terminal UI.
	arg := keybase1.IdentifyLiteArg{
		Assertion:     assertion,
		UseDelegateUI: true,
		Reason:        keybase1.IdentifyReason{Reason: reason},
		// No need to go back and forth with the UI until the service
		// knows for sure there's a need for a dialogue.
		CanSuppressUI: true,
	}

	ei := getExtendedIdentify(ctx)
	arg.IdentifyBehavior = ei.behavior

	res, err := k.identifyClient.IdentifyLite(ctx, arg)
	// Identify2 still returns keybase1.UserPlusKeys data (sans keys),
	// even if it gives a NoSigChainError, and in KBFS it's fine if
	// the user doesn't have a full sigchain yet (e.g., it's just like
	// the sharing before signup case, except the user already has a
	// UID).
	if _, ok := err.(libkb.NoSigChainError); ok {
		k.log.CDebugf(ctx, "Ignoring error (%s) for user %s with no sigchain",
			err, res.Ul.Name)
	} else if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			ConvertIdentifyError(assertion, err)
	}

	// This is required for every identify call. The userBreak
	// function will take care of checking if res.TrackBreaks is nil
	// or not.
	name := libkb.NormalizedUsername(res.Ul.Name)
	if res.Ul.Id.IsUser() {
		asUser, err := res.Ul.Id.AsUser()
		if err != nil {
			return libkb.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
		}
		ei.userBreak(name, asUser, res.TrackBreaks)
	}

	return name, res.Ul.Id, nil
}

// LoadUserPlusKeys implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) LoadUserPlusKeys(ctx context.Context,
	uid keybase1.UID, pollForKID keybase1.KID) (UserInfo, error) {
	cachedUserInfo := k.getCachedUserInfo(uid)
	if cachedUserInfo.Name != libkb.NormalizedUsername("") {
		if pollForKID == keybase1.KID("") {
			return cachedUserInfo, nil
		}
		// Skip the cache if pollForKID isn't present in `VerifyingKeys`.
		for _, key := range cachedUserInfo.VerifyingKeys {
			if key.KID().Equal(pollForKID) {
				return cachedUserInfo, nil
			}
		}
	}

	arg := keybase1.LoadUserPlusKeysArg{Uid: uid, PollForKID: pollForKID}
	res, err := k.userClient.LoadUserPlusKeys(ctx, arg)
	if err != nil {
		return UserInfo{}, err
	}

	return k.processUserPlusKeys(res)
}

var allowedLoadTeamRoles = map[keybase1.TeamRole]bool{
	keybase1.TeamRole_NONE:   true,
	keybase1.TeamRole_WRITER: true,
	keybase1.TeamRole_READER: true,
}

// LoadTeamPlusKeys implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) LoadTeamPlusKeys(
	ctx context.Context, tid keybase1.TeamID, desiredKeyGen KeyGen,
	desiredUser keybase1.UserVersion, desiredRole keybase1.TeamRole) (
	TeamInfo, error) {
	if !allowedLoadTeamRoles[desiredRole] {
		panic(fmt.Sprintf("Disallowed team role: %v", desiredRole))
	}

	cachedTeamInfo := k.getCachedTeamInfo(tid)
	if cachedTeamInfo.Name != libkb.NormalizedUsername("") {
		// If the cached team info doesn't satisfy our desires, don't
		// use it.
		satisfiesDesires := true
		if desiredKeyGen >= FirstValidKeyGen {
			// If `desiredKeyGen` is at most as large as the keygen in
			// the cached latest team info, then our cached info
			// satisfies our desires.
			satisfiesDesires = desiredKeyGen <= cachedTeamInfo.LatestKeyGen
		}

		if satisfiesDesires && desiredUser.Uid.Exists() {
			// If the user is in the writer map, that satisfies none, reader
			// or writer desires.
			satisfiesDesires = cachedTeamInfo.Writers[desiredUser.Uid]
			// If not, and the desire role is a reader, we need to
			// check the reader map explicitly.
			if !satisfiesDesires &&
				(desiredRole == keybase1.TeamRole_NONE ||
					desiredRole == keybase1.TeamRole_READER) {
				satisfiesDesires = cachedTeamInfo.Readers[desiredUser.Uid]
			}
		}

		if satisfiesDesires {
			return cachedTeamInfo, nil
		}
	}

	arg := keybase1.LoadTeamPlusApplicationKeysArg{
		Id:          tid,
		Application: keybase1.TeamApplication_KBFS,
	}

	if desiredKeyGen >= FirstValidKeyGen {
		arg.Refreshers.NeedKeyGeneration =
			keybase1.PerTeamKeyGeneration(desiredKeyGen)
	}

	if desiredUser.Uid.Exists() {
		arg.Refreshers.WantMembers = append(
			arg.Refreshers.WantMembers, desiredUser)
		arg.Refreshers.WantMembersRole = desiredRole
	}

	res, err := k.teamsClient.LoadTeamPlusApplicationKeys(ctx, arg)
	if err != nil {
		return TeamInfo{}, err
	}

	if tid != res.Id {
		return TeamInfo{}, fmt.Errorf(
			"TID doesn't match: %s vs %s", tid, res.Id)
	}

	info := TeamInfo{
		Name:      libkb.NormalizedUsername(res.Name),
		TID:       res.Id,
		CryptKeys: make(map[KeyGen]kbfscrypto.TLFCryptKey),
		Writers:   make(map[keybase1.UID]bool),
		Readers:   make(map[keybase1.UID]bool),
	}
	for _, key := range res.ApplicationKeys {
		keyGen := KeyGen(key.KeyGeneration)
		info.CryptKeys[keyGen] =
			kbfscrypto.MakeTLFCryptKey(key.Key)
		if keyGen > info.LatestKeyGen {
			info.LatestKeyGen = keyGen
		}
	}

	for _, user := range res.Writers {
		info.Writers[user.Uid] = true
	}
	for _, user := range res.OnlyReaders {
		info.Readers[user.Uid] = true
	}
	k.setCachedTeamInfo(tid, info)
	return info, nil
}

// GetCurrentMerkleSeqNo implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetCurrentMerkleSeqNo(ctx context.Context) (
	MerkleSeqNo, error) {
	const merkleFreshnessMs = int(time.Second * 60 / time.Millisecond)
	res, err := k.merkleClient.GetCurrentMerkleRoot(ctx, merkleFreshnessMs)
	if err != nil {
		return 0, err
	}

	if res.Root.Seqno < 0 {
		return 0, fmt.Errorf(
			"Illegal negative merkle seqno: %d", res.Root.Seqno)
	}

	// NOTE: `res.Seqno` is an int64, while `MerkleSeqNo` is a uint64,
	// so casting in this direction should be safe.
	return MerkleSeqNo(res.Root.Seqno), nil
}

func (k *KeybaseServiceBase) processUserPlusKeys(upk keybase1.UserPlusKeys) (
	UserInfo, error) {
	verifyingKeys, cryptPublicKeys, kidNames, err := filterKeys(upk.DeviceKeys)
	if err != nil {
		return UserInfo{}, err
	}

	revokedVerifyingKeys, revokedCryptPublicKeys, revokedKidNames, err :=
		filterRevokedKeys(upk.RevokedDeviceKeys)
	if err != nil {
		return UserInfo{}, err
	}

	if len(revokedKidNames) > 0 {
		for k, v := range revokedKidNames {
			kidNames[k] = v
		}
	}

	u := UserInfo{
		Name:                   libkb.NewNormalizedUsername(upk.Username),
		UID:                    upk.Uid,
		VerifyingKeys:          verifyingKeys,
		CryptPublicKeys:        cryptPublicKeys,
		KIDNames:               kidNames,
		EldestSeqno:            upk.EldestSeqno,
		RevokedVerifyingKeys:   revokedVerifyingKeys,
		RevokedCryptPublicKeys: revokedCryptPublicKeys,
	}

	k.setCachedUserInfo(upk.Uid, u)
	return u, nil
}

// LoadUnverifiedKeys implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) LoadUnverifiedKeys(ctx context.Context, uid keybase1.UID) (
	[]keybase1.PublicKey, error) {
	if keys, ok := k.getCachedUnverifiedKeys(uid); ok {
		return keys, nil
	}

	arg := keybase1.LoadAllPublicKeysUnverifiedArg{Uid: uid}
	keys, err := k.userClient.LoadAllPublicKeysUnverified(ctx, arg)
	if err != nil {
		return nil, err
	}

	k.setCachedUnverifiedKeys(uid, keys)
	return keys, nil
}

// CurrentSession implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) CurrentSession(ctx context.Context, sessionID int) (
	SessionInfo, error) {
	cachedCurrentSession := k.getCachedCurrentSession()
	if cachedCurrentSession != (SessionInfo{}) {
		return cachedCurrentSession, nil
	}

	res, err := k.sessionClient.CurrentSession(ctx, sessionID)
	if err != nil {
		if _, ok := err.(libkb.NoSessionError); ok {
			// Use an error with a proper OS error code attached to it.
			err = NoCurrentSessionError{}
		}
		return SessionInfo{}, err
	}
	s, err := SessionInfoFromProtocol(res)
	if err != nil {
		return s, err
	}

	k.log.CDebugf(
		ctx, "new session with username %s, uid %s, crypt public key %s, and verifying key %s",
		s.Name, s.UID, s.CryptPublicKey, s.VerifyingKey)

	k.setCachedCurrentSession(s)

	if k.config != nil {
		serviceLoggedIn(
			ctx, k.config, s.Name.String(), TLFJournalBackgroundWorkEnabled)
	}

	return s, nil
}

// FavoriteAdd implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteClient.FavoriteAdd(ctx, keybase1.FavoriteAddArg{Folder: folder})
}

// FavoriteDelete implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteClient.FavoriteIgnore(ctx,
		keybase1.FavoriteIgnoreArg{Folder: folder})
}

// FavoriteList implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) FavoriteList(ctx context.Context, sessionID int) ([]keybase1.Folder, error) {
	results, err := k.favoriteClient.GetFavorites(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	return results.FavoriteFolders, nil
}

// Notify implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	// Reduce log spam by not repeating log lines for
	// notifications with the same filename.
	//
	// TODO: Only do this in debug mode.
	func() {
		k.lastNotificationFilenameLock.Lock()
		defer k.lastNotificationFilenameLock.Unlock()
		if notification.Filename != k.lastNotificationFilename {
			k.lastNotificationFilename = notification.Filename
			k.log.CDebugf(ctx, "Sending notification for %s", notification.Filename)
		}
	}()
	return k.kbfsClient.FSEvent(ctx, *notification)
}

// NotifySyncStatus implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) NotifySyncStatus(ctx context.Context,
	status *keybase1.FSPathSyncStatus) error {
	// Reduce log spam by not repeating log lines for
	// notifications with the same pathname.
	//
	// TODO: Only do this in debug mode.
	func() {
		k.lastNotificationFilenameLock.Lock()
		defer k.lastNotificationFilenameLock.Unlock()
		if status.Path != k.lastSyncNotificationPath {
			k.lastSyncNotificationPath = status.Path
			k.log.CDebugf(ctx, "Sending notification for %s", status.Path)
		}
	}()
	return k.kbfsClient.FSSyncEvent(ctx, *status)
}

// FlushUserFromLocalCache implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FlushUserFromLocalCache(ctx context.Context,
	uid keybase1.UID) {
	k.log.CDebugf(ctx, "Flushing cache for user %s", uid)
	k.setCachedUserInfo(uid, UserInfo{})
}

// FlushUserUnverifiedKeysFromLocalCache implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FlushUserUnverifiedKeysFromLocalCache(ctx context.Context,
	uid keybase1.UID) {
	k.log.CDebugf(ctx, "Flushing cache of unverified keys for user %s", uid)
	k.clearCachedUnverifiedKeys(uid)
}

// CtxKeybaseServiceTagKey is the type used for unique context tags
// used while servicing incoming keybase requests.
type CtxKeybaseServiceTagKey int

const (
	// CtxKeybaseServiceIDKey is the type of the tag for unique
	// operation IDs used while servicing incoming keybase requests.
	CtxKeybaseServiceIDKey CtxKeybaseServiceTagKey = iota
)

// CtxKeybaseServiceOpID is the display name for the unique operation
// enqueued rekey ID tag.
const CtxKeybaseServiceOpID = "KSID"

func (k *KeybaseServiceBase) getHandleFromFolderName(ctx context.Context,
	tlfName string, public bool) (*TlfHandle, error) {
	for {
		// TODO(KBFS-2185): update the protocol to support requests
		// for single-team TLFs.
		t := tlf.Private
		if public {
			t = tlf.Public
		}
		tlfHandle, err := ParseTlfHandle(ctx, k.config.KBPKI(), tlfName, t)
		switch e := err.(type) {
		case TlfNameNotCanonical:
			tlfName = e.NameToTry
		case nil:
			return tlfHandle, nil
		default:
			return nil, err
		}
	}
}

// FSEditListRequest implements keybase1.NotifyFSRequestInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FSEditListRequest(ctx context.Context,
	req keybase1.FSEditListRequest) (err error) {
	ctx = ctxWithRandomIDReplayable(ctx, CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID,
		k.log)
	k.log.CDebugf(ctx, "Edit list request for %s (public: %t)",
		req.Folder.Name, !req.Folder.Private)
	tlfHandle, err := k.getHandleFromFolderName(ctx, req.Folder.Name,
		!req.Folder.Private)
	if err != nil {
		return err
	}

	rootNode, _, err := k.config.KBFSOps().
		GetOrCreateRootNode(ctx, tlfHandle, MasterBranch)
	if err != nil {
		return err
	}
	editHistory, err := k.config.KBFSOps().GetEditHistory(ctx,
		rootNode.GetFolderBranch())
	if err != nil {
		return err
	}

	// Convert the edits to an RPC response.
	var resp keybase1.FSEditListArg
	for writer, edits := range editHistory {
		for _, edit := range edits {
			var nType keybase1.FSNotificationType
			switch edit.Type {
			case FileCreated:
				nType = keybase1.FSNotificationType_FILE_CREATED
			case FileModified:
				nType = keybase1.FSNotificationType_FILE_MODIFIED
			default:
				k.log.CDebugf(ctx, "Bad notification type in edit history: %v",
					edit.Type)
				continue
			}
			n := keybase1.FSNotification{
				Filename:         edit.Filepath,
				StatusCode:       keybase1.FSStatusCode_FINISH,
				NotificationType: nType,
				WriterUid:        writer,
				LocalTime:        keybase1.ToTime(edit.LocalTime),
			}
			resp.Edits = append(resp.Edits, n)
		}
	}
	resp.RequestID = req.RequestID

	k.log.CDebugf(ctx, "Sending edit history response with %d edits",
		len(resp.Edits))
	return k.kbfsClient.FSEditList(ctx, resp)
}

// FSSyncStatusRequest implements keybase1.NotifyFSRequestInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FSSyncStatusRequest(ctx context.Context,
	req keybase1.FSSyncStatusRequest) (err error) {
	k.log.CDebugf(ctx, "Got sync status request: %v", req)

	resp := keybase1.FSSyncStatusArg{RequestID: req.RequestID}

	// For now, just return the number of syncing bytes.
	jServer, err := GetJournalServer(k.config)
	if err == nil {
		status, _ := jServer.Status(ctx)
		resp.Status.TotalSyncingBytes = status.UnflushedBytes
		k.log.CDebugf(ctx, "Sending sync status response with %d syncing bytes",
			status.UnflushedBytes)
	} else {
		k.log.CDebugf(ctx, "No journal server, sending empty response")
	}

	return k.kbfsClient.FSSyncStatus(ctx, resp)
}

// TeamChanged implements keybase1.NotifyTeamInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) TeamChanged(
	ctx context.Context, arg keybase1.TeamChangedArg) error {
	k.log.CDebugf(ctx, "Flushing cache for team %s/%s "+
		"(membershipChange=%t, keyRotated=%t, renamed=%t)",
		arg.TeamName, arg.TeamID, arg.Changes.MembershipChanged,
		arg.Changes.KeyRotated, arg.Changes.Renamed)
	k.setCachedTeamInfo(arg.TeamID, TeamInfo{})

	if arg.Changes.Renamed {
		k.config.KBFSOps().TeamNameChanged(ctx, arg.TeamID)
	}
	return nil
}

// GetTLFCryptKeys implements the TlfKeysInterface interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetTLFCryptKeys(ctx context.Context,
	query keybase1.TLFQuery) (res keybase1.GetTLFCryptKeysRes, err error) {
	if ctx, err = makeExtendedIdentify(
		ctxWithRandomIDReplayable(ctx,
			CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID, k.log),
		query.IdentifyBehavior,
	); err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}

	tlfHandle, err := k.getHandleFromFolderName(ctx, query.TlfName, false)
	if err != nil {
		return res, err
	}

	res.NameIDBreaks.CanonicalName = keybase1.CanonicalTlfName(
		tlfHandle.GetCanonicalName())

	keys, id, err := k.config.KBFSOps().GetTLFCryptKeys(ctx, tlfHandle)
	if err != nil {
		return res, err
	}
	res.NameIDBreaks.TlfID = keybase1.TLFID(id.String())

	for i, key := range keys {
		res.CryptKeys = append(res.CryptKeys, keybase1.CryptKey{
			KeyGeneration: int(FirstValidKeyGen) + i,
			Key:           keybase1.Bytes32(key.Data()),
		})
	}

	if query.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks() {
		res.NameIDBreaks.Breaks = getExtendedIdentify(ctx).getTlfBreakAndClose()
	}

	return res, nil
}

// GetPublicCanonicalTLFNameAndID implements the TlfKeysInterface interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetPublicCanonicalTLFNameAndID(
	ctx context.Context, query keybase1.TLFQuery) (
	res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	if ctx, err = makeExtendedIdentify(
		ctxWithRandomIDReplayable(ctx,
			CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID, k.log),
		query.IdentifyBehavior,
	); err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	tlfHandle, err := k.getHandleFromFolderName(
		ctx, query.TlfName, true /* public */)
	if err != nil {
		return res, err
	}

	res.CanonicalName = keybase1.CanonicalTlfName(
		tlfHandle.GetCanonicalName())

	id, err := k.config.KBFSOps().GetTLFID(ctx, tlfHandle)
	if err != nil {
		return res, err
	}
	res.TlfID = keybase1.TLFID(id.String())

	if query.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks() {
		res.Breaks = getExtendedIdentify(ctx).getTlfBreakAndClose()
	}

	return res, nil
}

// EstablishMountDir asks the service for the current mount path
func (k *KeybaseServiceBase) EstablishMountDir(ctx context.Context) (
	string, error) {
	dir, err := k.kbfsMountClient.GetCurrentMountDir(ctx)
	if err != nil {
		return "", err
	}
	if dir == "" {
		dirs, err2 := k.kbfsMountClient.GetAllAvailableMountDirs(ctx)
		if err != nil {
			return "", err2
		}
		dir, err = chooseDefaultMount(ctx, dirs, k.log)
		if err != nil {
			return "", err
		}
		err2 = k.kbfsMountClient.SetCurrentMountDir(ctx, dir)
		if err2 != nil {
			k.log.CInfof(ctx, "SetCurrentMount Dir fails - ", err2)
		}
		// Continue mounting even if we can't save the mount
		k.log.CDebugf(ctx, "Choosing mountdir %s from %v", dir, dirs)
	}
	return dir, err
}
