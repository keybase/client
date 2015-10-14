package libkbfs

import (
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// KeybaseDaemonRPC implements the KeybaseDaemon interface using RPC
// calls.
type KeybaseDaemonRPC struct {
	clientFactory ClientFactory
	log           logger.Logger
}

var _ KeybaseDaemon = KeybaseDaemonRPC{}

// NewKeybaseDaemonRPC makes a new KeybaseDaemonRPC that makes RPC
// calls using the socket of the given Keybase context.
func NewKeybaseDaemonRPC(config Config, kbCtx *libkb.GlobalContext, log logger.Logger) KeybaseDaemonRPC {
	k := KeybaseDaemonRPC{
		log: log,
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, k)
	k.clientFactory = ConnectionClientFactory{conn}
	return k
}

// For testing.
func newKeybaseDaemonRPCWithClient(testClient keybase1.GenericClient,
	log logger.Logger) KeybaseDaemonRPC {
	return KeybaseDaemonRPC{
		clientFactory: CancelableClientFactory{testClient},
		log:           log,
	}
}

func (k KeybaseDaemonRPC) filterKeys(ctx context.Context, uid keybase1.UID, keys []keybase1.PublicKey) ([]VerifyingKey, []CryptPublicKey, error) {
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

// OnConnect implements the ConnectionHandler interface.
func (k KeybaseDaemonRPC) OnConnect(ctx context.Context,
	conn *Connection, _ keybase1.GenericClient,
	server *rpc.Server) error {
	protocols := []rpc.Protocol{
		client.NewLogUIProtocol(),
		client.NewIdentifyUIProtocol(),
	}
	for _, p := range protocols {
		err := server.Register(p)
		if err != nil {
			if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
				return err
			}
		}
	}
	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (k KeybaseDaemonRPC) OnConnectError(err error, wait time.Duration) {
	k.log.Warning("KeybaseDaemonRPC: connection error: %q; retrying in %s",
		err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (k KeybaseDaemonRPC) OnDisconnected() {
	k.log.Warning("KeybaseDaemonRPC is disconnected")
}

// ShouldThrottle implements the ConnectionHandler interface.
func (k KeybaseDaemonRPC) ShouldThrottle(err error) bool {
	return false
}

func (k KeybaseDaemonRPC) identifyClient(
	ctx context.Context) keybase1.IdentifyClient {
	return keybase1.IdentifyClient{Cli: k.clientFactory.GetClient(ctx)}
}

// Identify implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) Identify(ctx context.Context, assertion string) (
	UserInfo, error) {
	arg := engine.IDEngineArg{UserAssertion: assertion}.Export()
	res, err := k.identifyClient(ctx).Identify(arg)
	if err != nil {
		return UserInfo{}, err
	}

	name := libkb.NewNormalizedUsername(res.User.Username)
	uid := keybase1.UID(res.User.Uid)

	verifyingKeys, cryptPublicKeys, err := k.filterKeys(ctx, uid, res.PublicKeys)
	if err != nil {
		return UserInfo{}, err
	}

	return UserInfo{
		Name:            name,
		UID:             uid,
		VerifyingKeys:   verifyingKeys,
		CryptPublicKeys: cryptPublicKeys,
	}, nil
}

func (k KeybaseDaemonRPC) userClient(
	ctx context.Context) keybase1.UserClient {
	return keybase1.UserClient{Cli: k.clientFactory.GetClient(ctx)}
}

// LoadUserPlusKeys implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) LoadUserPlusKeys(ctx context.Context, uid keybase1.UID) (
	UserInfo, error) {
	arg := keybase1.LoadUserPlusKeysArg{Uid: uid, CacheOK: true}
	res, err := k.userClient(ctx).LoadUserPlusKeys(arg)
	if err != nil {
		return UserInfo{}, err
	}

	verifyingKeys, cryptPublicKeys, err := k.filterKeys(ctx, uid, res.DeviceKeys)
	if err != nil {
		return UserInfo{}, err
	}

	return UserInfo{
		Name:            libkb.NormalizedUsername(res.Username),
		UID:             res.Uid,
		VerifyingKeys:   verifyingKeys,
		CryptPublicKeys: cryptPublicKeys,
	}, nil
}

func (k KeybaseDaemonRPC) sessionClient(
	ctx context.Context) keybase1.SessionClient {
	return keybase1.SessionClient{Cli: k.clientFactory.GetClient(ctx)}
}

// CurrentUID implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) CurrentUID(ctx context.Context, sessionID int) (
	keybase1.UID, error) {
	currentUID, err := k.sessionClient(ctx).CurrentUID(sessionID)
	if err != nil {
		return keybase1.UID(""), err
	}
	return currentUID, nil
}

// CurrentSession implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) CurrentSession(ctx context.Context, sessionID int) (
	SessionInfo, error) {
	res, err := k.sessionClient(ctx).CurrentSession(sessionID)
	if err != nil {
		return SessionInfo{}, err
	}
	// Import the KID to validate it.
	deviceSubkey, err := libkb.ImportKeypairFromKID(res.DeviceSubkeyKid)
	if err != nil {
		return SessionInfo{}, err
	}
	k.log.CDebugf(ctx, "got device subkey %s",
		deviceSubkey.GetKID().ToShortIDString())
	cryptPublicKey := CryptPublicKey{deviceSubkey.GetKID()}
	return SessionInfo{
		UID:            keybase1.UID(res.Uid),
		Token:          res.Token,
		CryptPublicKey: cryptPublicKey,
	}, nil
}

func (k KeybaseDaemonRPC) favoriteClient(
	ctx context.Context) keybase1.FavoriteClient {
	return keybase1.FavoriteClient{Cli: k.clientFactory.GetClient(ctx)}
}

// FavoriteAdd implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteClient(ctx).FavoriteAdd(keybase1.FavoriteAddArg{Folder: folder})
}

// FavoriteDelete implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	return k.favoriteClient(ctx).FavoriteDelete(keybase1.FavoriteDeleteArg{Folder: folder})
}

// FavoriteList implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) FavoriteList(ctx context.Context, sessionID int) ([]keybase1.Folder, error) {
	return k.favoriteClient(ctx).FavoriteList(sessionID)
}

// Shutdown implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k KeybaseDaemonRPC) Shutdown() {
	k.clientFactory.Shutdown()
}
