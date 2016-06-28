// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

const (
	// MdServerTokenServer is the expected server type for mdserver authentication.
	MdServerTokenServer = "kbfs_md"
	// MdServerTokenExpireIn is the TTL to use when constructing an authentication token.
	MdServerTokenExpireIn = 2 * 60 * 60 // 2 hours
	// MdServerBackgroundRekeyPeriod is how long the rekey checker
	// waits between runs.  The timer gets reset to this period after
	// every incoming FolderNeedsRekey RPC.
	MdServerBackgroundRekeyPeriod = 1 * time.Hour
	// MdServerDefaultPingIntervalSeconds is the default interval on which the
	// client should contact the MD Server
	MdServerDefaultPingIntervalSeconds = 10
)

// MDServerRemote is an implementation of the MDServer interface.
type MDServerRemote struct {
	config       Config
	conn         *rpc.Connection
	client       keybase1.MetadataClient
	log          logger.Logger
	mdSrvAddr    string
	authToken    *AuthToken
	squelchRekey bool

	authenticatedMtx sync.Mutex
	isAuthenticated  bool

	observerMu sync.Mutex // protects observers
	observers  map[TlfID]chan<- error

	tickerCancel context.CancelFunc
	tickerMu     sync.Mutex // protects the ticker cancel function

	rekeyCancel context.CancelFunc
	rekeyTimer  *time.Timer
}

// Test that MDServerRemote fully implements the MDServer interface.
var _ MDServer = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the KeyServer interface.
var _ KeyServer = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the AuthTokenRefreshHandler interface.
var _ AuthTokenRefreshHandler = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the ConnectionHandler interface.
var _ rpc.ConnectionHandler = (*MDServerRemote)(nil)

// NewMDServerRemote returns a new instance of MDServerRemote.
func NewMDServerRemote(config Config, srvAddr string, ctx Context) *MDServerRemote {
	mdServer := &MDServerRemote{
		config:     config,
		observers:  make(map[TlfID]chan<- error),
		log:        config.MakeLogger(""),
		mdSrvAddr:  srvAddr,
		rekeyTimer: time.NewTimer(MdServerBackgroundRekeyPeriod),
	}
	mdServer.authToken = NewAuthToken(config,
		MdServerTokenServer, MdServerTokenExpireIn,
		"libkbfs_mdserver_remote", mdServer)
	conn := rpc.NewTLSConnection(srvAddr, GetRootCerts(srvAddr),
		MDServerErrorUnwrapper{}, mdServer, true,
		ctx.NewRPCLogFactory(), libkb.WrapError,
		config.MakeLogger(""), LogTagsFromContext)
	mdServer.conn = conn
	mdServer.client = keybase1.MetadataClient{Cli: conn.GetClient()}

	// Check for rekey opportunities periodically.
	rekeyCtx, rekeyCancel := context.WithCancel(context.Background())
	mdServer.rekeyCancel = rekeyCancel
	go mdServer.backgroundRekeyChecker(rekeyCtx)

	return mdServer
}

// RemoteAddress returns the remote mdserver this client is talking to
func (md *MDServerRemote) RemoteAddress() string {
	return md.mdSrvAddr
}

// HandlerName implements the ConnectionHandler interface.
func (*MDServerRemote) HandlerName() string {
	return "MDServerRemote"
}

// OnConnect implements the ConnectionHandler interface.
func (md *MDServerRemote) OnConnect(ctx context.Context,
	conn *rpc.Connection, client rpc.GenericClient,
	server *rpc.Server) (err error) {

	defer func() {
		if err == nil {
			md.config.Reporter().Notify(ctx,
				connectionNotification(connectionStatusConnected))
		}
	}()

	md.log.Debug("MDServerRemote: OnConnect called with a new connection")

	// we'll get replies asynchronously as to not block the connection
	// for doing other active work for the user. they will be sent to
	// the FolderNeedsRekey handler.
	if err := server.Register(keybase1.MetadataUpdateProtocol(md)); err != nil {
		if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
			return err
		}
	}

	// reset auth -- using md.client here would cause problematic recursion.
	c := keybase1.MetadataClient{Cli: client}
	pingIntervalSeconds, err := md.resetAuth(ctx, c)
	switch err.(type) {
	case nil:
	case NoCurrentSessionError:
	default:
		return err
	}

	md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, nil)

	// start pinging
	md.resetPingTicker(pingIntervalSeconds)
	return nil
}

