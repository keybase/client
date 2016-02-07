package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// KBPKIClient uses a config's KeybaseDaemon.
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
	return k.config.KeybaseDaemon().Resolve(ctx, assertion)
}

// Identify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Identify(ctx context.Context, assertion, reason string) (
	UserInfo, error) {
	return k.config.KeybaseDaemon().Identify(ctx, assertion, reason)
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
	verifyingKey VerifyingKey) (bool, error) {
	userInfo, err := k.loadUserPlusKeys(ctx, uid)
	if err != nil {
		return false, err
	}

	for _, key := range userInfo.VerifyingKeys {
		if verifyingKey.kid.Equal(key.kid) {
			k.log.CDebugf(ctx, "found verifying key %s for user %s",
				verifyingKey.kid, uid)
			return true, nil
		}
	}

	return false, nil
}

// HasVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey) error {
	ok, err := k.hasVerifyingKey(ctx, uid, verifyingKey)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}

	// If the first attempt couldn't find the key, try again after
	// clearing our local cache.  We might have stale info if the
	// service hasn't learned of the users' new key yet.
	k.config.KeybaseDaemon().FlushUserFromLocalCache(ctx, uid)

	ok, err = k.hasVerifyingKey(ctx, uid, verifyingKey)
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
	return k.config.KeybaseDaemon().LoadUserPlusKeys(ctx, uid)
}

func (k *KBPKIClient) session(ctx context.Context) (SessionInfo, error) {
	const sessionID = 0
	return k.config.KeybaseDaemon().CurrentSession(ctx, sessionID)
}

// FavoriteAdd implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	return k.config.KeybaseDaemon().FavoriteAdd(ctx, folder)
}

// FavoriteDelete implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	return k.config.KeybaseDaemon().FavoriteDelete(ctx, folder)
}

// FavoriteList implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteList(ctx context.Context) ([]keybase1.Folder, error) {
	const sessionID = 0
	return k.config.KeybaseDaemon().FavoriteList(ctx, sessionID)
}

// Notify implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return k.config.KeybaseDaemon().Notify(ctx, notification)
}
