// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/favorites"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	cacheNotWriterExpiration = 5 * time.Second
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
	gitClient       keybase1.GitInterface
	kvstoreClient   keybase1.KvstoreInterface
	log             logger.Logger

	config     Config
	merkleRoot *EventuallyConsistentMerkleRoot

	sessionCacheLock sync.RWMutex
	// Set to the zero value when invalidated.
	cachedCurrentSession idutil.SessionInfo
	sessionInProgressCh  chan struct{}

	userCacheLock sync.RWMutex
	// Map entries are removed when invalidated.
	userCache map[keybase1.UID]idutil.UserInfo

	teamCacheLock sync.RWMutex
	// Map entries are removed when invalidated.
	teamCache      map[keybase1.TeamID]idutil.TeamInfo
	notWriterCache map[keybase1.TeamID]map[keybase1.UID]time.Time
}

// Wrapper over `KeybaseServiceBase` implementing a `merkleRootGetter`
// that gets the merkle root directly from the service, without using
// the cache.
type keybaseServiceMerkleGetter struct {
	k *KeybaseServiceBase
}

var _ idutil.MerkleRootGetter = (*keybaseServiceMerkleGetter)(nil)

func (k *keybaseServiceMerkleGetter) GetCurrentMerkleRoot(
	ctx context.Context) (keybase1.MerkleRootV2, time.Time, error) {
	return k.k.getCurrentMerkleRoot(ctx)
}

func (k *keybaseServiceMerkleGetter) VerifyMerkleRoot(
	_ context.Context, _ keybase1.MerkleRootV2, _ keybase1.KBFSRoot) error {
	panic("constMerkleRootGetter doesn't verify merkle roots")
}