// resetAuth is called to reset the authorization on an MDServer
// connection.
func (md *MDServerRemote) resetAuth(ctx context.Context, c keybase1.MetadataClient) (int, error) {

	md.log.Debug("MDServerRemote: resetAuth called")

	isAuthenticated := false
	defer func() {
		md.authenticatedMtx.Lock()
		md.isAuthenticated = isAuthenticated
		md.authenticatedMtx.Unlock()
	}()

	_, _, err := md.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		md.log.Debug("MDServerRemote: User logged out, skipping resetAuth")
		return MdServerDefaultPingIntervalSeconds, NoCurrentSessionError{}
	}

	challenge, err := c.GetChallenge(ctx)
	if err != nil {
		md.log.Warning("MDServerRemote: challenge request error: %v", err)
		return 0, err
	}
	md.log.Debug("MDServerRemote: received challenge")

	// get a new signature
	signature, err := md.authToken.Sign(ctx, challenge)
	if err != nil {
		md.log.Warning("MDServerRemote: error signing authentication token: %v", err)
		return 0, err
	}
	md.log.Debug("MDServerRemote: authentication token signed")

	// authenticate
	pingIntervalSeconds, err := c.Authenticate(ctx, signature)
	if err != nil {
		md.log.Warning("MDServerRemote: authentication error: %v", err)
		return 0, err
	}
	md.log.Debug("MDServerRemote: authentication successful; ping interval: %ds", pingIntervalSeconds)

	isAuthenticated = true

	md.authenticatedMtx.Lock()
	if !md.isAuthenticated {
		defer func() {
			// request a list of folders needing rekey action
			if err := md.getFoldersForRekey(ctx, c); err != nil {
				md.log.Warning("MDServerRemote: getFoldersForRekey failed with %v", err)
			}
			md.log.Debug("MDServerRemote: requested list of folders for rekey")
		}()
	}
	// Need to ensure that any conflicting thread gets the updated value
	md.isAuthenticated = true
	md.authenticatedMtx.Unlock()

	return pingIntervalSeconds, nil
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (md *MDServerRemote) RefreshAuthToken(ctx context.Context) {
	md.log.Debug("MDServerRemote: Refreshing auth token...")

	_, err := md.resetAuth(ctx, md.client)
	switch err.(type) {
	case nil:
		md.log.Debug("MDServerRemote: auth token refreshed")
	case NoCurrentSessionError:
		md.log.Debug("MDServerRemote: no session available, connection remains anonymous")
	default:
		md.log.Debug("MDServerRemote: error refreshing auth token: %v", err)
	}
}

// Helper to reset a ping ticker.
func (md *MDServerRemote) resetPingTicker(intervalSeconds int) {
	md.tickerMu.Lock()
	defer md.tickerMu.Unlock()

	if md.tickerCancel != nil {
		md.tickerCancel()
		md.tickerCancel = nil
	}
	if intervalSeconds <= 0 {
		return
	}

	md.log.Debug("MDServerRemote: starting new ping ticker with interval %d",
		intervalSeconds)

	var ctx context.Context
	ctx, md.tickerCancel = context.WithCancel(context.Background())
	go func() {
		ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
		for {
			select {
			case <-ticker.C:
				err := md.client.Ping(ctx)
				if err != nil {
					md.log.Debug("MDServerRemote: ping error %s", err)
				}

			case <-ctx.Done():
				md.log.Debug("MDServerRemote: stopping ping ticker")
				ticker.Stop()
				return
			}
		}
	}()
}

