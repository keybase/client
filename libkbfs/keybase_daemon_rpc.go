package libkbfs

import (
	"sync"
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// KeybaseDaemonRPC implements the KeybaseDaemon interface using RPC
// calls.
type KeybaseDaemonRPC struct {
	libkb.Contextified
	identifyClient keybase1.IdentifyInterface
	userClient     keybase1.UserInterface
	sessionClient  keybase1.SessionInterface
	favoriteClient keybase1.FavoriteInterface
	kbfsClient     keybase1.KbfsInterface
	shutdownFn     func()
	log            logger.Logger

	sessionCacheLock sync.RWMutex
	// Set to the zero value when invalidated.
	cachedCurrentSession SessionInfo

	userCacheLock sync.RWMutex
	// Map entries are removed when invalidated.
	userCache map[keybase1.UID]UserInfo
}

var _ keybase1.NotifySessionInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyUsersInterface = (*KeybaseDaemonRPC)(nil)

var _ ConnectionHandler = (*KeybaseDaemonRPC)(nil)

var _ KeybaseDaemon = (*KeybaseDaemonRPC)(nil)

// NewKeybaseDaemonRPC makes a new KeybaseDaemonRPC that makes RPC
// calls using the socket of the given Keybase context.
func NewKeybaseDaemonRPC(config Config, kbCtx *libkb.GlobalContext, log logger.Logger) *KeybaseDaemonRPC {
	k := newKeybaseDaemonRPC(kbCtx, log)
	conn := NewSharedKeybaseConnection(kbCtx, config, k)
	k.fillClients(conn.GetClient())
	k.shutdownFn = conn.Shutdown
	return k
}

// For testing.
func newKeybaseDaemonRPCWithClient(kbCtx *libkb.GlobalContext, client keybase1.GenericClient,
	log logger.Logger) *KeybaseDaemonRPC {
	k := newKeybaseDaemonRPC(kbCtx, log)
	k.fillClients(client)
	return k
}

func newKeybaseDaemonRPC(kbCtx *libkb.GlobalContext, log logger.Logger) *KeybaseDaemonRPC {
	k := KeybaseDaemonRPC{
		Contextified: libkb.NewContextified(kbCtx),
		log:          log,
		userCache:    make(map[keybase1.UID]UserInfo),
	}
	return &k
}

func (k *KeybaseDaemonRPC) fillClients(client keybase1.GenericClient) {
	k.identifyClient = keybase1.IdentifyClient{Cli: client}
	k.userClient = keybase1.UserClient{Cli: client}
	k.sessionClient = keybase1.SessionClient{Cli: client}
	k.favoriteClient = keybase1.FavoriteClient{Cli: client}
	k.kbfsClient = keybase1.KbfsClient{Cli: client}
}

func (k *KeybaseDaemonRPC) filterKeys(ctx context.Context, uid keybase1.UID, keys []keybase1.PublicKey) ([]VerifyingKey, []CryptPublicKey, error) {
	var verifyingKeys []VerifyingKey
	var cryptPublicKeys []CryptPublicKey
	for _, publicKey := range keys {
		if len(publicKey.PGPFingerprint) > 0 {
			continue
		}
		// Import the KID to validate it.
		key, err := libkb.ImportKeypairFromKID(publicKey.KID)
		if err != nil {
			return nil, nil, err
		}
		if publicKey.IsSibkey {
			k.log.CDebugf(
				ctx, "got verifying key %s for user %s",
				key.VerboseDescription(), uid)
			verifyingKeys = append(
				verifyingKeys, VerifyingKey{key.GetKID()})
		} else {
			k.log.CDebugf(
				ctx, "got crypt public key %s for user %s",
				key.VerboseDescription(), uid)
			cryptPublicKeys = append(
				cryptPublicKeys, CryptPublicKey{key.GetKID()})
		}
	}
	return verifyingKeys, cryptPublicKeys, nil
}

func (k *KeybaseDaemonRPC) getCachedCurrentSession() SessionInfo {
	k.sessionCacheLock.RLock()
	defer k.sessionCacheLock.RUnlock()
	return k.cachedCurrentSession
}

func (k *KeybaseDaemonRPC) setCachedCurrentSession(s SessionInfo) {
	k.sessionCacheLock.Lock()
	defer k.sessionCacheLock.Unlock()
	k.cachedCurrentSession = s
}

func (k *KeybaseDaemonRPC) getCachedUserInfo(uid keybase1.UID) UserInfo {
	k.userCacheLock.RLock()
	defer k.userCacheLock.RUnlock()
	return k.userCache[uid]
}

func (k *KeybaseDaemonRPC) setCachedUserInfo(uid keybase1.UID, info UserInfo) {
	k.userCacheLock.Lock()
	defer k.userCacheLock.Unlock()
	if info.Name == libkb.NormalizedUsername("") {
		delete(k.userCache, uid)
	} else {
		k.userCache[uid] = info
	}
}

// LoggedOut implements keybase1.NotifySessionInterface.
func (k *KeybaseDaemonRPC) LoggedOut(ctx context.Context) error {
	k.log.CDebugf(ctx, "Current session logged out")
	k.setCachedCurrentSession(SessionInfo{})
	return nil
}

// UserChanged implements keybase1.NotifySessionInterface.
func (k *KeybaseDaemonRPC) UserChanged(ctx context.Context, uid keybase1.UID) error {
	k.log.CDebugf(ctx, "User %s changed", uid)
	k.setCachedUserInfo(uid, UserInfo{})
	return nil
}

// OnConnect implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnConnect(ctx context.Context,
	conn *Connection, rawClient keybase1.GenericClient,
	server *rpc.Server) error {
	protocols := []rpc.Protocol{
		client.NewLogUIProtocol(),
		client.NewIdentifyUIProtocol(k.G()),
		keybase1.NotifySessionProtocol(k),
		keybase1.NotifyUsersProtocol(k),
	}
	for _, p := range protocols {
		err := server.Register(p)
		if err != nil {
			if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
				return err
			}
		}
	}

	// Using conn.GetClient() here would cause problematic
	// recursion.
	c := keybase1.NotifyCtlClient{Cli: cancelableClient{rawClient}}
	err := c.SetNotifications(ctx, keybase1.NotificationChannels{
		Session: true,
		Users:   true,
	})
	if err != nil {
		return err
	}

	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnConnectError(err error, wait time.Duration) {
	k.log.Warning("KeybaseDaemonRPC: connection error: %q; retrying in %s",
		err, wait)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnDoCommandError(err error, wait time.Duration) {
	k.log.Warning("KeybaseDaemonRPC: docommand error: %q; retrying in %s",
		err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnDisconnected() {
	k.log.Warning("KeybaseDaemonRPC is disconnected")
}

// ShouldThrottle implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) ShouldThrottle(err error) bool {
	return false
}

// Identify implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) Identify(ctx context.Context, assertion string) (
	UserInfo, error) {
	// setting UseDelegateUI to true here will cause daemon to use
	// registered identify ui providers instead of terminal if any
	// are available.  If not, then it will use the terminal UI.
	arg := keybase1.IdentifyArg{
		UserAssertion: assertion,
		UseDelegateUI: true,
		Source:        keybase1.IdentifySource_KBFS,
	}
	res, err := k.identifyClient.Identify(ctx, arg)
	if err != nil {
		return UserInfo{}, err
	}

	uid := res.User.Uid
	verifyingKeys, cryptPublicKeys, err := k.filterKeys(ctx, uid, res.PublicKeys)
	if err != nil {
		return UserInfo{}, err
	}

	u := UserInfo{
		Name:            libkb.NewNormalizedUsername(res.User.Username),
		UID:             uid,
		VerifyingKeys:   verifyingKeys,
		CryptPublicKeys: cryptPublicKeys,
	}

	k.setCachedUserInfo(uid, u)

	return u, nil
}

// LoadUserPlusKeys implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) LoadUserPlusKeys(ctx context.Context, uid keybase1.UID) (
	UserInfo, error) {
	cachedUserInfo := k.getCachedUserInfo(uid)
	if cachedUserInfo.Name != libkb.NormalizedUsername("") {
		return cachedUserInfo, nil
	}

	arg := keybase1.LoadUserPlusKeysArg{Uid: uid, CacheOK: true}
	res, err := k.userClient.LoadUserPlusKeys(ctx, arg)
	if err != nil {
		return UserInfo{}, err
	}

	verifyingKeys, cryptPublicKeys, err := k.filterKeys(ctx, uid, res.DeviceKeys)
	if err != nil {
		return UserInfo{}, err
	}

	u := UserInfo{
		Name:            libkb.NewNormalizedUsername(res.Username),
		UID:             res.Uid,
		VerifyingKeys:   verifyingKeys,
		CryptPublicKeys: cryptPublicKeys,
	}

	k.setCachedUserInfo(uid, u)

	return u, nil
}