// NewKeybaseServiceBase makes a new KeybaseService.
func NewKeybaseServiceBase(config Config, kbCtx Context, log logger.Logger) *KeybaseServiceBase {
	k := KeybaseServiceBase{
		config:         config,
		context:        kbCtx,
		log:            log,
		userCache:      make(map[keybase1.UID]idutil.UserInfo),
		teamCache:      make(map[keybase1.TeamID]idutil.TeamInfo),
		notWriterCache: make(map[keybase1.TeamID]map[keybase1.UID]time.Time),
	}
	if config != nil {
		k.merkleRoot = NewEventuallyConsistentMerkleRoot(
			config, &keybaseServiceMerkleGetter{&k})
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
	kbfsMountClient keybase1.KbfsMountInterface,
	gitClient keybase1.GitInterface, kvstoreClient keybase1.KvstoreClient) {
	k.identifyClient = identifyClient
	k.userClient = userClient
	k.teamsClient = teamsClient
	k.merkleClient = merkleClient
	k.sessionClient = sessionClient
	k.favoriteClient = favoriteClient
	k.kbfsClient = kbfsClient
	k.kbfsMountClient = kbfsMountClient
	k.gitClient = gitClient
	k.kvstoreClient = kvstoreClient
}

type addVerifyingKeyFunc func(kbfscrypto.VerifyingKey)
type addCryptPublicKeyFunc func(kbfscrypto.CryptPublicKey)

// processKey adds the given public key to the appropriate verifying
// or crypt list (as return values), and also updates the given name
// map and parent map in place.
func processKey(publicKey keybase1.PublicKeyV2NaCl,
	addVerifyingKey addVerifyingKeyFunc,
	addCryptPublicKey addCryptPublicKeyFunc,
	kidNames map[keybase1.KID]string,
	parents map[keybase1.KID]keybase1.KID) error {
	// Import the KID to validate it.
	key, err := libkb.ImportKeypairFromKID(publicKey.Base.Kid)
	if err != nil {
		return err
	}
	if publicKey.Base.IsSibkey {
		addVerifyingKey(kbfscrypto.MakeVerifyingKey(key.GetKID()))
	} else {
		addCryptPublicKey(kbfscrypto.MakeCryptPublicKey(key.GetKID()))
	}
	if publicKey.DeviceDescription != "" {
		kidNames[publicKey.Base.Kid] = publicKey.DeviceDescription
	}

	if publicKey.Parent != nil {
		parents[publicKey.Base.Kid] = *publicKey.Parent
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

func filterKeys(keys map[keybase1.KID]keybase1.PublicKeyV2NaCl) (
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
		if publicKey.Base.Revocation != nil {
			continue
		}

		err := processKey(publicKey, addVerifyingKey, addCryptPublicKey,
			kidNames, parents)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	updateKIDNamesFromParents(kidNames, parents)
	return verifyingKeys, cryptPublicKeys, kidNames, nil
}

func (k *KeybaseServiceBase) filterRevokedKeys(
	ctx context.Context,
	uid keybase1.UID,
	keys map[keybase1.KID]keybase1.PublicKeyV2NaCl,
	reset *keybase1.ResetSummary) (
	map[kbfscrypto.VerifyingKey]idutil.RevokedKeyInfo,
	map[kbfscrypto.CryptPublicKey]idutil.RevokedKeyInfo,
	map[keybase1.KID]string, error) {
	verifyingKeys := make(map[kbfscrypto.VerifyingKey]idutil.RevokedKeyInfo)
	cryptPublicKeys := make(
		map[kbfscrypto.CryptPublicKey]idutil.RevokedKeyInfo)
	var kidNames = map[keybase1.KID]string{}
	var parents = map[keybase1.KID]keybase1.KID{}

	for _, key := range keys {
		var info idutil.RevokedKeyInfo
		switch {
		case key.Base.Revocation != nil:
			info.Time = key.Base.Revocation.Time
			info.MerkleRoot = key.Base.Revocation.PrevMerkleRootSigned
			// If we don't have a prev seqno, then we already have the
			// best merkle data we're going to get.
			info.SetFilledInMerkle(info.MerkleRoot.Seqno <= 0)
			info.SetSigChainLocation(key.Base.Revocation.SigChainLocation)
		case reset != nil:
			info.Time = keybase1.ToTime(keybase1.FromUnixTime(reset.Ctime))
			info.MerkleRoot.Seqno = reset.MerkleRoot.Seqno
			info.MerkleRoot.HashMeta = reset.MerkleRoot.HashMeta
			// If we don't have a prev seqno, then we already have the
			// best merkle data we're going to get.
			info.SetFilledInMerkle(info.MerkleRoot.Seqno <= 0)
			info.SetResetInfo(reset.ResetSeqno, true)
		default:
			// Not revoked.
			continue
		}

		addVerifyingKey := func(key kbfscrypto.VerifyingKey) {
			verifyingKeys[key] = info
		}
		addCryptPublicKey := func(key kbfscrypto.CryptPublicKey) {
			cryptPublicKeys[key] = info
		}
		err := processKey(key, addVerifyingKey, addCryptPublicKey,
			kidNames, parents)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	updateKIDNamesFromParents(kidNames, parents)
	return verifyingKeys, cryptPublicKeys, kidNames, nil

}

func (k *KeybaseServiceBase) getCachedCurrentSession() idutil.SessionInfo {
	k.sessionCacheLock.RLock()
	defer k.sessionCacheLock.RUnlock()
	return k.cachedCurrentSession
}

func (k *KeybaseServiceBase) setCachedCurrentSession(s idutil.SessionInfo) {
	k.sessionCacheLock.Lock()
	defer k.sessionCacheLock.Unlock()
	k.cachedCurrentSession = s
}

func (k *KeybaseServiceBase) getCachedUserInfo(
	uid keybase1.UID) idutil.UserInfo {
	k.userCacheLock.RLock()
	defer k.userCacheLock.RUnlock()
	return k.userCache[uid]
}

func (k *KeybaseServiceBase) setCachedUserInfo(
	uid keybase1.UID, info idutil.UserInfo) {
	k.userCacheLock.Lock()
	defer k.userCacheLock.Unlock()
	if info.Name == kbname.NormalizedUsername("") {
		delete(k.userCache, uid)
	} else {
		k.userCache[uid] = info
	}
}

func (k *KeybaseServiceBase) getCachedTeamInfo(
	tid keybase1.TeamID) idutil.TeamInfo {
	k.teamCacheLock.RLock()
	defer k.teamCacheLock.RUnlock()
	return k.teamCache[tid]
}

func (k *KeybaseServiceBase) setCachedTeamInfo(
	tid keybase1.TeamID, info idutil.TeamInfo) {
	k.teamCacheLock.Lock()
	defer k.teamCacheLock.Unlock()
	if info.Name == kbname.NormalizedUsername("") {
		delete(k.teamCache, tid)
		delete(k.notWriterCache, tid)
	} else {
		k.teamCache[tid] = info
	}
}

func (k *KeybaseServiceBase) getCachedNotWriter(
	tid keybase1.TeamID, uid keybase1.UID) (notWriter bool) {
	k.teamCacheLock.RLock()
	defer k.teamCacheLock.RUnlock()
	cachedTime, notWriter := k.notWriterCache[tid][uid]
	if !notWriter {
		return false
	}

	if k.config.Clock().Now().Sub(cachedTime) > cacheNotWriterExpiration {
		delete(k.notWriterCache[tid], uid)
		return false
	}
	return true
}

func (k *KeybaseServiceBase) setCachedNotWriter(
	tid keybase1.TeamID, uid keybase1.UID) {
	k.teamCacheLock.Lock()
	defer k.teamCacheLock.Unlock()
	teamMap := k.notWriterCache[tid]
	if teamMap == nil {
		teamMap = make(map[keybase1.UID]time.Time)
		k.notWriterCache[tid] = teamMap
	}
	teamMap[uid] = k.config.Clock().Now()
}

// ClearCaches implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) ClearCaches(ctx context.Context) {
	k.log.CDebugf(ctx, "Clearing KBFS-side user and team caches")

	k.setCachedCurrentSession(idutil.SessionInfo{})
	func() {
		k.userCacheLock.Lock()
		defer k.userCacheLock.Unlock()
		k.userCache = make(map[keybase1.UID]idutil.UserInfo)
	}()
	k.teamCacheLock.Lock()
	defer k.teamCacheLock.Unlock()
	k.teamCache = make(map[keybase1.TeamID]idutil.TeamInfo)
	k.notWriterCache = make(map[keybase1.TeamID]map[keybase1.UID]time.Time)
}

// LoggedIn implements keybase1.NotifySessionInterface.
func (k *KeybaseServiceBase) LoggedIn(ctx context.Context, arg keybase1.LoggedInArg) error {
	k.log.CDebugf(ctx, "Current session logged in: %s, signedUp: %t", arg.Username, arg.SignedUp)
	// Since we don't have the whole session, just clear the cache and
	// repopulate it.  The `CurrentSession` call executes the "logged
	// in" flow.
	k.setCachedCurrentSession(idutil.SessionInfo{})
	const sessionID = 0
	_, err := k.CurrentSession(ctx, sessionID)
	if err != nil {
		k.log.CDebugf(ctx, "Getting current session failed when %s is logged "+
			"in, so pretending user has logged out: %v",
			arg.Username, err)
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
	k.setCachedCurrentSession(idutil.SessionInfo{})
	if k.config != nil {
		serviceLoggedOut(ctx, k.config)
	}
	return nil
}

// KeyfamilyChanged implements keybase1.NotifyKeyfamilyInterface.
func (k *KeybaseServiceBase) KeyfamilyChanged(ctx context.Context,
	uid keybase1.UID) error {
	k.log.CDebugf(ctx, "Key family for user %s changed", uid)
	k.setCachedUserInfo(uid, idutil.UserInfo{})

	if k.getCachedCurrentSession().UID == uid {
		mdServer := k.config.MDServer()
		if mdServer != nil {
			// Ignore any errors for now, we don't want to block this
			// notification and it's not worth spawning a goroutine for.
			mdServer.CheckForRekeys(context.Background())
		}
	}

	return nil
}

// ReachabilityChanged implements keybase1.ReachabiltyInterface.
func (k *KeybaseServiceBase) ReachabilityChanged(ctx context.Context,
	reachability keybase1.Reachability) error {
	k.log.CDebugf(ctx, "CheckReachability invoked: %v", reachability)
	if reachability.Reachable == keybase1.Reachable_YES {
		k.config.KBFSOps().PushConnectionStatusChange(GregorServiceName, nil)
	} else {
		k.config.KBFSOps().PushConnectionStatusChange(
			GregorServiceName, errDisconnected{})
	}
	mdServer := k.config.MDServer()
	if mdServer != nil {
		mdServer.CheckReachability(ctx)
	}
	return nil
}

// StartReachability implements keybase1.ReachabilityInterface.
func (k *KeybaseServiceBase) StartReachability(ctx context.Context) (res keybase1.Reachability, err error) {
	return k.CheckReachability(ctx)
}

// CheckReachability implements keybase1.ReachabilityInterface.
func (k *KeybaseServiceBase) CheckReachability(ctx context.Context) (res keybase1.Reachability, err error) {
	res.Reachable = keybase1.Reachable_NO
	mdServer := k.config.MDServer()
	if mdServer != nil && mdServer.IsConnected() {
		res.Reachable = keybase1.Reachable_YES
	}
	return res, nil
}

// PaperKeyCached implements keybase1.NotifyPaperKeyInterface.
func (k *KeybaseServiceBase) PaperKeyCached(ctx context.Context,
	arg keybase1.PaperKeyCachedArg) error {
	k.log.CDebugf(ctx, "Paper key for %s cached", arg.Uid)

	if k.getCachedCurrentSession().UID == arg.Uid {
		err := k.config.KBFSOps().KickoffAllOutstandingRekeys()
		if err != nil {
			// Ignore and log errors here. For now the only way it could error
			// is when the method is called on a folderBranchOps which is a
			// developer mistake and not recoverable from code.
			k.log.CDebugf(ctx,
				"Calling KickoffAllOutstandingRekeys error: %s", err)
		}
		// Ignore any errors for now, we don't want to block this
		// notification and it's not worth spawning a goroutine for.
		mdServer := k.config.MDServer()
		if mdServer != nil {
			mdServer.CheckForRekeys(context.Background())
		}
	}

	return nil
}

// ClientOutOfDate implements keybase1.NotifySessionInterface.
func (k *KeybaseServiceBase) ClientOutOfDate(ctx context.Context,
	arg keybase1.ClientOutOfDateArg) error {
	k.log.CDebugf(ctx, "Client out of date: %v", arg)
	return nil
}

// RootAuditError implements keybase1.NotifyAuditInterface.
func (k *KeybaseServiceBase) RootAuditError(ctx context.Context,
	arg keybase1.RootAuditErrorArg) error {
	k.log.CDebugf(ctx, "Merkle tree audit error: %v", arg.Message)
	return nil
}

// ConvertIdentifyError converts a errors during identify into KBFS errors
func ConvertIdentifyError(assertion string, err error) error {
	switch err.(type) {
	case libkb.NotFoundError:
		return idutil.NoSuchUserError{Input: assertion}
	case libkb.ResolutionError:
		return idutil.NoSuchUserError{Input: assertion}
	}
	return err
}

// Resolve implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) Resolve(
	ctx context.Context, assertion string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	res, err := k.identifyClient.Resolve3(
		ctx, keybase1.Resolve3Arg{
			Assertion: assertion,
			Oa:        offline,
		})
	if err != nil {
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			ConvertIdentifyError(assertion, err)
	}
	return kbname.NewNormalizedUsername(res.Name), res.Id, nil
}

// Identify implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
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
		Oa:            offline,
	}

	ei := tlfhandle.GetExtendedIdentify(ctx)
	arg.IdentifyBehavior = ei.Behavior

	res, err := k.identifyClient.IdentifyLite(ctx, arg)
	// IdentifyLite still returns keybase1.UserPlusKeys data (sans
	// keys), even if it gives a NoSigChainError or a UserDeletedError,
	// and in KBFS it's fine if the user doesn't have a full sigchain
	// (e.g., it's just like the sharing before signup case, except
	// the user already has a UID).  Both types of users are based
	// entirely on server trust anyway.
	switch err.(type) {
	case nil:
	case libkb.NoSigChainError, libkb.UserDeletedError:
		ei.OnError(ctx)
		// But if the username is blame, just return it, since the
		// returned username would be useless and confusing.
		if res.Ul.Name == "" {
			return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
		}
		k.log.CDebugf(ctx,
			"Ignoring error (%s) for user %s with no sigchain; "+
				"error type=%T", err, res.Ul.Name, err)
	default:
		// If the caller is waiting for breaks, let them know we got an error.
		ei.OnError(ctx)
		return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
			ConvertIdentifyError(assertion, err)
	}

	// This is required for every identify call. The userBreak
	// function will take care of checking if res.TrackBreaks is nil
	// or not.
	name := kbname.NormalizedUsername(res.Ul.Name)
	if res.Ul.Id.IsUser() {
		asUser, err := res.Ul.Id.AsUser()
		if err != nil {
			return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""), err
		}
		ei.UserBreak(ctx, name, asUser, res.TrackBreaks)
	} else if !res.Ul.Id.IsNil() {
		ei.TeamBreak(ctx, res.Ul.Id.AsTeamOrBust(), res.TrackBreaks)
	}

	return name, res.Ul.Id, nil
}