// OnConnectError implements the ConnectionHandler interface.
func (md *MDServerRemote) OnConnectError(err error, wait time.Duration) {
	md.log.Warning("MDServerRemote: connection error: %q; retrying in %s",
		err, wait)
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
	md.cancelObservers()
	md.resetPingTicker(0)
	if md.authToken != nil {
		md.authToken.Shutdown()
	}

	md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, err)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (md *MDServerRemote) OnDoCommandError(err error, wait time.Duration) {
	md.log.Warning("MDServerRemote: DoCommand error: %q; retrying in %s",
		err, wait)
	md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, err)
}

// OnDisconnected implements the ConnectionHandler interface.
func (md *MDServerRemote) OnDisconnected(ctx context.Context,
	status rpc.DisconnectStatus) {
	md.log.Warning("MDServerRemote is disconnected: %v", status)
	md.config.Reporter().Notify(ctx,
		connectionNotification(connectionStatusDisconnected))
	md.cancelObservers()
	md.resetPingTicker(0)
	if md.authToken != nil {
		md.authToken.Shutdown()
	}
	md.config.RekeyQueue().Clear()
	// Reset the timer since we will get folders for rekey again on
	// the re-connect.
	md.rekeyTimer.Reset(MdServerBackgroundRekeyPeriod)

	md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, errDisconnected{})
}

// ShouldRetry implements the ConnectionHandler interface.
func (md *MDServerRemote) ShouldRetry(name string, err error) bool {
	_, shouldThrottle := err.(MDServerErrorThrottle)
	return shouldThrottle
}

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (md *MDServerRemote) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
}

// Signal errors and clear any registered observers.
func (md *MDServerRemote) cancelObservers() {
	md.observerMu.Lock()
	defer md.observerMu.Unlock()
	// fire errors for any registered observers
	for id, observerChan := range md.observers {
		md.signalObserverLocked(observerChan, id, MDServerDisconnected{})
	}
}

// Signal an observer. The observer lock must be held.
func (md *MDServerRemote) signalObserverLocked(observerChan chan<- error, id TlfID, err error) {
	observerChan <- err
	close(observerChan)
	delete(md.observers, id)
}

// Helper used to retrieve metadata blocks from the MD server.
func (md *MDServerRemote) get(ctx context.Context, id TlfID,
	handle *BareTlfHandle, bid BranchID, mStatus MergeStatus,
	start, stop MetadataRevision) (TlfID, []*RootMetadataSigned, error) {
	// figure out which args to send
	if id == NullTlfID && handle == nil {
		panic("nil TlfID and handle passed into MDServerRemote.get")
	}
	arg := keybase1.GetMetadataArg{
		StartRevision: start.Number(),
		StopRevision:  stop.Number(),
		BranchID:      bid.String(),
		Unmerged:      mStatus == Unmerged,
		LogTags:       nil,
	}

	var err error
	if id == NullTlfID {
		arg.FolderHandle, err = md.config.Codec().Encode(handle)
		if err != nil {
			return id, nil, err
		}
	} else {
		arg.FolderID = id.String()
	}

	// request
	response, err := md.client.GetMetadata(ctx, arg)
	if err != nil {
		return id, nil, err
	}

	// response
	id, err = ParseTlfID(response.FolderID)
	if err != nil {
		return id, nil, err
	}

	// deserialize blocks
	rmdses := make([]*RootMetadataSigned, len(response.MdBlocks))
	for i, block := range response.MdBlocks {
		ver := MetadataVer(block.Version)
		if ver < FirstValidMetadataVer {
			return id, nil, InvalidMetadataVersionError{id, ver}
		} else if ver > md.config.MetadataVersion() {
			return id, nil, NewMetadataVersionError{id, ver}
		}

		var rmds RootMetadataSigned
		err = md.config.Codec().Decode(block.Block, &rmds)
		if err != nil {
			return id, rmdses, err
		}
		rmds.untrustedServerTimestamp = keybase1.FromTime(block.Timestamp)
		rmdses[i] = &rmds
	}
	return id, rmdses, nil
}

