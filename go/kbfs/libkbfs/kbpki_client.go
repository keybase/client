// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// keybaseServiceOwner is a wrapper around a KeybaseService, to allow
// switching the underlying service at runtime. It is usually
// implemented by Config.
type keybaseServiceOwner interface {
	KeybaseService() KeybaseService
}

// KBPKIClient uses a KeybaseService.
type KBPKIClient struct {
	serviceOwner keybaseServiceOwner
	log          logger.Logger
}

var _ KBPKI = (*KBPKIClient)(nil)

// NewKBPKIClient returns a new KBPKIClient with the given service.
func NewKBPKIClient(
	serviceOwner keybaseServiceOwner, log logger.Logger) *KBPKIClient {
	return &KBPKIClient{serviceOwner, log}
}

// GetCurrentSession implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentSession(ctx context.Context) (
	idutil.SessionInfo, error) {
	const sessionID = 0
	return k.serviceOwner.KeybaseService().CurrentSession(ctx, sessionID)
}

// Resolve implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Resolve(
	ctx context.Context, assertion string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return k.serviceOwner.KeybaseService().Resolve(ctx, assertion, offline)
}

// Identify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return k.serviceOwner.KeybaseService().Identify(
		ctx, assertion, reason, offline)
}

// NormalizeSocialAssertion implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (keybase1.SocialAssertion, error) {
	return k.serviceOwner.KeybaseService().NormalizeSocialAssertion(ctx, assertion)
}

// ResolveImplicitTeam implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) ResolveImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	offline keybase1.OfflineAvailability) (
	idutil.ImplicitTeamInfo, error) {
	return k.serviceOwner.KeybaseService().ResolveIdentifyImplicitTeam(
		ctx, assertions, suffix, tlfType, false, "", offline)
}

// ResolveImplicitTeamByID implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) ResolveImplicitTeamByID(
	ctx context.Context, teamID keybase1.TeamID, tlfType tlf.Type,
	offline keybase1.OfflineAvailability) (
	idutil.ImplicitTeamInfo, error) {
	name, err := k.serviceOwner.KeybaseService().ResolveImplicitTeamByID(
		ctx, teamID)
	if err != nil {
		return idutil.ImplicitTeamInfo{}, err
	}

	assertions, suffix, err := tlf.SplitExtension(name)
	if err != nil {
		return idutil.ImplicitTeamInfo{}, err
	}

	return k.serviceOwner.KeybaseService().ResolveIdentifyImplicitTeam(
		ctx, assertions, suffix, tlfType, false, "", offline)
}

// ResolveTeamTLFID implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) ResolveTeamTLFID(
	ctx context.Context, teamID keybase1.TeamID,
	offline keybase1.OfflineAvailability) (tlf.ID, error) {
	settings, err := k.serviceOwner.KeybaseService().GetTeamSettings(
		ctx, teamID, offline)
	if err != nil {
		return tlf.NullID, err
	}
	if settings.TlfID.IsNil() {
		return tlf.NullID, err
	}
	tlfID, err := tlf.ParseID(settings.TlfID.String())
	if err != nil {
		return tlf.NullID, err
	}
	return tlfID, nil
}

// IdentifyImplicitTeam identifies (and creates if necessary) the
// given implicit team.
func (k *KBPKIClient) IdentifyImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	reason string, offline keybase1.OfflineAvailability) (
	idutil.ImplicitTeamInfo, error) {
	return k.serviceOwner.KeybaseService().ResolveIdentifyImplicitTeam(
		ctx, assertions, suffix, tlfType, true, reason, offline)
}

// GetNormalizedUsername implements the KBPKI interface for
// KBPKIClient.
func (k *KBPKIClient) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, error) {
	var assertion string
	if id.IsUser() {
		assertion = fmt.Sprintf("uid:%s", id)
	} else {
		assertion = fmt.Sprintf("tid:%s", id)
	}
	username, _, err := k.Resolve(ctx, assertion, offline)
	if err != nil {
		return kbname.NormalizedUsername(""), err
	}
	return username, nil
}

func (k *KBPKIClient) hasVerifyingKey(
	ctx context.Context, uid keybase1.UID, verifyingKey kbfscrypto.VerifyingKey,
	atServerTime time.Time, offline keybase1.OfflineAvailability) (
	bool, error) {
	userInfo, err := k.loadUserPlusKeys(ctx, uid, verifyingKey.KID(), offline)
	if err != nil {
		return false, err
	}

	for _, key := range userInfo.VerifyingKeys {
		if verifyingKey.KID().Equal(key.KID()) {
			return true, nil
		}
	}

	info, ok := userInfo.RevokedVerifyingKeys[verifyingKey]
	if !ok {
		return false, nil
	}

	// We add some slack to the revoke time, because the MD server
	// won't instanteneously find out about the revoke -- it might
	// keep accepting writes from the revoked device for a short
	// period of time until it learns about the revoke.
	const revokeSlack = 1 * time.Minute
	revokedTime := keybase1.FromTime(info.Time)
	// Check the server times -- if the key was valid at the given
	// time, the caller can proceed with their merkle checking if
	// desired.
	if atServerTime.Before(revokedTime.Add(revokeSlack)) {
		k.log.CDebugf(ctx, "Revoked verifying key %s for user %s passes time "+
			"check (revoked time: %v vs. server time %v, slack=%s)",
			verifyingKey.KID(), uid, revokedTime, atServerTime, revokeSlack)
		return false, RevokedDeviceVerificationError{info}
	}
	k.log.CDebugf(ctx, "Not trusting revoked verifying key %s for "+
		"user %s (revoked time: %v vs. server time %v, slack=%s)",
		verifyingKey.KID(), uid, revokedTime, atServerTime, revokeSlack)
	return false, nil
}

// HasVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasVerifyingKey(
	ctx context.Context, uid keybase1.UID, verifyingKey kbfscrypto.VerifyingKey,
	atServerTime time.Time, offline keybase1.OfflineAvailability) error {
	ok, err := k.hasVerifyingKey(ctx, uid, verifyingKey, atServerTime, offline)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}

	// If the first attempt couldn't find the key, try again after
	// clearing our local cache.  We might have stale info if the
	// service hasn't learned of the users' new key yet.
	k.serviceOwner.KeybaseService().FlushUserFromLocalCache(ctx, uid)

	ok, err = k.hasVerifyingKey(ctx, uid, verifyingKey, atServerTime, offline)
	if err != nil {
		return err
	}
	if !ok {
		return VerifyingKeyNotFoundError{verifyingKey}
	}
	return nil
}

func (k *KBPKIClient) loadUserPlusKeys(ctx context.Context,
	uid keybase1.UID, pollForKID keybase1.KID,
	offline keybase1.OfflineAvailability) (idutil.UserInfo, error) {
	return k.serviceOwner.KeybaseService().LoadUserPlusKeys(
		ctx, uid, pollForKID, offline)
}

// GetCryptPublicKeys implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCryptPublicKeys(
	ctx context.Context, uid keybase1.UID,
	offline keybase1.OfflineAvailability) (
	keys []kbfscrypto.CryptPublicKey, err error) {
	userInfo, err := k.loadUserPlusKeys(ctx, uid, "", offline)
	if err != nil {
		return nil, err
	}
	return userInfo.CryptPublicKeys, nil
}

// GetTeamTLFCryptKeys implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetTeamTLFCryptKeys(
	ctx context.Context, tid keybase1.TeamID, desiredKeyGen kbfsmd.KeyGen,
	offline keybase1.OfflineAvailability) (
	map[kbfsmd.KeyGen]kbfscrypto.TLFCryptKey, kbfsmd.KeyGen, error) {
	teamInfo, err := k.serviceOwner.KeybaseService().LoadTeamPlusKeys(
		ctx, tid, tlf.Unknown, desiredKeyGen, keybase1.UserVersion{},
		kbfscrypto.VerifyingKey{}, keybase1.TeamRole_NONE, offline)
	if err != nil {
		return nil, 0, err
	}
	return teamInfo.CryptKeys, teamInfo.LatestKeyGen, nil
}

// GetCurrentMerkleRoot implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentMerkleRoot(ctx context.Context) (
	keybase1.MerkleRootV2, time.Time, error) {
	return k.serviceOwner.KeybaseService().GetCurrentMerkleRoot(ctx)
}

// VerifyMerkleRoot implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) VerifyMerkleRoot(
	ctx context.Context, root keybase1.MerkleRootV2,
	kbfsRoot keybase1.KBFSRoot) error {
	return k.serviceOwner.KeybaseService().VerifyMerkleRoot(
		ctx, root, kbfsRoot)
}

// IsTeamWriter implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) IsTeamWriter(
	ctx context.Context, tid keybase1.TeamID, uid keybase1.UID,
	verifyingKey kbfscrypto.VerifyingKey,
	offline keybase1.OfflineAvailability) (bool, error) {
	if uid.IsNil() || verifyingKey.IsNil() {
		// A sessionless user can never be a writer.
		return false, nil
	}

	// Use the verifying key to find out the eldest seqno of the user.
	userInfo, err := k.loadUserPlusKeys(ctx, uid, verifyingKey.KID(), offline)
	if err != nil {
		return false, err
	}

	found := false
	for _, key := range userInfo.VerifyingKeys {
		if verifyingKey.KID().Equal(key.KID()) {
			found = true
			break
		}
	}
	if !found {
		// For the purposes of finding the eldest seqno, we need to
		// check the verified key against the list of revoked keys as
		// well.  (The caller should use `HasVerifyingKey` later to
		// check whether the revoked key was valid at the time of the
		// update or not.)
		_, found = userInfo.RevokedVerifyingKeys[verifyingKey]
	}
	if !found {
		// The user doesn't currently have this KID, therefore they
		// shouldn't be treated as a writer.  The caller should check
		// historical device records and team membership.
		k.log.CDebugf(ctx, "User %s doesn't currently have verifying key %s",
			uid, verifyingKey.KID())
		return false, nil
	}

	desiredUser := keybase1.UserVersion{
		Uid:         uid,
		EldestSeqno: userInfo.EldestSeqno,
	}
	teamInfo, err := k.serviceOwner.KeybaseService().LoadTeamPlusKeys(
		ctx, tid, tlf.Unknown, kbfsmd.UnspecifiedKeyGen, desiredUser,
		kbfscrypto.VerifyingKey{}, keybase1.TeamRole_WRITER, offline)
	if err != nil {
		if tid.IsPublic() {
			if _, notFound := err.(libkb.NotFoundError); notFound {
				// We are probably just not a writer of this public team.
				k.log.CDebugf(ctx,
					"Ignoring not found error for public team: %+v", err)
				return false, nil
			}
		}
		return false, err
	}
	return teamInfo.Writers[uid], nil
}