// NormalizeSocialAssertion implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (keybase1.SocialAssertion, error) {
	return k.identifyClient.NormalizeSocialAssertion(ctx, assertion)
}

// ResolveIdentifyImplicitTeam implements the KeybaseService interface
// for KeybaseServiceBase.
func (k *KeybaseServiceBase) ResolveIdentifyImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	doIdentifies bool, reason string,
	offline keybase1.OfflineAvailability) (idutil.ImplicitTeamInfo, error) {
	if tlfType != tlf.Private && tlfType != tlf.Public {
		return idutil.ImplicitTeamInfo{}, fmt.Errorf(
			"Invalid implicit team TLF type: %s", tlfType)
	}

	arg := keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:   assertions,
		Suffix:       suffix,
		DoIdentifies: doIdentifies,
		Reason:       keybase1.IdentifyReason{Reason: reason},
		Create:       true,
		IsPublic:     tlfType == tlf.Public,
		Oa:           offline,
	}

	ei := tlfhandle.GetExtendedIdentify(ctx)
	arg.IdentifyBehavior = ei.Behavior

	res, err := k.identifyClient.ResolveIdentifyImplicitTeam(ctx, arg)
	if err != nil {
		return idutil.ImplicitTeamInfo{}, ConvertIdentifyError(assertions, err)
	}
	if strings.Contains(res.DisplayName, "_implicit_team_") {
		k.log.CWarningf(
			ctx, "Got display name %s for assertions %s",
			res.DisplayName, assertions)
	}
	name := kbname.NormalizedUsername(res.DisplayName)

	// Exactly one break callback is required for every identify call.
	if doIdentifies {
		if len(res.TrackBreaks) > 0 {
			// Iterate the map to get one entry, then break.
			for userVer, breaks := range res.TrackBreaks {
				// TODO: resolve the UID into a username so we don't have to
				// pass in the full display name here?
				ei.UserBreak(ctx, name, userVer.Uid, &breaks)
				break
			}
		} else {
			ei.TeamBreak(ctx, keybase1.TeamID(""), nil)
		}
	}

	iteamInfo := idutil.ImplicitTeamInfo{
		Name: name,
		TID:  res.TeamID,
	}
	if res.FolderID != "" {
		iteamInfo.TlfID, err = tlf.ParseID(res.FolderID.String())
		if err != nil {
			return idutil.ImplicitTeamInfo{}, err
		}
	}

	return iteamInfo, nil
}

// ResolveImplicitTeamByID implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) ResolveImplicitTeamByID(
	ctx context.Context, teamID keybase1.TeamID) (name string, err error) {
	arg := keybase1.ResolveImplicitTeamArg{
		Id: teamID,
	}

	res, err := k.identifyClient.ResolveImplicitTeam(ctx, arg)
	if err != nil {
		return "", err
	}
	return res.Name, nil
}