// GetForHandle implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetForHandle(ctx context.Context,
	handle BareTlfHandle, mStatus MergeStatus) (
	TlfID, *RootMetadataSigned, error) {
	id, rmdses, err := md.get(ctx, NullTlfID, &handle, NullBranchID,
		mStatus,
		MetadataRevisionUninitialized, MetadataRevisionUninitialized)
	if err != nil {
		return id, nil, err
	}
	if len(rmdses) == 0 {
		return id, nil, nil
	}
	return id, rmdses[0], nil
}

// GetForTLF implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetForTLF(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus) (*RootMetadataSigned, error) {
	_, rmdses, err := md.get(ctx, id, nil, bid, mStatus,
		MetadataRevisionUninitialized, MetadataRevisionUninitialized)
	if err != nil {
		return nil, err
	}
	if len(rmdses) == 0 {
		return nil, nil
	}
	return rmdses[0], nil
}

// GetRange implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetRange(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus, start, stop MetadataRevision) (
	[]*RootMetadataSigned, error) {
	_, rmds, err := md.get(ctx, id, nil, bid, mStatus, start, stop)
	return rmds, err
}

// Put implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) Put(ctx context.Context, rmds *RootMetadataSigned) error {
	// encode MD block
	rmdsBytes, err := md.config.Codec().Encode(rmds)
	if err != nil {
		return err
	}

	// put request
	arg := keybase1.PutMetadataArg{
		MdBlock: keybase1.MDBlock{
			Version: int(rmds.Version()),
			Block:   rmdsBytes,
		},
		LogTags: nil,
	}
	return md.client.PutMetadata(ctx, arg)
}

// PruneBranch implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) PruneBranch(ctx context.Context, id TlfID, bid BranchID) error {
	arg := keybase1.PruneBranchArg{
		FolderID: id.String(),
		BranchID: bid.String(),
		LogTags:  nil,
	}
	return md.client.PruneBranch(ctx, arg)
}

// MetadataUpdate implements the MetadataUpdateProtocol interface.
func (md *MDServerRemote) MetadataUpdate(_ context.Context, arg keybase1.MetadataUpdateArg) error {
	id, err := ParseTlfID(arg.FolderID)
	if err != nil {
		return err
	}

	md.observerMu.Lock()
	defer md.observerMu.Unlock()
	observerChan, ok := md.observers[id]
	if !ok {
		// not registered
		return nil
	}

	// signal that we've seen the update
	md.signalObserverLocked(observerChan, id, nil)
	return nil
}

// FolderNeedsRekey implements the MetadataUpdateProtocol interface.
func (md *MDServerRemote) FolderNeedsRekey(_ context.Context, arg keybase1.FolderNeedsRekeyArg) error {
	id, err := ParseTlfID(arg.FolderID)
	if err != nil {
		return err
	}
	md.log.Debug("MDServerRemote: folder needs rekey: %s", id.String())
	if md.squelchRekey {
		md.log.Debug("MDServerRemote: rekey updates squelched for testing")
		return nil
	}
	// queue the folder for rekeying
	errChan := md.config.RekeyQueue().Enqueue(id)
	select {
	case err := <-errChan:
		md.log.Warning("MDServerRemote: error queueing %s for rekey: %v", id, err)
	default:
	}
	// Reset the timer in case there are a lot of rekey folders
	// dribbling in from the server still.
	md.rekeyTimer.Reset(MdServerBackgroundRekeyPeriod)
	return nil
}

