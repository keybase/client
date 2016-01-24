package libkbfs

import (
	"os"
	"sync"
	"time"

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
	log            logger.Logger

	// Only used when there's a real connection (i.e., not in
	// testing).
	shutdownFn func()
	daemonLog  logger.Logger

	sessionCacheLock sync.RWMutex
	// Set to the zero value when invalidated.
	cachedCurrentSession SessionInfo

	userCacheLock sync.RWMutex
	// Map entries are removed when invalidated.
	userCache map[keybase1.UID]UserInfo

	lastNotificationFilenameLock sync.Mutex
	lastNotificationFilename     string
}

var _ keybase1.NotifySessionInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyUsersInterface = (*KeybaseDaemonRPC)(nil)

var _ ConnectionHandler = (*KeybaseDaemonRPC)(nil)

var _ KeybaseDaemon = (*KeybaseDaemonRPC)(nil)

// NewKeybaseDaemonRPC makes a new KeybaseDaemonRPC that makes RPC
// calls using the socket of the given Keybase context.
func NewKeybaseDaemonRPC(config Config, kbCtx *libkb.GlobalContext, log logger.Logger, debug bool) *KeybaseDaemonRPC {
	k := newKeybaseDaemonRPC(kbCtx, log)
	conn := NewSharedKeybaseConnection(kbCtx, config, k)
	k.fillClients(conn.GetClient())
	k.shutdownFn = conn.Shutdown
	k.daemonLog = logger.NewWithCallDepth("daemon", 1, os.Stderr)
	if debug {
		k.daemonLog.Configure("", true, "")
	}
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
				verifyingKeys, MakeVerifyingKey(key.GetKID()))
		} else {
			k.log.CDebugf(
				ctx, "got crypt public key %s for user %s",
				key.VerboseDescription(), uid)
			cryptPublicKeys = append(
				cryptPublicKeys, MakeCryptPublicKey(key.GetKID()))
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

func (k *KeybaseDaemonRPC) clearCaches() {
	k.setCachedCurrentSession(SessionInfo{})
	k.userCacheLock.Lock()
	defer k.userCacheLock.Unlock()
	k.userCache = make(map[keybase1.UID]UserInfo)
}

// LoggedIn implements keybase1.NotifySessionInterface.
func (k *KeybaseDaemonRPC) LoggedIn(ctx context.Context, name string) error {
	k.log.CDebugf(ctx, "Current session logged in: %s", name)
	// Since we don't have the whole session, just clear the cache.
	k.setCachedCurrentSession(SessionInfo{})
	return nil
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

type daemonLogUI struct {
	log logger.Logger
}

var _ keybase1.LogUiInterface = daemonLogUI{}

func (l daemonLogUI) Log(ctx context.Context, arg keybase1.LogArg) error {
	format := "%s"
	// arg.Text.Markup should always be false, so ignore it.
	s := arg.Text.Data
	switch arg.Level {
	case keybase1.LogLevel_DEBUG:
		l.log.CDebugf(ctx, format, s)
	case keybase1.LogLevel_INFO:
		l.log.CInfof(ctx, format, s)
	case keybase1.LogLevel_WARN:
		l.log.CWarningf(ctx, format, s)
	case keybase1.LogLevel_ERROR:
		l.log.CErrorf(ctx, format, s)
	case keybase1.LogLevel_NOTICE:
		l.log.CNoticef(ctx, format, s)
	case keybase1.LogLevel_CRITICAL:
		l.log.CCriticalf(ctx, format, s)
	default:
		l.log.CWarningf(ctx, format, s)
	}
	return nil
}

type daemonIdentifyUI struct {
	log logger.Logger
}

var _ keybase1.IdentifyUiInterface = daemonIdentifyUI{}

func (d daemonIdentifyUI) DelegateIdentifyUI(ctx context.Context) (int, error) {
	d.log.CDebugf(ctx, "DelegateIdentifyUI() (returning 0, UIDelegationUnavailableError{}")
	return 0, libkb.UIDelegationUnavailableError{}
}

func (d daemonIdentifyUI) Start(ctx context.Context, arg keybase1.StartArg) error {
	d.log.CDebugf(ctx, "Start(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayKey(ctx context.Context, arg keybase1.DisplayKeyArg) error {
	d.log.CDebugf(ctx, "DisplayKey(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) ReportLastTrack(ctx context.Context, arg keybase1.ReportLastTrackArg) error {
	d.log.CDebugf(ctx, "ReportLastTrack(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) LaunchNetworkChecks(ctx context.Context, arg keybase1.LaunchNetworkChecksArg) error {
	d.log.CDebugf(ctx, "LaunchNetworkChecks(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayTrackStatement(ctx context.Context, arg keybase1.DisplayTrackStatementArg) error {
	d.log.CDebugf(ctx, "DisplayTrackStatement(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) FinishWebProofCheck(ctx context.Context, arg keybase1.FinishWebProofCheckArg) error {
	d.log.CDebugf(ctx, "FinishWebProofCheck(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) FinishSocialProofCheck(ctx context.Context, arg keybase1.FinishSocialProofCheckArg) error {
	d.log.CDebugf(ctx, "FinishSocialProofCheck(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayCryptocurrency(ctx context.Context, arg keybase1.DisplayCryptocurrencyArg) error {
	d.log.CDebugf(ctx, "DisplayCryptocurrency(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) ReportTrackToken(ctx context.Context, arg keybase1.ReportTrackTokenArg) error {
	d.log.CDebugf(ctx, "ReportTrackToken(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayUserCard(ctx context.Context, arg keybase1.DisplayUserCardArg) error {
	d.log.CDebugf(ctx, "DisplayUserCard(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) Confirm(ctx context.Context, arg keybase1.ConfirmArg) (keybase1.ConfirmResult, error) {
	d.log.CDebugf(ctx, "Confirm(%+v) (returning false)", arg)
	return keybase1.ConfirmResult{
		IdentityConfirmed: false,
		RemoteConfirmed:   false,
	}, nil
}

func (d daemonIdentifyUI) Finish(ctx context.Context, sessionID int) error {
	d.log.CDebugf(ctx, "Finish(%d)", sessionID)
	return nil
}

// OnConnect implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnConnect(ctx context.Context,
	conn *Connection, rawClient keybase1.GenericClient,
	server *rpc.Server) error {
	protocols := []rpc.Protocol{
		keybase1.LogUiProtocol(daemonLogUI{k.daemonLog}),
		keybase1.IdentifyUiProtocol(daemonIdentifyUI{k.daemonLog}),
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

	// Introduce ourselves. TODO: move this to SharedKeybaseConnection
	// somehow?
	configClient := keybase1.ConfigClient{Cli: cancelableClient{rawClient}}
	err = configClient.HelloIAm(ctx, keybase1.ClientDetails{
		Pid:        os.Getpid(),
		ClientType: keybase1.ClientType_KBFS,
		Argv:       os.Args,
		Version:    VersionString(),
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
func (k *KeybaseDaemonRPC) OnDisconnected(status DisconnectStatus) {
	if status == StartingNonFirstConnection {
		k.log.Warning("KeybaseDaemonRPC is disconnected")
	}

	k.clearCaches()
}

// ShouldThrottle implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) ShouldThrottle(err error) bool {
	return false
}

// Resolve implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) Resolve(ctx context.Context, assertion string) (
	keybase1.UID, error) {
	return k.identifyClient.Resolve(ctx, assertion)
}

// Identify implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) Identify(ctx context.Context, assertion, reason string) (
	UserInfo, error) {
	// setting UseDelegateUI to true here will cause daemon to use
	// registered identify ui providers instead of terminal if any
	// are available.  If not, then it will use the terminal UI.
	arg := keybase1.Identify2Arg{
		UserAssertion: assertion,
		UseDelegateUI: true,
		Reason:        keybase1.IdentifyReason{Reason: reason},
	}
	res, err := k.identifyClient.Identify2(ctx, arg)
	if err != nil {
		return UserInfo{}, err
	}

	return k.processUserPlusKeys(ctx, res.Upk)
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

	return k.processUserPlusKeys(ctx, res)
}

func (k *KeybaseDaemonRPC) processUserPlusKeys(
	ctx context.Context, upk keybase1.UserPlusKeys) (UserInfo, error) {
	verifyingKeys, cryptPublicKeys, err := k.filterKeys(ctx, upk.Uid, upk.DeviceKeys)
	if err != nil {
		return UserInfo{}, err
	}

	u := UserInfo{
		Name:            libkb.NewNormalizedUsername(upk.Username),
		UID:             upk.Uid,
		VerifyingKeys:   verifyingKeys,
		CryptPublicKeys: cryptPublicKeys,
	}

	k.setCachedUserInfo(upk.Uid, u)
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
		if ncs := (NoCurrentSessionError{}); err.Error() == ncs.Error() {
			// Use an error with a proper OS error code attached to it.
			err = ncs
		}
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
	cryptPublicKey := MakeCryptPublicKey(deviceSubkey.GetKID())
	verifyingKey := MakeVerifyingKey(deviceSibkey.GetKID())
	s := SessionInfo{
		UID:            keybase1.UID(res.Uid),
		Token:          res.Token,
		CryptPublicKey: cryptPublicKey,
		VerifyingKey:   verifyingKey,
	}

	k.log.CDebugf(
		ctx, "new session with uid %s, crypt public key %s, and verifying key %s",
		s.UID, s.CryptPublicKey, s.VerifyingKey)

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
	// Reduce log spam by not repeating log lines for
	// notifications with the same filename.
	//
	// TODO: Only do this in debug mode.
	func() {
		k.lastNotificationFilenameLock.Lock()
		defer k.lastNotificationFilenameLock.Unlock()
		if notification.Filename != k.lastNotificationFilename {
			k.lastNotificationFilename = notification.Filename
			k.log.CDebugf(ctx, "Sending notification for %s", notification.Filename)
		}
	}()
	return k.kbfsClient.FSEvent(ctx, *notification)
}

// Shutdown implements the KeybaseDaemon interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) Shutdown() {
	if k.shutdownFn != nil {
		k.shutdownFn()
	}
}