func (k *KeybaseServiceBase) checkForRevokedVerifyingKey(
	ctx context.Context, currUserInfo idutil.UserInfo, kid keybase1.KID) (
	newUserInfo idutil.UserInfo, exists bool, err error) {
	newUserInfo = currUserInfo
	for key, info := range currUserInfo.RevokedVerifyingKeys {
		if !key.KID().Equal(kid) {
			continue
		}
		exists = true
		if info.FilledInMerkle() {
			break
		}

		k.log.CDebugf(ctx, "Filling in merkle info for user %s, revoked key %s",
			currUserInfo.UID, kid)

		// If possible, ask the service to give us the first merkle
		// root that covers this revoke. Some older device revokes
		// didn't yet include a prev field, so we can't refine the
		// merkle root in those cases, and will be relying only on
		// server trust.
		if info.MerkleRoot.Seqno > 0 {
			var res keybase1.NextMerkleRootRes
			resetSeqno, isReset := info.ResetInfo()
			if isReset {
				res, err = k.userClient.FindNextMerkleRootAfterReset(ctx,
					keybase1.FindNextMerkleRootAfterResetArg{
						Uid:        currUserInfo.UID,
						ResetSeqno: resetSeqno,
						Prev: keybase1.ResetMerkleRoot{
							Seqno:    info.MerkleRoot.Seqno,
							HashMeta: info.MerkleRoot.HashMeta,
						},
					})
			} else {
				res, err = k.userClient.FindNextMerkleRootAfterRevoke(ctx,
					keybase1.FindNextMerkleRootAfterRevokeArg{
						Uid:  currUserInfo.UID,
						Kid:  kid,
						Loc:  info.SigChainLocation(),
						Prev: info.MerkleRoot,
					})
			}
			if m, ok := err.(libkb.MerkleClientError); ok && m.IsOldTree() { // nolint
				k.log.CDebugf(ctx, "Merkle root is too old for checking "+
					"the revoked key: %+v", err)
				info.MerkleRoot.Seqno = 0
			} else if err != nil {
				return idutil.UserInfo{}, false, err
			} else if res.Res != nil {
				info.MerkleRoot = *res.Res
			}
		}
		info.SetFilledInMerkle(true)
		newUserInfo = currUserInfo.DeepCopy()
		newUserInfo.RevokedVerifyingKeys[key] = info
		k.setCachedUserInfo(newUserInfo.UID, newUserInfo)
		break
	}

	return newUserInfo, exists, nil
}

// LoadUserPlusKeys implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) LoadUserPlusKeys(
	ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID,
	offline keybase1.OfflineAvailability) (idutil.UserInfo, error) {
	cachedUserInfo := k.getCachedUserInfo(uid)
	if cachedUserInfo.Name != kbname.NormalizedUsername("") {
		if pollForKID == keybase1.KID("") {
			return cachedUserInfo, nil
		}
		// Skip the cache if pollForKID isn't present in
		// `VerifyingKeys` or one of the revoked verifying keys.
		for _, key := range cachedUserInfo.VerifyingKeys {
			if key.KID().Equal(pollForKID) {
				return cachedUserInfo, nil
			}
		}

		// Check if the key is revoked, and fill in the merkle info in
		// that case.
		cachedUserInfo, exists, err := k.checkForRevokedVerifyingKey(
			ctx, cachedUserInfo, pollForKID)
		if err != nil {
			return idutil.UserInfo{}, err
		}
		if exists {
			return cachedUserInfo, nil
		}
	}

	arg := keybase1.LoadUserPlusKeysV2Arg{
		Uid:        uid,
		PollForKID: pollForKID,
		Oa:         offline,
	}
	res, err := k.userClient.LoadUserPlusKeysV2(ctx, arg)
	if err != nil {
		return idutil.UserInfo{}, err
	}

	userInfo, err := k.processUserPlusKeys(ctx, res)
	if err != nil {
		return idutil.UserInfo{}, err
	}

	if pollForKID != keybase1.KID("") {
		// Fill in merkle info if we were explicitly trying to load a
		// revoked key.
		userInfo, _, err = k.checkForRevokedVerifyingKey(
			ctx, userInfo, pollForKID)
		if err != nil {
			return idutil.UserInfo{}, err
		}
	}
	return userInfo, nil
}

func (k *KeybaseServiceBase) getLastWriterInfo(
	ctx context.Context, teamInfo idutil.TeamInfo, tlfType tlf.Type,
	user keybase1.UID, verifyingKey kbfscrypto.VerifyingKey) (
	idutil.TeamInfo, error) {
	if _, ok := teamInfo.LastWriters[verifyingKey]; ok {
		// Already cached, nothing to do.
		return teamInfo, nil
	}

	res, err := k.teamsClient.FindNextMerkleRootAfterTeamRemovalBySigningKey(
		ctx, keybase1.FindNextMerkleRootAfterTeamRemovalBySigningKeyArg{
			Uid:        user,
			SigningKey: verifyingKey.KID(),
			Team:       teamInfo.TID,
			IsPublic:   tlfType == tlf.Public,
		})
	if err != nil {
		return idutil.TeamInfo{}, err
	}

	// Copy any old data to avoid races.
	newLastWriters := make(
		map[kbfscrypto.VerifyingKey]keybase1.MerkleRootV2,
		len(teamInfo.LastWriters)+1)
	for k, v := range teamInfo.LastWriters {
		newLastWriters[k] = v
	}
	newLastWriters[verifyingKey] = *res.Res
	teamInfo.LastWriters = newLastWriters
	return teamInfo, nil
}

var allowedLoadTeamRoles = map[keybase1.TeamRole]bool{
	keybase1.TeamRole_NONE:   true,
	keybase1.TeamRole_WRITER: true,
	keybase1.TeamRole_READER: true,
}