// RegisterForUpdate implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) RegisterForUpdate(ctx context.Context, id TlfID,
	currHead MetadataRevision) (<-chan error, error) {
	arg := keybase1.RegisterForUpdatesArg{
		FolderID:     id.String(),
		CurrRevision: currHead.Number(),
		LogTags:      nil,
	}

	// register
	var c chan error
	err := md.conn.DoCommand(ctx, "register", func(rawClient rpc.GenericClient) error {
		// set up the server to receive updates, since we may
		// get disconnected between retries.
		server := md.conn.GetServer()
		err := server.Register(keybase1.MetadataUpdateProtocol(md))
		if err != nil {
			if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
				return err
			}
		}
		// TODO: Do something with server.Err() when server is
		// done?
		server.Run()

		// keep re-adding the observer on retries, since
		// disconnects or connection errors clear observers.
		func() {
			md.observerMu.Lock()
			defer md.observerMu.Unlock()
			if _, ok := md.observers[id]; ok {
				panic(fmt.Sprintf("Attempted double-registration for folder: %s",
					id))
			}
			c = make(chan error, 1)
			md.observers[id] = c
		}()
		// Use this instead of md.client since we're already
		// inside a DoCommand().
		c := keybase1.MetadataClient{Cli: rawClient}
		err = c.RegisterForUpdates(ctx, arg)
		if err != nil {
			func() {
				md.observerMu.Lock()
				defer md.observerMu.Unlock()
				// we could've been canceled by a shutdown so look this up
				// again before closing and deleting.
				if updateChan, ok := md.observers[id]; ok {
					close(updateChan)
					delete(md.observers, id)
				}
			}()
		}
		return err
	})
	if err != nil {
		c = nil
	}

	return c, err
}

// TruncateLock implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) TruncateLock(ctx context.Context, id TlfID) (
	bool, error) {
	return md.client.TruncateLock(ctx, id.String())
}

// TruncateUnlock implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) TruncateUnlock(ctx context.Context, id TlfID) (
	bool, error) {
	return md.client.TruncateUnlock(ctx, id.String())
}

// GetLatestHandleForTLF implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetLatestHandleForTLF(ctx context.Context, id TlfID) (
	BareTlfHandle, error) {
	buf, err := md.client.GetLatestFolderHandle(ctx, id.String())
	if err != nil {
		return BareTlfHandle{}, err
	}
	var handle BareTlfHandle
	if err := md.config.Codec().Decode(buf, &handle); err != nil {
		return BareTlfHandle{}, err
	}
	return handle, nil
}

// CheckForRekeys implements the MDServer interface.
func (md *MDServerRemote) CheckForRekeys(ctx context.Context) <-chan error {
	// Wait 5 seconds before asking for rekeys, because the server
	// could have an out-of-date cache if we ask too soon.  Why 5
	// seconds you ask?  See `pollWait` in
	// github.com/keybase/client/go/auth/user_keys_api.go.  We don't
	// use that value directly since there's no guarantee the server
	// is using the same value.  TODO: the server should tell us what
	// value it is using.
	c := make(chan error, 1)
	time.AfterFunc(5*time.Second, func() {
		md.log.CInfof(ctx, "CheckForRekeys: checking for rekeys")
		select {
		case <-ctx.Done():
			c <- ctx.Err()
		default:
		}
		if err := md.getFoldersForRekey(ctx, md.client); err != nil {
			md.log.CDebugf(ctx, "getFoldersForRekey failed during "+
				"CheckForRekeys: %v", err)
			c <- err
		}
		md.rekeyTimer.Reset(MdServerBackgroundRekeyPeriod)
		c <- nil
	})
	return c
}

// getFoldersForRekey registers to receive updates about folders needing rekey actions.
func (md *MDServerRemote) getFoldersForRekey(ctx context.Context,
	client keybase1.MetadataClient) error {
	// get this device's crypt public key
	cryptKey, err := md.config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return err
	}
	return client.GetFoldersForRekey(ctx, cryptKey.kid)
}

// Shutdown implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) Shutdown() {
	// close the connection
	md.conn.Shutdown()
	// cancel pending observers
	md.cancelObservers()
	// cancel the ping ticker
	md.resetPingTicker(0)
	// cancel the auth token ticker
	if md.authToken != nil {
		md.authToken.Shutdown()
	}
	if md.rekeyCancel != nil {
		md.rekeyCancel()
	}
}

// IsConnected implements the MDServer interface for MDServerLocal
func (md *MDServerRemote) IsConnected() bool {
	return md.conn != nil && md.conn.IsConnected()
}

//
// The below methods support the MD server acting as the key server.
// This will be the case for v1 of KBFS but we may move to our own
// separate key server at some point.
//

