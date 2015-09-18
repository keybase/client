package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// KBPKIMeasured delegates to another KBPKI instance but also keeps
// track of stats.
type KBPKIMeasured struct {
	delegate                      KBPKI
	getCurrentTokenTimer          metrics.Timer
	getCurrentUIDTimer            metrics.Timer
	getCurrentCryptPublicKeyTimer metrics.Timer
	resolveAssertionTimer         metrics.Timer
	getUserTimer                  metrics.Timer
	hasVerifyingKeyTimer          metrics.Timer
	getCryptPublicKeysTimer       metrics.Timer
	favoriteAddTimer              metrics.Timer
	favoriteDeleteTimer           metrics.Timer
	favoriteListTimer             metrics.Timer
}

var _ KBPKI = KBPKIMeasured{}

// NewKbpkiMeasured creates and returns a new KBPKIMeasured instance
// with the given delegate and registry.
func NewKbpkiMeasured(delegate KBPKI, r metrics.Registry) KBPKIMeasured {
	getCurrentTokenTimer := metrics.GetOrRegisterTimer("KBPKI.GetCurrentToken", r)
	getCurrentUIDTimer := metrics.GetOrRegisterTimer("KBPKI.GetCurrentUID", r)
	getCurrentCryptPublicKeyTimer := metrics.GetOrRegisterTimer("KBPKI.GetCurrentCryptPublicKey", r)
	resolveAssertionTimer := metrics.GetOrRegisterTimer("KBPKI.ResolveAssertion", r)
	getUserTimer := metrics.GetOrRegisterTimer("KBPKI.GetUser", r)
	hasVerifyingKeyTimer := metrics.GetOrRegisterTimer("KBPKI.HasVerifyingKey", r)
	getCryptPublicKeysTimer := metrics.GetOrRegisterTimer("KBPKI.GetCryptPublicKeys", r)
	favoriteAddTimer := metrics.GetOrRegisterTimer("KBPKI.FavoriteAdd", r)
	favoriteDeleteTimer := metrics.GetOrRegisterTimer("KBPKI.FavoriteDelete", r)
	favoriteListTimer := metrics.GetOrRegisterTimer("KBPKI.FavoriteList", r)
	return KBPKIMeasured{
		delegate:                      delegate,
		getCurrentTokenTimer:          getCurrentTokenTimer,
		getCurrentUIDTimer:            getCurrentUIDTimer,
		getCurrentCryptPublicKeyTimer: getCurrentCryptPublicKeyTimer,
		resolveAssertionTimer:         resolveAssertionTimer,
		getUserTimer:                  getUserTimer,
		hasVerifyingKeyTimer:          hasVerifyingKeyTimer,
		getCryptPublicKeysTimer:       getCryptPublicKeysTimer,
		favoriteAddTimer:              favoriteAddTimer,
		favoriteDeleteTimer:           favoriteDeleteTimer,
		favoriteListTimer:             favoriteListTimer,
	}
}

// GetCurrentToken implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetCurrentToken(ctx context.Context) (token string, err error) {
	k.getCurrentTokenTimer.Time(func() {
		token, err = k.delegate.GetCurrentToken(ctx)
	})
	return token, err
}

// GetCurrentUID implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetCurrentUID(ctx context.Context) (
	uid keybase1.UID, err error) {
	k.getCurrentUIDTimer.Time(func() {
		uid, err = k.delegate.GetCurrentUID(ctx)
	})
	return uid, err
}

// GetCurrentCryptPublicKey implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetCurrentCryptPublicKey(ctx context.Context) (
	key CryptPublicKey, err error) {
	k.getCurrentCryptPublicKeyTimer.Time(func() {
		key, err = k.delegate.GetCurrentCryptPublicKey(ctx)
	})
	return key, err
}

// ResolveAssertion implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) ResolveAssertion(ctx context.Context, input string) (
	uid keybase1.UID, err error) {
	k.resolveAssertionTimer.Time(func() {
		uid, err = k.delegate.ResolveAssertion(ctx, input)
	})
	return uid, err
}

// GetNormalizedUsername implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetNormalizedUsername(ctx context.Context, uid keybase1.UID) (
	name libkb.NormalizedUsername, err error) {
	k.getUserTimer.Time(func() {
		name, err = k.delegate.GetNormalizedUsername(ctx, uid)
	})
	return name, err
}

// HasVerifyingKey implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) HasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey) (err error) {
	k.hasVerifyingKeyTimer.Time(func() {
		err = k.delegate.HasVerifyingKey(ctx, uid, verifyingKey)
	})
	return err
}

// GetCryptPublicKeys implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetCryptPublicKeys(ctx context.Context, uid keybase1.UID) (
	keys []CryptPublicKey, err error) {
	k.getCryptPublicKeysTimer.Time(func() {
		keys, err = k.delegate.GetCryptPublicKeys(ctx, uid)
	})
	return keys, err
}

// FavoriteAdd implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) FavoriteAdd(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteAddTimer.Time(func() {
		err = k.delegate.FavoriteAdd(ctx, folder)
	})
	return err
}

// FavoriteDelete implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) FavoriteDelete(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteDeleteTimer.Time(func() {
		err = k.delegate.FavoriteDelete(ctx, folder)
	})
	return err
}

// FavoriteList implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) FavoriteList(ctx context.Context) (
	favorites []keybase1.Folder, err error) {
	k.favoriteListTimer.Time(func() {
		favorites, err = k.delegate.FavoriteList(ctx)
	})
	return favorites, err
}

// Shutdown implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) Shutdown() {
	k.delegate.Shutdown()
}