// LoadTeamPlusKeys implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) LoadTeamPlusKeys(
	ctx context.Context, tid keybase1.TeamID, tlfType tlf.Type,
	desiredKeyGen kbfsmd.KeyGen, desiredUser keybase1.UserVersion,
	desiredKey kbfscrypto.VerifyingKey, desiredRole keybase1.TeamRole,
	offline keybase1.OfflineAvailability) (idutil.TeamInfo, error) {
	if !allowedLoadTeamRoles[desiredRole] {
		panic(fmt.Sprintf("Disallowed team role: %v", desiredRole))
	}

	cachedTeamInfo := k.getCachedTeamInfo(tid)
	if cachedTeamInfo.Name != kbname.NormalizedUsername("") {
		// If the cached team info doesn't satisfy our desires, don't
		// use it.
		satisfiesDesires := true
		if desiredKeyGen >= kbfsmd.FirstValidKeyGen {
			// If `desiredKeyGen` is at most as large as the keygen in
			// the cached latest team info, then our cached info
			// satisfies our desires.
			satisfiesDesires = desiredKeyGen <= cachedTeamInfo.LatestKeyGen
		}

		if satisfiesDesires && desiredUser.Uid.Exists() {
			// If the user is in the writer map, that satisfies none, reader
			// or writer desires.
			satisfiesDesires = cachedTeamInfo.Writers[desiredUser.Uid]
			if !satisfiesDesires {
				if desiredRole == keybase1.TeamRole_NONE ||
					desiredRole == keybase1.TeamRole_READER {
					// If the user isn't a writer, but the desired
					// role is a reader, we need to check the reader
					// map explicitly.
					satisfiesDesires = cachedTeamInfo.Readers[desiredUser.Uid]
				} else {
					if !desiredKey.IsNil() {
						// If the desired role was at least a writer, but
						// the user isn't currently a writer, see if they
						// ever were.
						var err error
						cachedTeamInfo, err = k.getLastWriterInfo(
							ctx, cachedTeamInfo, tlfType, desiredUser.Uid,
							desiredKey)
						if err != nil {
							return idutil.TeamInfo{}, err
						}
						k.setCachedTeamInfo(tid, cachedTeamInfo)
					}

					// If we have recently learned that the user is
					// not a writer (e.g., of a public folder), we
					// should rely on that cached info to avoid
					// looking that up too often.
					satisfiesDesires = k.getCachedNotWriter(
						tid, desiredUser.Uid)
				}
			}
		}

		if satisfiesDesires {
			return cachedTeamInfo, nil
		}
	}

	arg := keybase1.LoadTeamPlusApplicationKeysArg{
		Id:              tid,
		Application:     keybase1.TeamApplication_KBFS,
		IncludeKBFSKeys: true,
		Oa:              offline,
	}

	if desiredKeyGen >= kbfsmd.FirstValidKeyGen {
		arg.Refreshers.NeedApplicationsAtGenerationsWithKBFS =
			map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
				keybase1.PerTeamKeyGeneration(desiredKeyGen): {
					keybase1.TeamApplication_KBFS,
				},
			}
	}

	if desiredUser.Uid.Exists() && desiredKey.IsNil() {
		arg.Refreshers.WantMembers = append(
			arg.Refreshers.WantMembers, desiredUser)
		arg.Refreshers.WantMembersRole = desiredRole
	}

	res, err := k.teamsClient.LoadTeamPlusApplicationKeys(ctx, arg)
	if err != nil {
		return idutil.TeamInfo{}, err
	}

	if tid != res.Id {
		return idutil.TeamInfo{}, fmt.Errorf(
			"TID doesn't match: %s vs %s", tid, res.Id)
	}

	info := idutil.TeamInfo{
		Name:      kbname.NormalizedUsername(res.Name),
		TID:       res.Id,
		CryptKeys: make(map[kbfsmd.KeyGen]kbfscrypto.TLFCryptKey),
		Writers:   make(map[keybase1.UID]bool),
		Readers:   make(map[keybase1.UID]bool),
	}
	for _, key := range res.ApplicationKeys {
		keyGen := kbfsmd.KeyGen(key.KeyGeneration)
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

	// For subteams, get the root team ID.
	if tid.IsSubTeam() {
		rootID, err := k.teamsClient.GetTeamRootID(ctx, tid)
		if err != nil {
			return idutil.TeamInfo{}, err
		}
		info.RootID = rootID
	}

	// Fill in `LastWriters`, only if needed.
	if desiredUser.Uid.Exists() && desiredRole == keybase1.TeamRole_WRITER &&
		!info.Writers[desiredUser.Uid] && !desiredKey.IsNil() {
		info, err = k.getLastWriterInfo(
			ctx, info, tlfType, desiredUser.Uid, desiredKey)
		if err != nil {
			return idutil.TeamInfo{}, err
		}
	}

	k.setCachedTeamInfo(tid, info)

	if desiredUser.Uid.Exists() && !info.Writers[desiredUser.Uid] &&
		!(desiredRole == keybase1.TeamRole_NONE ||
			desiredRole == keybase1.TeamRole_READER) {
		// Remember that this user was not a writer for a short
		// amount of time, to avoid repeated lookups for writers
		// in a public folder (for example).
		k.setCachedNotWriter(tid, desiredUser.Uid)
	}

	return info, nil
}

// CreateTeamTLF implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) CreateTeamTLF(
	ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) (err error) {
	return k.kbfsClient.CreateTLF(ctx, keybase1.CreateTLFArg{
		TeamID: teamID,
		TlfID:  keybase1.TLFID(tlfID.String()),
	})
}

// GetTeamSettings implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetTeamSettings(
	ctx context.Context, teamID keybase1.TeamID,
	offline keybase1.OfflineAvailability) (
	keybase1.KBFSTeamSettings, error) {
	// TODO: get invalidations from the server and cache the settings?
	return k.kbfsClient.GetKBFSTeamSettings(
		ctx, keybase1.GetKBFSTeamSettingsArg{
			TeamID: teamID,
			Oa:     offline,
		})
}

func (k *KeybaseServiceBase) getCurrentMerkleRoot(ctx context.Context) (
	keybase1.MerkleRootV2, time.Time, error) {
	const merkleFreshnessMs = int(time.Second * 60 / time.Millisecond)
	res, err := k.merkleClient.GetCurrentMerkleRoot(ctx, merkleFreshnessMs)
	if err != nil {
		return keybase1.MerkleRootV2{}, time.Time{}, err
	}

	return res.Root, keybase1.FromTime(res.UpdateTime), nil
}

// GetCurrentMerkleRoot implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetCurrentMerkleRoot(ctx context.Context) (
	keybase1.MerkleRootV2, time.Time, error) {
	// Refresh the cached value in the background if the cached value
	// is older than 30s; if our cached value is more than 60s old,
	// block.
	_, root, rootTime, err := k.merkleRoot.Get(
		ctx, 30*time.Second, 60*time.Second)
	return root, rootTime, err
}

// VerifyMerkleRoot implements the KBPKI interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) VerifyMerkleRoot(
	ctx context.Context, root keybase1.MerkleRootV2,
	kbfsRoot keybase1.KBFSRoot) error {
	return k.merkleClient.VerifyMerkleRootAndKBFS(ctx,
		keybase1.VerifyMerkleRootAndKBFSArg{
			Root:             root,
			ExpectedKBFSRoot: kbfsRoot,
		})
}