// GetTLFCryptKeyServerHalf is an implementation of the KeyServer interface.
func (md *MDServerRemote) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID TLFCryptKeyServerHalfID, cryptKey CryptPublicKey) (serverHalf TLFCryptKeyServerHalf, err error) {
	// encode the ID
	idBytes, err := md.config.Codec().Encode(serverHalfID)
	if err != nil {
		return
	}

	// get the key
	arg := keybase1.GetKeyArg{
		KeyHalfID: idBytes,
		DeviceKID: cryptKey.kid.String(),
		LogTags:   nil,
	}
	keyBytes, err := md.client.GetKey(ctx, arg)
	if err != nil {
		return
	}

	// decode the key
	err = md.config.Codec().Decode(keyBytes, &serverHalf)
	if err != nil {
		return
	}

	return
}

// PutTLFCryptKeyServerHalves is an implementation of the KeyServer interface.
func (md *MDServerRemote) PutTLFCryptKeyServerHalves(ctx context.Context,
	serverKeyHalves map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf) error {
	// flatten out the map into an array
	var keyHalves []keybase1.KeyHalf
	for user, deviceMap := range serverKeyHalves {
		for deviceKID, serverHalf := range deviceMap {
			keyHalf, err := md.config.Codec().Encode(serverHalf)
			if err != nil {
				return err
			}
			keyHalves = append(keyHalves,
				keybase1.KeyHalf{
					User:      user,
					DeviceKID: deviceKID,
					Key:       keyHalf,
				})
		}
	}
	// put the keys
	arg := keybase1.PutKeysArg{
		KeyHalves: keyHalves,
		LogTags:   nil,
	}
	return md.client.PutKeys(ctx, arg)
}

// DeleteTLFCryptKeyServerHalf is an implementation of the KeyServer interface.
func (md *MDServerRemote) DeleteTLFCryptKeyServerHalf(ctx context.Context,
	uid keybase1.UID, kid keybase1.KID,
	serverHalfID TLFCryptKeyServerHalfID) error {
	// encode the ID
	idBytes, err := md.config.Codec().Encode(serverHalfID)
	if err != nil {
		return err
	}

	// get the key
	arg := keybase1.DeleteKeyArg{
		Uid:       uid,
		DeviceKID: kid,
		KeyHalfID: idBytes,
		LogTags:   nil,
	}
	err = md.client.DeleteKey(ctx, arg)
	if err != nil {
		return err
	}

	return nil
}

// DisableRekeyUpdatesForTesting implements the MDServer interface.
func (md *MDServerRemote) DisableRekeyUpdatesForTesting() {
	// This doesn't need a lock for testing.
	md.squelchRekey = true
	md.rekeyTimer.Stop()
}

// CtxMDSRTagKey is the type used for unique context tags within MDServerRemote
type CtxMDSRTagKey int

const (
	// CtxMDSRIDKey is the type of the tag for unique operation IDs
	// within MDServerRemote.
	CtxMDSRIDKey CtxMDSRTagKey = iota
)

// CtxMDSROpID is the display name for the unique operation
// MDServerRemote ID tag.
const CtxMDSROpID = "MDSRID"

func (md *MDServerRemote) backgroundRekeyChecker(ctx context.Context) {
	for {
		select {
		case <-md.rekeyTimer.C:
			if !md.conn.IsConnected() {
				md.rekeyTimer.Reset(MdServerBackgroundRekeyPeriod)
				continue
			}

			// Assign an ID to this rekey check so we can track it.
			newCtx := ctxWithRandomID(ctx, CtxMDSRIDKey, CtxMDSROpID, md.log)
			md.log.CDebugf(newCtx, "Checking for rekey folders")
			if err := md.getFoldersForRekey(newCtx, md.client); err != nil {
				md.log.CWarningf(newCtx, "MDServerRemote: getFoldersForRekey "+
					"failed with %v", err)
			}
			md.rekeyTimer.Reset(MdServerBackgroundRekeyPeriod)
		case <-ctx.Done():
			return
		}
	}
}
