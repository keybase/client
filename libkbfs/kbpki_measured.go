package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// KBPKIMeasured delegates to another KBPKI interface but also keeps track
// of stats.
type KBPKIMeasured struct {
	delegate                      KBPKI
	resolveAssertionTimer         metrics.Timer
	getUserTimer                  metrics.Timer
	getSessionTimer               metrics.Timer
	getLoggedInUserTimer          metrics.Timer
	hasVerifyingKeyTimer          metrics.Timer
	getCryptPublicKeysTimer       metrics.Timer
	getCurrentCryptPublicKeyTimer metrics.Timer
	favoriteAddTimer              metrics.Timer
	favoriteDeleteTimer           metrics.Timer
	favoriteListTimer             metrics.Timer
}

var _ KBPKI = KBPKIMeasured{}

// NewKbpkiMeasured creates and returns a new KBPKIMeasured instance
// with the given delegate and registry.
func NewKbpkiMeasured(delegate KBPKI, r metrics.Registry) KBPKIMeasured {
	resolveAssertionTimer := metrics.GetOrRegisterTimer("KBPKI.ResolveAssertion", r)
	getUserTimer := metrics.GetOrRegisterTimer("KBPKI.GetUser", r)
	getSessionTimer := metrics.GetOrRegisterTimer("KBPKI.GetSession", r)
	getLoggedInUserTimer := metrics.GetOrRegisterTimer("KBPKI.GetLoggedInUser", r)
	hasVerifyingKeyTimer := metrics.GetOrRegisterTimer("KBPKI.HasVerifyingKey", r)
	getCryptPublicKeysTimer := metrics.GetOrRegisterTimer("KBPKI.GetCryptPublicKeys", r)
	getCurrentCryptPublicKeyTimer := metrics.GetOrRegisterTimer("KBPKI.GetCurrentCryptPublicKey", r)
	favoriteAddTimer := metrics.GetOrRegisterTimer("KBPKI.FavoriteAdd", r)
	favoriteDeleteTimer := metrics.GetOrRegisterTimer("KBPKI.FavoriteDelete", r)
	favoriteListTimer := metrics.GetOrRegisterTimer("KBPKI.FavoriteList", r)
	return KBPKIMeasured{
		delegate:                      delegate,
		resolveAssertionTimer:         resolveAssertionTimer,
		getUserTimer:                  getUserTimer,
		getSessionTimer:               getSessionTimer,
		getLoggedInUserTimer:          getLoggedInUserTimer,
		hasVerifyingKeyTimer:          hasVerifyingKeyTimer,
		getCryptPublicKeysTimer:       getCryptPublicKeysTimer,
		getCurrentCryptPublicKeyTimer: getCurrentCryptPublicKeyTimer,
		favoriteAddTimer:              favoriteAddTimer,
		favoriteDeleteTimer:           favoriteDeleteTimer,
		favoriteListTimer:             favoriteListTimer,
	}
}

// ResolveAssertion implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) ResolveAssertion(ctx context.Context, input string) (
	user *libkb.User, err error) {
	k.resolveAssertionTimer.Time(func() {
		user, err = k.delegate.ResolveAssertion(ctx, input)
	})
	return user, err
}

// GetUser implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetUser(ctx context.Context, uid keybase1.UID) (
	user *libkb.User, err error) {
	k.getUserTimer.Time(func() {
		user, err = k.delegate.GetUser(ctx, uid)
	})
	return user, err
}

// GetSession implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetSession(ctx context.Context) (
	session *libkb.Session, err error) {
	k.getSessionTimer.Time(func() {
		session, err = k.delegate.GetSession(ctx)
	})
	return session, err
}

// GetLoggedInUser implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetLoggedInUser(ctx context.Context) (
	uid keybase1.UID, err error) {
	k.getLoggedInUserTimer.Time(func() {
		uid, err = k.delegate.GetLoggedInUser(ctx)
	})
	return uid, err
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

// GetCurrentCryptPublicKey implements the KBPKI interface for KBPKIMeasured.
func (k KBPKIMeasured) GetCurrentCryptPublicKey(ctx context.Context) (
	key CryptPublicKey, err error) {
	k.getCurrentCryptPublicKeyTimer.Time(func() {
		key, err = k.delegate.GetCurrentCryptPublicKey(ctx)
	})
	return key, err
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