func (k *KeybaseServiceBase) processUserPlusKeys(
	ctx context.Context, upk keybase1.UserPlusKeysV2AllIncarnations) (
	idutil.UserInfo, error) {
	verifyingKeys, cryptPublicKeys, kidNames, err := filterKeys(
		upk.Current.DeviceKeys)
	if err != nil {
		return idutil.UserInfo{}, err
	}

	revokedVerifyingKeys, revokedCryptPublicKeys, revokedKidNames, err :=
		k.filterRevokedKeys(
			ctx, upk.Current.Uid, upk.Current.DeviceKeys, upk.Current.Reset)
	if err != nil {
		return idutil.UserInfo{}, err
	}

	if len(revokedKidNames) > 0 {
		for k, v := range revokedKidNames {
			kidNames[k] = v
		}
	}

	for _, incarnation := range upk.PastIncarnations {
		revokedVerifyingKeysPast, revokedCryptPublicKeysPast,
			revokedKidNames, err :=
			k.filterRevokedKeys(
				ctx, incarnation.Uid, incarnation.DeviceKeys, incarnation.Reset)
		if err != nil {
			return idutil.UserInfo{}, err
		}

		if len(revokedKidNames) > 0 {
			for k, v := range revokedKidNames {
				kidNames[k] = v
			}
		}

		for k, v := range revokedVerifyingKeysPast {
			revokedVerifyingKeys[k] = v
		}
		for k, v := range revokedCryptPublicKeysPast {
			revokedCryptPublicKeys[k] = v
		}
	}

	u := idutil.UserInfo{
		Name: kbname.NewNormalizedUsername(
			upk.Current.Username),
		UID:                    upk.Current.Uid,
		VerifyingKeys:          verifyingKeys,
		CryptPublicKeys:        cryptPublicKeys,
		KIDNames:               kidNames,
		EldestSeqno:            upk.Current.EldestSeqno,
		RevokedVerifyingKeys:   revokedVerifyingKeys,
		RevokedCryptPublicKeys: revokedCryptPublicKeys,
	}

	k.setCachedUserInfo(upk.Current.Uid, u)
	return u, nil
}

func (k *KeybaseServiceBase) getCachedCurrentSessionOrInProgressCh() (
	cachedSession idutil.SessionInfo, inProgressCh chan struct{}, doRPC bool) {
	k.sessionCacheLock.Lock()
	defer k.sessionCacheLock.Unlock()

	if k.cachedCurrentSession != (idutil.SessionInfo{}) {
		return k.cachedCurrentSession, nil, false
	}

	// If someone already started the RPC, wait for them (and release
	// the lock).
	if k.sessionInProgressCh != nil {
		return idutil.SessionInfo{}, k.sessionInProgressCh, false
	}

	k.sessionInProgressCh = make(chan struct{})
	return idutil.SessionInfo{}, k.sessionInProgressCh, true
}

func (k *KeybaseServiceBase) getCurrentSession(
	ctx context.Context, sessionID int) (idutil.SessionInfo, bool, error) {
	var cachedCurrentSession idutil.SessionInfo
	var inProgressCh chan struct{}
	doRPC := false
	// Loop until either we have the session info, or until we are the
	// sole goroutine that needs to make the RPC.  Avoid holding the
	// session cache lock during the RPC, since that can result in a
	// deadlock if the RPC results in a call to `ClearCaches()`.
	for !doRPC {
		cachedCurrentSession, inProgressCh, doRPC =
			k.getCachedCurrentSessionOrInProgressCh()
		if cachedCurrentSession != (idutil.SessionInfo{}) {
			return cachedCurrentSession, false, nil
		}

		if !doRPC {
			// Wait for another goroutine to finish the RPC.
			select {
			case <-inProgressCh:
			case <-ctx.Done():
				return idutil.SessionInfo{}, false, ctx.Err()
			}
		}
	}

	var s idutil.SessionInfo
	// Close and clear the in-progress channel, even on an error.
	defer func() {
		k.sessionCacheLock.Lock()
		defer k.sessionCacheLock.Unlock()
		k.cachedCurrentSession = s
		close(k.sessionInProgressCh)
		k.sessionInProgressCh = nil
	}()

	res, err := k.sessionClient.CurrentSession(ctx, sessionID)
	if err != nil {
		if _, ok := err.(libkb.NoSessionError); ok {
			// Use an error with a proper OS error code attached to it.
			err = idutil.NoCurrentSessionError{}
		}
		return idutil.SessionInfo{}, false, err
	}
	s, err = idutil.SessionInfoFromProtocol(res)
	if err != nil {
		return idutil.SessionInfo{}, false, err
	}

	k.log.CDebugf(
		ctx, "new session with username %s, uid %s, crypt public key %s, and verifying key %s",
		s.Name, s.UID, s.CryptPublicKey, s.VerifyingKey)
	return s, true, nil
}

// CurrentSession implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) CurrentSession(
	ctx context.Context, sessionID int) (
	idutil.SessionInfo, error) {
	ctx = CtxWithRandomIDReplayable(
		ctx, CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID, k.log)

	s, newSession, err := k.getCurrentSession(ctx, sessionID)
	if err != nil {
		return idutil.SessionInfo{}, err
	}

	if newSession && k.config != nil {
		// Don't hold the lock while calling `serviceLoggedIn`.
		_ = serviceLoggedIn(ctx, k.config, s, TLFJournalBackgroundWorkEnabled)
	}

	return s, nil
}

// FavoriteAdd implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) FavoriteAdd(ctx context.Context, folder keybase1.FolderHandle) error {
	return k.favoriteClient.FavoriteAdd(ctx, keybase1.FavoriteAddArg{Folder: folder})
}

// FavoriteDelete implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) FavoriteDelete(ctx context.Context, folder keybase1.FolderHandle) error {
	return k.favoriteClient.FavoriteIgnore(ctx,
		keybase1.FavoriteIgnoreArg{Folder: folder})
}

// FavoriteList implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) FavoriteList(ctx context.Context,
	sessionID int) (keybase1.FavoritesResult, error) {
	return k.favoriteClient.GetFavorites(ctx, sessionID)
}

// EncryptFavorites encrypts cached favorites to store on disk.
func (k *KeybaseServiceBase) EncryptFavorites(ctx context.Context, dataToEncrypt []byte) (res []byte, err error) {
	return k.kbfsClient.EncryptFavorites(ctx, dataToEncrypt)
}

// DecryptFavorites decrypts cached favorites stored on disk.
func (k *KeybaseServiceBase) DecryptFavorites(ctx context.Context, dataToEncrypt []byte) (res []byte, err error) {
	return k.kbfsClient.DecryptFavorites(ctx, dataToEncrypt)
}

// NotifyOnlineStatusChanged implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) NotifyOnlineStatusChanged(ctx context.Context,
	online bool) error {
	k.log.CDebugf(ctx, "Sending notification for onlineStatus: online=%v", online)
	return k.kbfsClient.FSOnlineStatusChangedEvent(ctx, online)
}

// Notify implements the KeybaseService interface for KeybaseServiceBase.
func (k *KeybaseServiceBase) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return k.kbfsClient.FSEvent(ctx, *notification)
}

