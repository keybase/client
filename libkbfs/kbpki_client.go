package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
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

// GetCurrentUID implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentUID(ctx context.Context) (keybase1.UID, error) {
	s, err := k.session(ctx)
	if err != nil {
		// TODO: something more intelligent; maybe just shut down
		// unless we want anonymous browsing of public data
		return keybase1.UID(""), err
	}
	k.log.CInfof(ctx, "logged in user uid = %s", s.UID)
	return s.UID, nil
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

// ResolveAssertion implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) ResolveAssertion(ctx context.Context, username string) (
	keybase1.UID, error) {
	// TODO: Consider caching the returned public key info from
	// identify instead of dropping them.
	userInfo, err := k.identify(ctx, username)
	if err != nil {
		return keybase1.UID(""), err
	}
	return userInfo.UID, nil
}

// GetNormalizedUsername implements the KBPKI interface for
// KBPKIClient.
func (k *KBPKIClient) GetNormalizedUsername(ctx context.Context, uid keybase1.UID) (
	libkb.NormalizedUsername, error) {
	userInfo, err := k.identifyByUID(ctx, uid)
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	return userInfo.Name, nil
}

// HasVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey) error {
	userInfo, err := k.identifyByUID(ctx, uid)
	if err != nil {
		return err
	}

	for _, key := range userInfo.VerifyingKeys {
		if verifyingKey.KID.Equal(key.KID) {
			k.log.CDebugf(ctx, "found verifying key %s for user %s",
				verifyingKey.KID, uid)
			return nil
		}
	}

	return KeyNotFoundError{verifyingKey.KID}
}

// GetCryptPublicKeys implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCryptPublicKeys(ctx context.Context,
	uid keybase1.UID) (keys []CryptPublicKey, err error) {
	userInfo, err := k.identifyByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	return userInfo.CryptPublicKeys, nil
}

func (k *KBPKIClient) identify(ctx context.Context, assertion string) (
	UserInfo, error) {
	return k.config.KeybaseDaemon().Identify(ctx, assertion)
}

func (k *KBPKIClient) identifyByUID(ctx context.Context, uid keybase1.UID) (
	UserInfo, error) {
	return k.identify(ctx, fmt.Sprintf("uid:%s", uid))
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
