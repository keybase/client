// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
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
	SessionInfo, error) {
	const sessionID = 0
	return k.serviceOwner.KeybaseService().CurrentSession(ctx, sessionID)
}

// Resolve implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return k.serviceOwner.KeybaseService().Resolve(ctx, assertion)
}

// Identify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Identify(ctx context.Context, assertion, reason string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return k.serviceOwner.KeybaseService().Identify(ctx, assertion, reason)
}

// GetNormalizedUsername implements the KBPKI interface for
// KBPKIClient.
func (k *KBPKIClient) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID) (
	libkb.NormalizedUsername, error) {
	username, _, err := k.Resolve(ctx, fmt.Sprintf("uid:%s", id))
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	return username, nil
}

func (k *KBPKIClient) hasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey kbfscrypto.VerifyingKey, atServerTime time.Time) (bool, error) {
	userInfo, err := k.loadUserPlusKeys(ctx, uid, verifyingKey.KID())
	if err != nil {
		return false, err
	}

	for _, key := range userInfo.VerifyingKeys {
		if verifyingKey.KID().Equal(key.KID()) {
			return true, nil
		}
	}

	for key, t := range userInfo.RevokedVerifyingKeys {
		if !verifyingKey.KID().Equal(key.KID()) {
			continue
		}
		// We add some slack to the revoke time, because the MD server
		// won't instanteneously find out about the revoke -- it might
		// keep accepting writes from the revoked device for a short
		// period of time until it learns about the revoke.
		const revokeSlack = 1 * time.Minute
		revokedTime := keybase1.FromTime(t.Unix)
		// Trust the server times -- if the key was valid at the given
		// time, we are good to go.  TODO: use Merkle data to check
		// the server timestamps, to prove the server isn't lying.
		if atServerTime.Before(revokedTime.Add(revokeSlack)) {
			k.log.CDebugf(ctx, "Trusting revoked verifying key %s for user %s "+
				"(revoked time: %v vs. server time %v, slack=%s)",
				verifyingKey.KID(), uid, revokedTime, atServerTime, revokeSlack)
			return true, nil
		}
		k.log.CDebugf(ctx, "Not trusting revoked verifying key %s for "+
			"user %s (revoked time: %v vs. server time %v, slack=%s)",
			verifyingKey.KID(), uid, revokedTime, atServerTime, revokeSlack)
		return false, nil
	}

	return false, nil
}

func (k *KBPKIClient) hasUnverifiedVerifyingKey(
	ctx context.Context, uid keybase1.UID,
	verifyingKey kbfscrypto.VerifyingKey) (bool, error) {
	keys, err := k.loadUnverifiedKeys(ctx, uid)
	if err != nil {
		return false, err
	}

	for _, key := range keys {
		if !verifyingKey.KID().Equal(key.KID) {
			continue
		}
		k.log.CDebugf(ctx, "Trusting potentially unverified key %s for user %s",
			verifyingKey.KID(), uid)
		return true, nil
	}

	return false, nil
}

// HasVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey kbfscrypto.VerifyingKey, atServerTime time.Time) error {
	ok, err := k.hasVerifyingKey(ctx, uid, verifyingKey, atServerTime)
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

	ok, err = k.hasVerifyingKey(ctx, uid, verifyingKey, atServerTime)
	if err != nil {
		return err
	}
	if !ok {
		return VerifyingKeyNotFoundError{verifyingKey}
	}
	return nil
}

// HasUnverifiedVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasUnverifiedVerifyingKey(
	ctx context.Context, uid keybase1.UID,
	verifyingKey kbfscrypto.VerifyingKey) error {
	ok, err := k.hasUnverifiedVerifyingKey(ctx, uid, verifyingKey)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	k.serviceOwner.KeybaseService().FlushUserUnverifiedKeysFromLocalCache(ctx, uid)
	ok, err = k.hasUnverifiedVerifyingKey(ctx, uid, verifyingKey)
	if err != nil {
		return err
	}
	if !ok {
		return VerifyingKeyNotFoundError{verifyingKey}
	}
	return nil
}

// GetCryptPublicKeys implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCryptPublicKeys(ctx context.Context,
	uid keybase1.UID) (keys []kbfscrypto.CryptPublicKey, err error) {
	userInfo, err := k.loadUserPlusKeys(ctx, uid, "")
	if err != nil {
		return nil, err
	}
	return userInfo.CryptPublicKeys, nil
}

func (k *KBPKIClient) loadUserPlusKeys(ctx context.Context,
	uid keybase1.UID, pollForKID keybase1.KID) (UserInfo, error) {
	return k.serviceOwner.KeybaseService().LoadUserPlusKeys(ctx, uid, pollForKID)
}

// FavoriteAdd implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	return k.serviceOwner.KeybaseService().FavoriteAdd(ctx, folder)
}

// FavoriteDelete implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	return k.serviceOwner.KeybaseService().FavoriteDelete(ctx, folder)
}

// FavoriteList implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteList(ctx context.Context) ([]keybase1.Folder, error) {
	const sessionID = 0
	return k.serviceOwner.KeybaseService().FavoriteList(ctx, sessionID)
}

// Notify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return k.serviceOwner.KeybaseService().Notify(ctx, notification)
}

func (k *KBPKIClient) loadUnverifiedKeys(ctx context.Context, uid keybase1.UID) (
	[]keybase1.PublicKey, error) {
	return k.serviceOwner.KeybaseService().LoadUnverifiedKeys(ctx, uid)
}

// GetCurrentSessionIfPossible returns the current username and UID from
// kbpki.GetCurrentSession.
// If isPublic is true NoCurrentSessionError is ignored and empty username
// and uid will be returned. If it is false all errors are returned.
func GetCurrentSessionIfPossible(ctx context.Context, kbpki KBPKI, isPublic bool) (SessionInfo, error) {
	session, err := kbpki.GetCurrentSession(ctx)
	if err == nil {
		return session, nil
	}
	// Return all error for private folders.
	if !isPublic {
		return SessionInfo{}, err
	}

	// If not logged in, return empty session.
	if _, notLoggedIn := err.(NoCurrentSessionError); notLoggedIn {
		return SessionInfo{}, nil
	}

	// Otherwise, just return the error.
	return SessionInfo{}, err
}