// NotifyPathUpdated implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) NotifyPathUpdated(
	ctx context.Context, path string) error {
	return k.kbfsClient.FSPathUpdate(ctx, path)
}

// NotifySyncStatus implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) NotifySyncStatus(ctx context.Context,
	status *keybase1.FSPathSyncStatus) error {
	return k.kbfsClient.FSSyncEvent(ctx, *status)
}

// NotifyOverallSyncStatus implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) NotifyOverallSyncStatus(
	ctx context.Context, status keybase1.FolderSyncStatus) error {
	return k.kbfsClient.FSOverallSyncEvent(ctx, status)
}

// NotifyFavoritesChanged implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) NotifyFavoritesChanged(ctx context.Context) error {
	return k.kbfsClient.FSFavoritesChangedEvent(ctx)
}

// OnPathChange implements the SubscriptionNotifier interface.
func (k *KeybaseServiceBase) OnPathChange(
	clientID SubscriptionManagerClientID,
	subscriptionIDs []SubscriptionID, path string,
	topics []keybase1.PathSubscriptionTopic) {
	subscriptionIDStrings := make([]string, 0, len(subscriptionIDs))
	for _, sid := range subscriptionIDs {
		subscriptionIDStrings = append(subscriptionIDStrings, string(sid))
	}
	err := k.kbfsClient.FSSubscriptionNotifyPathEvent(
		context.Background(), keybase1.FSSubscriptionNotifyPathEventArg{
			ClientID:        string(clientID),
			SubscriptionIDs: subscriptionIDStrings,
			Path:            path,
			Topics:          topics,
		})
	if err != nil {
		k.log.CDebugf(
			context.TODO(), "Couldn't send path change notification: %+v", err)
	}
}

// OnNonPathChange implements the SubscriptionNotifier interface.
func (k *KeybaseServiceBase) OnNonPathChange(
	clientID SubscriptionManagerClientID,
	subscriptionIDs []SubscriptionID, topic keybase1.SubscriptionTopic) {
	subscriptionIDStrings := make([]string, 0, len(subscriptionIDs))
	for _, sid := range subscriptionIDs {
		subscriptionIDStrings = append(subscriptionIDStrings, string(sid))
	}
	err := k.kbfsClient.FSSubscriptionNotifyEvent(context.Background(),
		keybase1.FSSubscriptionNotifyEventArg{
			ClientID:        string(clientID),
			SubscriptionIDs: subscriptionIDStrings,
			Topic:           topic,
		})
	if err != nil {
		k.log.CDebugf(
			context.TODO(),
			"Couldn't send non-path change notification: %+v", err)
	}
}

// FlushUserFromLocalCache implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FlushUserFromLocalCache(ctx context.Context,
	uid keybase1.UID) {
	k.log.CDebugf(ctx, "Flushing cache for user %s", uid)
	k.setCachedUserInfo(uid, idutil.UserInfo{})
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

// FSEditListRequest implements keybase1.NotifyFSRequestInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FSEditListRequest(ctx context.Context,
	req keybase1.FSEditListRequest) (err error) {
	ctx = CtxWithRandomIDReplayable(ctx, CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID,
		k.log)
	k.log.CDebugf(ctx, "Edit list request for %s (public: %t)",
		req.Folder.Name, !req.Folder.Private)
	tlfHandle, err := getHandleFromFolderName(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, req.Folder.Name,
		!req.Folder.Private)
	if err != nil {
		return err
	}

	rootNode, _, err := k.config.KBFSOps().
		GetOrCreateRootNode(ctx, tlfHandle, data.MasterBranch)
	if err != nil {
		return err
	}
	history, err := k.config.KBFSOps().GetEditHistory(ctx,
		rootNode.GetFolderBranch())
	if err != nil {
		return err
	}

	// TODO(KBFS-2996) Convert the edits to an RPC response.
	resp := keybase1.FSEditListArg{
		RequestID: req.RequestID,
		Edits:     history,
	}

	k.log.CDebugf(ctx, "Sending edit history response with %d writer clusters",
		len(resp.Edits.History))
	return k.kbfsClient.FSEditList(ctx, resp)
}

// FSSyncStatusRequest implements keybase1.NotifyFSRequestInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FSSyncStatusRequest(ctx context.Context,
	req keybase1.FSSyncStatusRequest) (err error) {
	k.log.CDebugf(ctx, "Got sync status request: %v", req)

	resp := keybase1.FSSyncStatusArg{RequestID: req.RequestID}

	// For now, just return the number of syncing bytes.
	jManager, err := GetJournalManager(k.config)
	if err == nil {
		status, _ := jManager.Status(ctx)
		resp.Status.TotalSyncingBytes = status.UnflushedBytes
		k.log.CDebugf(ctx, "Sending sync status response with %d syncing bytes",
			status.UnflushedBytes)
	} else {
		k.log.CDebugf(ctx, "No journal server, sending empty response")
	}

	return k.kbfsClient.FSSyncStatus(ctx, resp)
}

// TeamChangedByID implements keybase1.NotifyTeamInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) TeamChangedByID(ctx context.Context,
	arg keybase1.TeamChangedByIDArg) error {
	k.log.CDebugf(ctx, "Flushing cache for team %s "+
		"(membershipChange=%t, keyRotated=%t, renamed=%t)",
		arg.TeamID, arg.Changes.MembershipChanged,
		arg.Changes.KeyRotated, arg.Changes.Renamed)
	k.setCachedTeamInfo(arg.TeamID, idutil.TeamInfo{})

	if arg.Changes.Renamed {
		k.config.KBFSOps().TeamNameChanged(ctx, arg.TeamID)
	}
	return nil
}

// TeamChangedByName implements keybase1.NotifyTeamInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) TeamChangedByName(ctx context.Context,
	arg keybase1.TeamChangedByNameArg) error {
	// ignore
	return nil
}

// TeamDeleted implements keybase1.NotifyTeamInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) TeamDeleted(ctx context.Context,
	teamID keybase1.TeamID) error {
	return nil
}

// TeamExit implements keybase1.NotifyTeamInterface for KeybaseServiceBase.
func (k *KeybaseDaemonRPC) TeamExit(context.Context, keybase1.TeamID) error {
	return nil
}

// TeamRoleMapChanged implements keybase1.NotifyTeamInterface for KeybaseServiceBase.
func (k *KeybaseDaemonRPC) TeamRoleMapChanged(context.Context, keybase1.UserTeamVersion) error {
	return nil
}

// NewlyAddedToTeam implements keybase1.NotifyTeamInterface for
// KeybaseServiceBase.
func (k *KeybaseDaemonRPC) NewlyAddedToTeam(context.Context, keybase1.TeamID) error {
	return nil
}