// CurrentSession implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) CurrentSession(ctx context.Context, sessionID int) (
	SessionInfo, error) {
	cachedCurrentSession := k.getCachedCurrentSession()
	if cachedCurrentSession != (SessionInfo{}) {
		return cachedCurrentSession, nil
	}

	res, err := k.sessionClient.CurrentSession(ctx, sessionID)
	if err != nil {
		return SessionInfo{}, err
	}
	// Import the KIDs to validate them.
	deviceSubkey, err := libkb.ImportKeypairFromKID(res.DeviceSubkeyKid)
	if err != nil {
		return SessionInfo{}, err
	}
	deviceSibkey, err := libkb.ImportKeypairFromKID(res.DeviceSibkeyKid)
	if err != nil {
		return SessionInfo{}, err
	}
	k.log.CDebugf(ctx, "got device subkey %s",
		deviceSubkey.GetKID().ToShortIDString())
	cryptPublicKey := CryptPublicKey{deviceSubkey.GetKID()}
	verifyingKey := VerifyingKey{deviceSibkey.GetKID()}
	s := SessionInfo{
		UID:            keybase1.UID(res.Uid),
		Token:          res.Token,
		CryptPublicKey: cryptPublicKey,
		VerifyingKey:   verifyingKey,
	}

	k.setCachedCurrentSession(s)

	return s, nil
}

// FavoriteAdd implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteClient.FavoriteAdd(ctx, keybase1.FavoriteAddArg{Folder: folder})
}

// FavoriteDelete implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteClient.FavoriteDelete(ctx, keybase1.FavoriteDeleteArg{Folder: folder})
}

// FavoriteList implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) FavoriteList(ctx context.Context, sessionID int) ([]keybase1.Folder, error) {
	return k.favoriteClient.FavoriteList(ctx, sessionID)
}

// Notify implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) Notify(ctx context.Context, notification *keybase1.FSNotification) error {
	return k.kbfsClient.FSEvent(ctx, *notification)
}

// Shutdown implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) Shutdown() {
	if k.shutdownFn != nil {
		k.shutdownFn()
	}
}
