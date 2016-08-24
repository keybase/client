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
	"golang.org/x/net/context"
)

// KBPKIClient uses a config's KeybaseService.
type KBPKIClient struct {
	config Config
	log    logger.Logger
}

var _ KBPKI = (*KBPKIClient)(nil)

// NewKBPKIClient returns a new KBPKIClient with the given Config.
func NewKBPKIClient(config Config) *KBPKIClient {
	return &KBPKIClient{config, config.MakeLogger("")}
}

// GetCurrentToken implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentToken(ctx context.Context) (string, error) {
	s, err := k.session(ctx)
	if err != nil {
		// XXX shouldn't ignore this...
		k.log.CWarningf(ctx, "error getting session: %q", err)
		return "", err
	}
	return s.Token, nil
}

// GetCurrentUserInfo implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentUserInfo(ctx context.Context) (
	libkb.NormalizedUsername, keybase1.UID, error) {
	s, err := k.session(ctx)
	if err != nil {
		// TODO: something more intelligent; maybe just shut down
		// unless we want anonymous browsing of public data
		return libkb.NormalizedUsername(""), keybase1.UID(""), err
	}
	return s.Name, s.UID, nil
}

// GetCurrentCryptPublicKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentCryptPublicKey(ctx context.Context) (
	CryptPublicKey, error) {
	s, err := k.session(ctx)
	if err != nil {
		return CryptPublicKey{}, err
	}
	return s.CryptPublicKey, nil
}

// GetCurrentVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentVerifyingKey(ctx context.Context) (
	VerifyingKey, error) {
	s, err := k.session(ctx)
	if err != nil {
		return VerifyingKey{}, err
	}
	return s.VerifyingKey, nil
}

// Resolve implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UID, error) {
	return k.config.KeybaseService().Resolve(ctx, assertion)
}

// Identify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Identify(ctx context.Context, assertion, reason string) (
	UserInfo, error) {
	return k.config.KeybaseService().Identify(ctx, assertion, reason)
}

// GetNormalizedUsername implements the KBPKI interface for
// KBPKIClient.
func (k *KBPKIClient) GetNormalizedUsername(ctx context.Context, uid keybase1.UID) (
	libkb.NormalizedUsername, error) {
	username, _, err := k.Resolve(ctx, fmt.Sprintf("uid:%s", uid))
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	return username, nil
}

func (k *KBPKIClient) hasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey, atServerTime time.Time) (bool, error) {
	userInfo, err := k.loadUserPlusKeys(ctx, uid)
	if err != nil {
		return false, err
	}

	for _, key := range userInfo.VerifyingKeys {
		if verifyingKey.kid.Equal(key.kid) {
			return true, nil
		}
	}

	for key, t := range userInfo.RevokedVerifyingKeys {
		if !verifyingKey.kid.Equal(key.kid) {
			continue
		}
		revokedTime := keybase1.FromTime(t.Unix)
		// Trust the server times -- if the key was valid at the given
		// time, we are good to go.  TODO: use Merkle data to check
		// the server timestamps, to prove the server isn't lying.
		if atServerTime.Before(revokedTime) {
			k.log.CDebugf(ctx, "Trusting revoked verifying key %s for user %s "+
				"(revoked time: %v vs. server time %v)", verifyingKey.kid, uid,
				revokedTime, atServerTime)
			return true, nil
		}
		k.log.CDebugf(ctx, "Not trusting revoked verifying key %s for "+
			"user %s (revoked time: %v vs. server time %v)",
			verifyingKey.kid, uid, revokedTime, atServerTime)
		return false, nil
	}

	return false, nil
}

func (k *KBPKIClient) hasUnverifiedVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey) (bool, error) {
	keys, err := k.loadUnverifiedKeys(ctx, uid)
	if err != nil {
		return false, err
	}

	for _, key := range keys {
		if !verifyingKey.kid.Equal(key.KID) {
			continue
		}
		k.log.CDebugf(ctx, "Trusting potentially unverified key %s for user %s",
			verifyingKey.kid, uid)
		return true, nil
	}

	return false, nil
}

// HasVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey, atServerTime time.Time) error {
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
	k.config.KeybaseService().FlushUserFromLocalCache(ctx, uid)

	ok, err = k.hasVerifyingKey(ctx, uid, verifyingKey, atServerTime)
	if err != nil {
		return err
	}
	if !ok {
		return KeyNotFoundError{verifyingKey.kid}
	}
	return nil
}

// HasUnverifiedVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasUnverifiedVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey) error {
	ok, err := k.hasUnverifiedVerifyingKey(ctx, uid, verifyingKey)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	k.config.KeybaseService().FlushUserUnverifiedKeysFromLocalCache(ctx, uid)
	ok, err = k.hasUnverifiedVerifyingKey(ctx, uid, verifyingKey)
	if err != nil {
		return err
	}
	if !ok {
		return KeyNotFoundError{verifyingKey.kid}
	}
	return nil
}

// GetCryptPublicKeys implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCryptPublicKeys(ctx context.Context,
	uid keybase1.UID) (keys []CryptPublicKey, err error) {
	userInfo, err := k.loadUserPlusKeys(ctx, uid)
	if err != nil {
		return nil, err
	}
	return userInfo.CryptPublicKeys, nil
}

func (k *KBPKIClient) loadUserPlusKeys(ctx context.Context, uid keybase1.UID) (
	UserInfo, error) {
	return k.config.KeybaseService().LoadUserPlusKeys(ctx, uid)
}

func (k *KBPKIClient) session(ctx context.Context) (SessionInfo, error) {
	const sessionID = 0
	return k.config.KeybaseService().CurrentSession(ctx, sessionID)
}

// FavoriteAdd implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	return k.config.KeybaseService().FavoriteAdd(ctx, folder)
}

// FavoriteDelete implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	return k.config.KeybaseService().FavoriteDelete(ctx, folder)
}

// FavoriteList implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteList(ctx context.Context) ([]keybase1.Folder, error) {
	const sessionID = 0
	return k.config.KeybaseService().FavoriteList(ctx, sessionID)
}

// Notify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return k.config.KeybaseService().Notify(ctx, notification)
}

func (k *KBPKIClient) loadUnverifiedKeys(ctx context.Context, uid keybase1.UID) (
	[]keybase1.PublicKey, error) {
	return k.config.KeybaseService().LoadUnverifiedKeys(ctx, uid)
}