// NoLongerTeamWriter implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) NoLongerTeamWriter(
	ctx context.Context, tid keybase1.TeamID, tlfType tlf.Type,
	uid keybase1.UID, verifyingKey kbfscrypto.VerifyingKey,
	offline keybase1.OfflineAvailability) (keybase1.MerkleRootV2, error) {
	if uid.IsNil() || verifyingKey.IsNil() {
		// A sessionless user can never be a writer.
		return keybase1.MerkleRootV2{}, nil
	}

	// We don't need the eldest seqno when we look up an older writer,
	// the service takes care of that for us.
	desiredUser := keybase1.UserVersion{
		Uid: uid,
	}

	teamInfo, err := k.serviceOwner.KeybaseService().LoadTeamPlusKeys(
		ctx, tid, tlfType, kbfsmd.UnspecifiedKeyGen, desiredUser,
		verifyingKey, keybase1.TeamRole_WRITER, offline)
	if err != nil {
		return keybase1.MerkleRootV2{}, err
	}
	return teamInfo.LastWriters[verifyingKey], nil
}

// IsTeamReader implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) IsTeamReader(
	ctx context.Context, tid keybase1.TeamID, uid keybase1.UID,
	offline keybase1.OfflineAvailability) (bool, error) {
	desiredUser := keybase1.UserVersion{Uid: uid}
	teamInfo, err := k.serviceOwner.KeybaseService().LoadTeamPlusKeys(
		ctx, tid, tlf.Unknown, kbfsmd.UnspecifiedKeyGen, desiredUser,
		kbfscrypto.VerifyingKey{}, keybase1.TeamRole_READER, offline)
	if err != nil {
		return false, err
	}
	return tid.IsPublic() || teamInfo.Writers[uid] || teamInfo.Readers[uid], nil
}

// GetTeamRootID implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetTeamRootID(
	ctx context.Context, tid keybase1.TeamID,
	offline keybase1.OfflineAvailability) (keybase1.TeamID, error) {
	if !tid.IsSubTeam() {
		return tid, nil
	}

	teamInfo, err := k.serviceOwner.KeybaseService().LoadTeamPlusKeys(
		ctx, tid, tlf.Unknown, kbfsmd.UnspecifiedKeyGen, keybase1.UserVersion{},
		kbfscrypto.VerifyingKey{}, keybase1.TeamRole_NONE, offline)
	if err != nil {
		return keybase1.TeamID(""), err
	}
	return teamInfo.RootID, nil
}

// CreateTeamTLF implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) CreateTeamTLF(
	ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) error {
	return k.serviceOwner.KeybaseService().CreateTeamTLF(ctx, teamID, tlfID)
}

// FavoriteAdd implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteAdd(ctx context.Context, folder keybase1.FolderHandle) error {
	return k.serviceOwner.KeybaseService().FavoriteAdd(ctx, folder)
}

// FavoriteDelete implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteDelete(ctx context.Context, folder keybase1.FolderHandle) error {
	return k.serviceOwner.KeybaseService().FavoriteDelete(ctx, folder)
}

// FavoriteList implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteList(ctx context.Context) (
	keybase1.FavoritesResult, error) {
	const sessionID = 0
	return k.serviceOwner.KeybaseService().FavoriteList(ctx, sessionID)
}

// Notify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return k.serviceOwner.KeybaseService().Notify(ctx, notification)
}

// NotifyPathUpdated implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) NotifyPathUpdated(
	ctx context.Context, path string) error {
	return k.serviceOwner.KeybaseService().NotifyPathUpdated(ctx, path)
}

// PutGitMetadata implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) PutGitMetadata(
	ctx context.Context, folder keybase1.FolderHandle, repoID keybase1.RepoID,
	metadata keybase1.GitLocalMetadata) error {
	return k.serviceOwner.KeybaseService().PutGitMetadata(
		ctx, folder, repoID, metadata)
}