// TeamMetadataUpdate implements keybase1.NotifyTeamInterface for
// KeybaseServiceBase.
func (k *KeybaseDaemonRPC) TeamMetadataUpdate(context.Context) error {
	return nil
}

// TeamAbandoned implements keybase1.NotifyTeamInterface for KeybaseServiceBase.
func (k *KeybaseDaemonRPC) TeamAbandoned(
	ctx context.Context, tid keybase1.TeamID) error {
	k.log.CDebugf(ctx, "Implicit team %s abandoned", tid)
	k.setCachedTeamInfo(tid, idutil.TeamInfo{})
	k.config.KBFSOps().TeamAbandoned(ctx, tid)
	return nil
}

// AvatarUpdated implements keybase1.NotifyTeamInterface for KeybaseServiceBase.
func (k *KeybaseDaemonRPC) AvatarUpdated(ctx context.Context,
	arg keybase1.AvatarUpdatedArg) error {
	return nil
}

// TeamTreeMembershipsPartial implements keybase1.NotifyTeamInterface for KeybaseServiceBase.
func (k *KeybaseDaemonRPC) TeamTreeMembershipsPartial(context.Context,
	keybase1.TeamTreeMembership) error {
	return nil
}

// TeamTreeMembershipsDone implements keybase1.NotifyTeamInterface for KeybaseServiceBase.
func (k *KeybaseDaemonRPC) TeamTreeMembershipsDone(context.Context,
	keybase1.TeamTreeMembershipsDoneResult) error {
	return nil
}

// StartMigration implements keybase1.ImplicitTeamMigrationInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) StartMigration(ctx context.Context,
	folder keybase1.Folder) (err error) {
	mdServer := k.config.MDServer()
	if mdServer == nil {
		return errors.New("no mdserver")
	}
	// Making a favorite here to reuse the code that converts from
	// `keybase1.FolderType` into `tlf.Type`.
	fav := favorites.NewFolderFromProtocol(folder)
	handle, err := GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, fav.Name, fav.Type)
	if err != nil {
		return err
	}
	// Before taking the lock, first make sure this device can handle
	// the migration.
	tlfID := handle.TlfID()
	err = k.config.KBFSOps().CheckMigrationPerms(ctx, tlfID)
	if err != nil {
		k.log.CDebugf(ctx, "This device cannot migrate %s: %+v", tlfID, err)
		return err
	}
	return k.config.MDServer().StartImplicitTeamMigration(ctx, tlfID)
}

// FinalizeMigration implements keybase1.ImplicitTeamMigrationInterface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) FinalizeMigration(ctx context.Context,
	folder keybase1.Folder) (err error) {
	fav := favorites.NewFolderFromProtocol(folder)
	handle, err := GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, fav.Name, fav.Type)
	if err != nil {
		return err
	}
	if handle.TypeForKeying() == tlf.TeamKeying {
		// Clear the cache for this implicit team, to ensure we get
		// all the latest key generations for the team info during the
		// migration.
		id := handle.FirstResolvedWriter()
		if id.IsTeamOrSubteam() {
			tid, err := id.AsTeam()
			if err != nil {
				return err
			}
			k.log.CDebugf(ctx, "Clearing team info for tid=%s, handle=%s",
				tid, handle.GetCanonicalPath())
			k.setCachedTeamInfo(tid, idutil.TeamInfo{})
		}
	}
	return k.config.KBFSOps().MigrateToImplicitTeam(ctx, handle.TlfID())
}

// GetTLFCryptKeys implements the TlfKeysInterface interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetTLFCryptKeys(ctx context.Context,
	query keybase1.TLFQuery) (res keybase1.GetTLFCryptKeysRes, err error) {
	if ctx, err = tlfhandle.MakeExtendedIdentify(
		CtxWithRandomIDReplayable(ctx,
			CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID, k.log),
		query.IdentifyBehavior,
	); err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}

	tlfHandle, err := getHandleFromFolderName(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, query.TlfName, false)
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
			KeyGeneration: int(kbfsmd.FirstValidKeyGen) + i,
			Key:           keybase1.Bytes32(key.Data()),
		})
	}

	if query.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks() {
		res.NameIDBreaks.Breaks = tlfhandle.GetExtendedIdentify(ctx).
			GetTlfBreakAndClose()
	}

	return res, nil
}

// GetPublicCanonicalTLFNameAndID implements the TlfKeysInterface interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetPublicCanonicalTLFNameAndID(
	ctx context.Context, query keybase1.TLFQuery) (
	res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	if ctx, err = tlfhandle.MakeExtendedIdentify(
		CtxWithRandomIDReplayable(ctx,
			CtxKeybaseServiceIDKey, CtxKeybaseServiceOpID, k.log),
		query.IdentifyBehavior,
	); err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	tlfHandle, err := getHandleFromFolderName(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, query.TlfName,
		true /* public */)
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
		res.Breaks = tlfhandle.GetExtendedIdentify(ctx).GetTlfBreakAndClose()
	}

	return res, nil
}

// EstablishMountDir asks the service for the current mount path
func (k *KeybaseServiceBase) EstablishMountDir(ctx context.Context) (
	string, error) {
	dir, err := k.kbfsMountClient.GetCurrentMountDir(ctx)
	if err != nil {
		k.log.CInfof(ctx, "GetCurrentMountDir fails - ", err)
		return "", err
	}
	if dir == "" {
		dirs, err := k.kbfsMountClient.GetAllAvailableMountDirs(ctx)
		if err != nil {
			k.log.CInfof(ctx, "GetAllAvailableMountDirs fails - ", err)
			return "", err
		}
		dir, err = chooseDefaultMount(ctx, dirs, k.log)
		if err != nil {
			k.log.CInfof(ctx, "chooseDefaultMount fails - ", err)
			return "", err
		}
		err2 := k.kbfsMountClient.SetCurrentMountDir(ctx, dir)
		if err2 != nil {
			k.log.CInfof(ctx, "SetCurrentMountDir fails - ", err2)
		}
		// Continue mounting even if we can't save the mount
		k.log.CDebugf(ctx, "Choosing mountdir %s from %v", dir, dirs)
	}
	return dir, err
}

// PutGitMetadata implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) PutGitMetadata(
	ctx context.Context, folder keybase1.FolderHandle, repoID keybase1.RepoID,
	metadata keybase1.GitLocalMetadata) error {
	return k.gitClient.PutGitMetadata(ctx, keybase1.PutGitMetadataArg{
		Folder:   folder,
		RepoID:   repoID,
		Metadata: metadata,
	})
}

// GetKVStoreClient implements the KeybaseService interface for
// KeybaseServiceBase.
func (k *KeybaseServiceBase) GetKVStoreClient() keybase1.KvstoreInterface {
	return k.kvstoreClient
}
