package libkbfs

import (
	keybase1 "github.com/keybase/client/go/protocol"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// KeybaseDaemonMeasured delegates to another KeybaseDaemon instance
// but also keeps track of stats.
type KeybaseDaemonMeasured struct {
	delegate            KeybaseDaemon
	identifyTimer       metrics.Timer
	currentUIDTimer     metrics.Timer
	currentSessionTimer metrics.Timer
	favoriteAddTimer    metrics.Timer
	favoriteDeleteTimer metrics.Timer
	favoriteListTimer   metrics.Timer
}

var _ KeybaseDaemon = KeybaseDaemonMeasured{}

// NewKeybaseDaemonMeasured creates and returns a new KeybaseDaemonMeasured
// instance with the given delegate and registry.
func NewKeybaseDaemonMeasured(delegate KeybaseDaemon, r metrics.Registry) KeybaseDaemonMeasured {
	identifyTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.Identify", r)
	currentUIDTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.CurrentUID", r)
	currentSessionTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.CurrentSession", r)
	favoriteAddTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.FavoriteAdd", r)
	favoriteDeleteTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.FavoriteDelete", r)
	favoriteListTimer := metrics.GetOrRegisterTimer("KeybaseDaemon.FavoriteList", r)
	return KeybaseDaemonMeasured{
		delegate:            delegate,
		identifyTimer:       identifyTimer,
		currentUIDTimer:     currentUIDTimer,
		currentSessionTimer: currentSessionTimer,
		favoriteAddTimer:    favoriteAddTimer,
		favoriteDeleteTimer: favoriteDeleteTimer,
		favoriteListTimer:   favoriteListTimer,
	}
}

// Identify implements the KeybaseDaemon interface for KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) Identify(ctx context.Context, assertion string) (
	userInfo UserInfo, err error) {
	k.identifyTimer.Time(func() {
		userInfo, err = k.delegate.Identify(ctx, assertion)
	})
	return userInfo, err
}

// CurrentUID implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) CurrentUID(ctx context.Context, sessionID int) (
	currentUID keybase1.UID, err error) {
	k.currentUIDTimer.Time(func() {
		currentUID, err = k.delegate.CurrentUID(ctx, sessionID)
	})
	return currentUID, err
}

// CurrentSession implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) CurrentSession(ctx context.Context, sessionID int) (
	sessionInfo SessionInfo, err error) {
	k.currentSessionTimer.Time(func() {
		sessionInfo, err = k.delegate.CurrentSession(ctx, sessionID)
	})
	return sessionInfo, err
}

// FavoriteAdd implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) FavoriteAdd(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteAddTimer.Time(func() {
		err = k.delegate.FavoriteAdd(ctx, folder)
	})
	return err
}

// FavoriteDelete implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) FavoriteDelete(ctx context.Context, folder keybase1.Folder) (err error) {
	k.favoriteDeleteTimer.Time(func() {
		err = k.delegate.FavoriteDelete(ctx, folder)
	})
	return err
}

// FavoriteList implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) FavoriteList(ctx context.Context, sessionID int) (
	favorites []keybase1.Folder, err error) {
	k.favoriteListTimer.Time(func() {
		favorites, err = k.delegate.FavoriteList(ctx, sessionID)
	})
	return favorites, err
}

// Shutdown implements the KeybaseDaemon interface for
// KeybaseDaemonMeasured.
func (k KeybaseDaemonMeasured) Shutdown() {
	k.delegate.Shutdown()
}
