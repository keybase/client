// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	// MdServerBackgroundRekeyPeriod is how long the rekey checker
	// waits between runs on average. The timer gets reset after
	// every incoming FolderNeedsRekey RPC.
	// The amount of wait is calculated in nextRekeyTime.
	MdServerBackgroundRekeyPeriod = 1 * time.Hour
	// MdServerDefaultPingIntervalSeconds is the default interval on which the
	// client should contact the MD Server
	MdServerDefaultPingIntervalSeconds = 10
	// MdServerPingTimeout is how long to wait for a ping response
	// before breaking the connection and trying to reconnect.
	MdServerPingTimeout = 30 * time.Second
)

// MDServerRemote is an implementation of the MDServer interface.
type MDServerRemote struct {
	config        Config
	log           traceLogger
	deferLog      traceLogger
	mdSrvRemote   rpc.Remote
	connOpts      rpc.ConnectionOpts
	rpcLogFactory rpc.LogFactory
	authToken     *kbfscrypto.AuthToken
	squelchRekey  bool
	pinger        pinger

	authenticatedMtx sync.RWMutex
	isAuthenticated  bool

	connMu sync.RWMutex
	conn   *rpc.Connection
	client keybase1.MetadataClient

	observerMu sync.Mutex // protects observers
	// chan is nil if we have unregistered locally, but not yet with
	// the server.
	observers map[tlf.ID]chan<- error

	tickerCancel context.CancelFunc
	tickerMu     sync.Mutex // protects the ticker cancel function

	rekeyCancel context.CancelFunc
	rekeyTimer  *time.Timer

	serverOffsetMu    sync.RWMutex
	serverOffsetKnown bool
	serverOffset      time.Duration
}

// Test that MDServerRemote fully implements the MDServer interface.
var _ MDServer = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the KeyServer interface.
var _ KeyServer = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the AuthTokenRefreshHandler interface.
var _ kbfscrypto.AuthTokenRefreshHandler = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the ConnectionHandler interface.
var _ rpc.ConnectionHandler = (*MDServerRemote)(nil)

// NewMDServerRemote returns a new instance of MDServerRemote.
func NewMDServerRemote(config Config, srvRemote rpc.Remote,
	rpcLogFactory rpc.LogFactory) *MDServerRemote {
	log := config.MakeLogger("")
	deferLog := log.CloneWithAddedDepth(1)
	mdServer := &MDServerRemote{
		config:        config,
		observers:     make(map[tlf.ID]chan<- error),
		log:           traceLogger{log},
		deferLog:      traceLogger{deferLog},
		mdSrvRemote:   srvRemote,
		rpcLogFactory: rpcLogFactory,
		rekeyTimer:    time.NewTimer(nextRekeyTime()),
	}

	mdServer.pinger = pinger{
		name:    "MDServerRemote",
		doPing:  mdServer.pingOnce,
		timeout: MdServerPingTimeout,
		log:     mdServer.log,
	}

	mdServer.authToken = kbfscrypto.NewAuthToken(config.Crypto(),
		kbfsmd.ServerTokenServer, kbfsmd.ServerTokenExpireIn,
		"libkbfs_mdserver_remote", VersionString(), mdServer)
	constBackoff := backoff.NewConstantBackOff(RPCReconnectInterval)
	mdServer.connOpts = rpc.ConnectionOpts{
		WrapErrorFunc:    libkb.WrapError,
		TagsFunc:         libkb.LogTagsFromContext,
		ReconnectBackoff: func() backoff.BackOff { return constBackoff },

		InitialReconnectBackoffWindow: mdserverReconnectBackoffWindow,
	}
	mdServer.initNewConnection()

	// Check for rekey opportunities periodically.
	rekeyCtx, rekeyCancel := context.WithCancel(context.Background())
	mdServer.rekeyCancel = rekeyCancel
	if config.Mode() != InitSingleOp {
		go mdServer.backgroundRekeyChecker(rekeyCtx)
	}

	return mdServer
}

func (md *MDServerRemote) getIsAuthenticated() bool {
	md.authenticatedMtx.RLock()
	defer md.authenticatedMtx.RUnlock()
	return md.isAuthenticated
}

func (md *MDServerRemote) setIsAuthenticated(isAuthenticated bool) {
	md.authenticatedMtx.Lock()
	defer md.authenticatedMtx.Unlock()
	md.isAuthenticated = isAuthenticated
}

func (md *MDServerRemote) initNewConnection() {
	md.connMu.Lock()
	defer md.connMu.Unlock()

	if md.conn != nil {
		md.conn.Shutdown()
	}

	md.conn = rpc.NewTLSConnection(md.mdSrvRemote, kbfscrypto.GetRootCerts(
		md.mdSrvRemote.Peek(), libkb.GetBundledCAsFromHost),
		kbfsmd.ServerErrorUnwrapper{}, md, md.rpcLogFactory,
		md.config.MakeLogger(""), md.connOpts)
	md.client = keybase1.MetadataClient{Cli: md.conn.GetClient()}
}

const reconnectTimeout = 30 * time.Second

func (md *MDServerRemote) reconnect() error {
	md.connMu.Lock()
	defer md.connMu.Unlock()

	if md.conn != nil {
		ctx, cancel := context.WithTimeout(
			context.Background(), reconnectTimeout)
		defer cancel()
		return md.conn.ForceReconnect(ctx)
	}

	md.initNewConnection()
	return nil

}

// RemoteAddress returns the remote mdserver this client is talking to
func (md *MDServerRemote) RemoteAddress() string {
	return md.mdSrvRemote.String()
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

	md.log.CDebugf(ctx, "OnConnect called with a new connection")

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
		md.log.CDebugf(ctx, "Logged-out user")
	default:
		return err
	}

	md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, nil)

	// start pinging
	md.pinger.resetTicker(pingIntervalSeconds)
	return nil
}

type ctxMDServerResetKeyType int

const (
	// ctxMDServerResetKey identifies whether the current context has
	// already passed through `MDServerRemote.resetAuth`.
	ctxMDServerResetKey ctxMDServerResetKeyType = iota
)

// resetAuth is called to reset the authorization on an MDServer
// connection.  If this function returns NoCurrentSessionError, the
// caller should treat this as a logged-out user.
func (md *MDServerRemote) resetAuth(
	ctx context.Context, c keybase1.MetadataClient) (int, error) {
	ctx = context.WithValue(ctx, ctxMDServerResetKey, "1")

	isAuthenticated := false
	defer func() {
		md.setIsAuthenticated(isAuthenticated)
	}()

	session, err := md.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		md.log.CDebugf(ctx,
			"Error getting current session (%+v), skipping resetAuth", err)
		return MdServerDefaultPingIntervalSeconds, err
	}

	challenge, err := c.GetChallenge(ctx)
	if err != nil {
		md.log.CWarningf(ctx, "challenge request error: %v", err)
		return 0, err
	}
	md.log.CDebugf(ctx, "received challenge")

	// get a new signature
	signature, err := md.authToken.Sign(ctx, session.Name, session.UID,
		session.VerifyingKey, challenge)
	if err != nil {
		md.log.CWarningf(ctx, "error signing authentication token: %v", err)
		return 0, err
	}
	md.log.CDebugf(ctx, "authentication token signed")

	// authenticate
	pingIntervalSeconds, err := c.Authenticate(ctx, signature)
	if err != nil {
		md.log.CWarningf(ctx, "authentication error: %v", err)
		return 0, err
	}
	md.log.CDebugf(ctx, "authentication successful; ping interval: %ds",
		pingIntervalSeconds)

	isAuthenticated = true

	md.authenticatedMtx.Lock()
	if !md.isAuthenticated && md.config.Mode() != InitSingleOp {
		defer func() {
			// request a list of folders needing rekey action
			if err := md.getFoldersForRekey(ctx, c); err != nil {
				md.log.CWarningf(ctx, "getFoldersForRekey failed with %v", err)
			}
			md.deferLog.CDebugf(ctx,
				"requested list of folders for rekey")
		}()
	}
	// Need to ensure that any conflicting thread gets the updated value
	md.isAuthenticated = true
	md.authenticatedMtx.Unlock()

	return pingIntervalSeconds, nil
}

func (md *MDServerRemote) getClient() keybase1.MetadataClient {
	md.connMu.RLock()
	defer md.connMu.RUnlock()
	return md.client
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (md *MDServerRemote) RefreshAuthToken(ctx context.Context) {
	md.log.CDebugf(ctx, "MDServerRemote: Refreshing auth token...")

	if v := ctx.Value(ctxMDServerResetKey); v != nil {
		md.log.CDebugf(ctx, "Avoiding resetAuth recursion")
		return
	}

	_, err := md.resetAuth(ctx, md.getClient())
	switch err.(type) {
	case nil:
		md.log.CDebugf(ctx, "MDServerRemote: auth token refreshed")
	case NoCurrentSessionError:
		md.log.CDebugf(ctx,
			"MDServerRemote: no session available, connection remains anonymous")
	default:
		md.log.CDebugf(ctx,
			"MDServerRemote: error refreshing auth token: %v", err)
		// TODO: once KBFS-1982 is merged, an unknown error here
		// should just cause a complete disconnect, and we can let the
		// rpc connection do the retry.
	}
}

func (md *MDServerRemote) pingOnce(ctx context.Context) {
	clock := md.config.Clock()
	beforePing := clock.Now()
	resp, err := md.getClient().Ping2(ctx)
	if err == context.DeadlineExceeded {
		if md.getIsAuthenticated() {
			md.log.CDebugf(ctx, "Ping timeout -- reinitializing connection")
			if err = md.reconnect(); err != nil {
				md.log.CDebugf(ctx, "reconnect error: %v", err)
			}
		} else {
			md.log.CDebugf(ctx, "Ping timeout but not reinitializing")
		}
		return
	} else if err != nil {
		md.log.CDebugf(ctx, "MDServerRemote: ping error %s", err)
		return
	}
	afterPing := clock.Now()
	pingLatency := afterPing.Sub(beforePing)
	if md.serverOffset > 0 && pingLatency > 5*time.Second {
		md.log.CDebugf(ctx, "Ignoring large ping time: %s",
			pingLatency)
		return
	}

	serverTimeNow :=
		keybase1.FromTime(resp.Timestamp).Add(pingLatency / 2)
	func() {
		md.serverOffsetMu.Lock()
		defer md.serverOffsetMu.Unlock()
		// Estimate the server offset, assuming a balanced
		// round trip latency (and 0 server processing
		// latency).  Calculate it so that it can be added
		// to a server timestamp in order to get the local
		// time of a server-timestamped event.
		md.serverOffset = afterPing.Sub(serverTimeNow)
		md.serverOffsetKnown = true
	}()
}

// OnConnectError implements the ConnectionHandler interface.
func (md *MDServerRemote) OnConnectError(err error, wait time.Duration) {
	md.log.CWarningf(context.TODO(),
		"MDServerRemote: connection error: %q; retrying in %s", err, wait)
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
	md.cancelObservers()
	md.pinger.cancelTicker()
	if md.authToken != nil {
		md.authToken.Shutdown()
	}

	md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, err)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (md *MDServerRemote) OnDoCommandError(err error, wait time.Duration) {
	md.log.CWarningf(context.TODO(),
		"MDServerRemote: DoCommand error: %q; retrying in %s", err, wait)
	// Only push errors that should not be retried as connection status changes.
	if !md.ShouldRetry("", err) {
		md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, err)
	}
}

// OnDisconnected implements the ConnectionHandler interface.
func (md *MDServerRemote) OnDisconnected(ctx context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		md.log.CWarningf(ctx, "MDServerRemote is disconnected")
		md.config.Reporter().Notify(ctx,
			connectionNotification(connectionStatusDisconnected))
	}

	func() {
		md.serverOffsetMu.Lock()
		defer md.serverOffsetMu.Unlock()
		md.serverOffsetKnown = false
		md.serverOffset = 0
	}()

	md.setIsAuthenticated(false)

	md.cancelObservers()
	md.pinger.cancelTicker()
	if md.authToken != nil {
		md.authToken.Shutdown()
	}
	md.config.RekeyQueue().Shutdown()
	md.config.SetRekeyQueue(NewRekeyQueueStandard(md.config))
	// Reset the timer since we will get folders for rekey again on
	// the re-connect.
	md.resetRekeyTimer()

	if status == rpc.StartingNonFirstConnection {
		md.config.KBFSOps().PushConnectionStatusChange(MDServiceName, errDisconnected{})
	}
}

// ShouldRetry implements the ConnectionHandler interface.
func (md *MDServerRemote) ShouldRetry(name string, err error) bool {
	_, shouldThrottle := err.(kbfsmd.ServerErrorThrottle)
	return shouldThrottle
}

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (md *MDServerRemote) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
}

// CheckReachability implements the MDServer interface.
func (md *MDServerRemote) CheckReachability(ctx context.Context) {
	conn, err := net.DialTimeout("tcp",
		// The peeked address is the top choice in most cases.
		md.mdSrvRemote.Peek(), MdServerPingTimeout)
	if err != nil {
		if md.getIsAuthenticated() {
			md.log.CDebugf(ctx, "MDServerRemote: CheckReachability(): "+
				"failed to connect, reconnecting: %s", err.Error())
			if err = md.reconnect(); err != nil {
				md.log.CDebugf(ctx, "reconnect error: %v", err)
			}
		} else {
			md.log.CDebugf(ctx, "MDServerRemote: CheckReachability(): "+
				"failed to connect (%s), but not reconnecting", err.Error())
		}
	}
	if conn != nil {
		conn.Close()
	}
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

// CancelRegistration implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) CancelRegistration(ctx context.Context, id tlf.ID) {
	md.observerMu.Lock()
	defer md.observerMu.Unlock()
	observerChan, ok := md.observers[id]
	if !ok {
		// not registered
		return
	}

	// signal that we've seen the update
	md.signalObserverLocked(
		observerChan, id, errors.New("Registration canceled"))
	// Setting nil here indicates that the remote MD server thinks
	// we're still registered, though locally no one is listening.
	md.observers[id] = nil
}

// Signal an observer. The observer lock must be held.
func (md *MDServerRemote) signalObserverLocked(observerChan chan<- error, id tlf.ID, err error) {
	if observerChan != nil {
		observerChan <- err
		close(observerChan)
	}
	delete(md.observers, id)
}

// Helper used to retrieve metadata blocks from the MD server.
func (md *MDServerRemote) get(ctx context.Context, arg keybase1.GetMetadataArg) (
	tlfID tlf.ID, rmdses []*RootMetadataSigned, err error) {
	// request
	response, err := md.getClient().GetMetadata(ctx, arg)
	if err != nil {
		return tlf.ID{}, nil, err
	}

	// response
	tlfID, err = tlf.ParseID(response.FolderID)
	if err != nil {
		return tlf.ID{}, nil, err
	}

	// deserialize blocks
	rmdses = make([]*RootMetadataSigned, len(response.MdBlocks))
	for i, block := range response.MdBlocks {
		ver, max := kbfsmd.MetadataVer(block.Version), md.config.MetadataVersion()
		rmds, err := DecodeRootMetadataSigned(
			md.config.Codec(), tlfID, ver, max, block.Block,
			keybase1.FromTime(block.Timestamp))
		if err != nil {
			return tlf.ID{}, nil, err
		}
		rmdses[i] = rmds
	}
	return tlfID, rmdses, nil
}

// GetForHandle implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetForHandle(ctx context.Context,
	handle tlf.Handle, mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (
	tlfID tlf.ID, rmds *RootMetadataSigned, err error) {
	ctx = rpc.WithFireNow(ctx)
	// TODO: Ideally, *tlf.Handle would have a nicer String() function.
	md.log.LazyTrace(ctx, "MDServer: GetForHandle %+v %s", handle, mStatus)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: GetForHandle %+v %s done (err=%v)", handle, mStatus, err)
	}()

	encodedHandle, err := md.config.Codec().Encode(handle)
	if err != nil {
		return tlf.ID{}, nil, err
	}
	// kbfsmd.BranchID needs to be present when Unmerged is true;
	// kbfsmd.NullBranchID signals that the folder's current branch ID
	// should be looked up.
	arg := keybase1.GetMetadataArg{
		FolderHandle:  encodedHandle,
		BranchID:      kbfsmd.NullBranchID.String(),
		Unmerged:      mStatus == kbfsmd.Unmerged,
		LockBeforeGet: lockBeforeGet,
	}

	id, rmdses, err := md.get(ctx, arg)
	if err != nil {
		return tlf.ID{}, nil, err
	}
	if len(rmdses) == 0 {
		return id, nil, nil
	}
	// TODO: Error if server returns more than one rmds.
	return id, rmdses[0], nil
}

// GetForTLF implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetForTLF(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (rmds *RootMetadataSigned, err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: GetForTLF %s %s %s", id, bid, mStatus)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: GetForTLF %s %s %s done (err=%v)", id, bid, mStatus, err)
	}()

	arg := keybase1.GetMetadataArg{
		FolderID:      id.String(),
		BranchID:      bid.String(),
		Unmerged:      mStatus == kbfsmd.Unmerged,
		LockBeforeGet: lockBeforeGet,
	}

	_, rmdses, err := md.get(ctx, arg)
	if err != nil {
		return nil, err
	}
	if len(rmdses) == 0 {
		return nil, nil
	}
	// TODO: Error if server returns more than one rmds.
	return rmdses[0], nil
}

// GetRange implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetRange(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, start, stop kbfsmd.Revision,
	lockBeforeGet *keybase1.LockID) (rmdses []*RootMetadataSigned, err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: GetRange %s %s %s %d-%d", id, bid, mStatus, start, stop)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: GetRange %s %s %s %d-%d done (err=%v)", id, bid, mStatus, start, stop, err)
	}()

	arg := keybase1.GetMetadataArg{
		FolderID:      id.String(),
		BranchID:      bid.String(),
		Unmerged:      mStatus == kbfsmd.Unmerged,
		StartRevision: start.Number(),
		StopRevision:  stop.Number(),
		LockBeforeGet: lockBeforeGet,
	}

	_, rmds, err := md.get(ctx, arg)
	return rmds, err
}

// Put implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) Put(ctx context.Context, rmds *RootMetadataSigned,
	extra kbfsmd.ExtraMetadata, lockContext *keybase1.LockContext,
	priority keybase1.MDPriority) (err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: Put %s %d", rmds.MD.TlfID(), rmds.MD.RevisionNumber())
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: Put %s %d done (err=%v)", rmds.MD.TlfID(), rmds.MD.RevisionNumber(), err)
	}()

	// encode MD block
	rmdsBytes, err := kbfsmd.EncodeRootMetadataSigned(md.config.Codec(), &rmds.RootMetadataSigned)
	if err != nil {
		return err
	}

	// put request
	arg := keybase1.PutMetadataArg{
		MdBlock: keybase1.MDBlock{
			Version: int(rmds.Version()),
			Block:   rmdsBytes,
		},
		LogTags:  nil,
		Priority: priority,
	}
	if lockContext != nil {
		copied := *lockContext
		arg.LockContext = &copied
	}

	if rmds.Version() < kbfsmd.SegregatedKeyBundlesVer {
		if extra != nil {
			return fmt.Errorf("Unexpected non-nil extra: %+v", extra)
		}
	} else if extra != nil {
		// For now, if we have a non-nil extra, it must be
		// *ExtraMetadataV3, but in the future it might be
		// some other type (e.g., *ExtraMetadataV4).
		extraV3, ok := extra.(*kbfsmd.ExtraMetadataV3)
		if !ok {
			return fmt.Errorf("Extra of unexpected type %T", extra)
		}

		// Add any new key bundles.
		if extraV3.IsWriterKeyBundleNew() {
			wkbBytes, err := md.config.Codec().Encode(extraV3.GetWriterKeyBundle())
			if err != nil {
				return err
			}
			arg.WriterKeyBundle = keybase1.KeyBundle{
				Version: int(rmds.Version()),
				Bundle:  wkbBytes,
			}
		}
		if extraV3.IsReaderKeyBundleNew() {
			rkbBytes, err := md.config.Codec().Encode(extraV3.GetReaderKeyBundle())
			if err != nil {
				return err
			}
			arg.ReaderKeyBundle = keybase1.KeyBundle{
				Version: int(rmds.Version()),
				Bundle:  rkbBytes,
			}
		}
	}

	return md.getClient().PutMetadata(ctx, arg)
}

// Lock implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) Lock(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) error {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: Lock %s %s", tlfID, lockID)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: Lock %s %s", tlfID, lockID)
	}()
	return md.getClient().Lock(ctx, keybase1.LockArg{
		FolderID: tlfID.String(),
		LockID:   lockID,
	})
}

// ReleaseLock implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) ReleaseLock(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) error {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: ReleaseLock %s %s", tlfID, lockID)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: ReleaseLock %s %s", tlfID, lockID)
	}()
	return md.getClient().ReleaseLock(ctx, keybase1.ReleaseLockArg{
		FolderID: tlfID.String(),
		LockID:   lockID,
	})
}

// PruneBranch implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) PruneBranch(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) (err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: PruneBranch %s %s", id, bid)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: PruneBranch %s %s (err=%v)", id, bid, err)
	}()

	arg := keybase1.PruneBranchArg{
		FolderID: id.String(),
		BranchID: bid.String(),
		LogTags:  nil,
	}
	return md.getClient().PruneBranch(ctx, arg)
}

// MetadataUpdate implements the MetadataUpdateProtocol interface.
func (md *MDServerRemote) MetadataUpdate(_ context.Context, arg keybase1.MetadataUpdateArg) error {
	id, err := tlf.ParseID(arg.FolderID)
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

// FoldersNeedRekey implements the MetadataUpdateProtocol interface.
func (md *MDServerRemote) FoldersNeedRekey(ctx context.Context,
	requests []keybase1.RekeyRequest) error {
	if md.squelchRekey {
		md.log.CDebugf(ctx, "MDServerRemote: rekey updates squelched for testing")
		return nil
	}
	for _, req := range requests {
		id, err := tlf.ParseID(req.FolderID)
		if err != nil {
			return err
		}
		md.log.CDebugf(ctx, "MDServerRemote: folder needs rekey: %s", id.String())
		// queue the folder for rekeying
		md.config.RekeyQueue().Enqueue(id)
	}
	// Reset the timer in case there are a lot of rekey folders
	// dribbling in from the server still.
	md.resetRekeyTimer()
	return nil
}

// FolderNeedsRekey implements the MetadataUpdateProtocol interface.
func (md *MDServerRemote) FolderNeedsRekey(ctx context.Context,
	arg keybase1.FolderNeedsRekeyArg) error {
	id, err := tlf.ParseID(arg.FolderID)
	if err != nil {
		return err
	}
	md.log.CDebugf(ctx, "MDServerRemote: folder needs rekey: %s", id.String())
	if md.squelchRekey {
		md.log.CDebugf(ctx, "MDServerRemote: rekey updates squelched for testing")
		return nil
	}
	// queue the folder for rekeying
	md.config.RekeyQueue().Enqueue(id)
	// Reset the timer in case there are a lot of rekey folders
	// dribbling in from the server still.
	md.resetRekeyTimer()
	return nil
}

func (md *MDServerRemote) getConn() *rpc.Connection {
	md.connMu.RLock()
	defer md.connMu.RUnlock()
	return md.conn
}

// RegisterForUpdate implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) RegisterForUpdate(ctx context.Context, id tlf.ID,
	currHead kbfsmd.Revision) (<-chan error, error) {
	arg := keybase1.RegisterForUpdatesArg{
		FolderID:     id.String(),
		CurrRevision: currHead.Number(),
		LogTags:      nil,
	}

	// register
	var c chan error
	conn := md.getConn()
	err := conn.DoCommand(ctx, "register", func(rawClient rpc.GenericClient) error {
		// set up the server to receive updates, since we may
		// get disconnected between retries.
		server := conn.GetServer()
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
		alreadyRegistered := func() bool {
			md.observerMu.Lock()
			defer md.observerMu.Unlock()
			// It's possible for a nil channel to be in
			// `md.observers`, if we are still registered with the
			// server after a previous cancellation.
			existingCh, alreadyRegistered := md.observers[id]
			if existingCh != nil {
				panic(fmt.Sprintf(
					"Attempted double-registration for folder: %s", id))
			}
			c = make(chan error, 1)
			md.observers[id] = c
			return alreadyRegistered
		}()
		if alreadyRegistered {
			return nil
		}
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
func (md *MDServerRemote) TruncateLock(ctx context.Context, id tlf.ID) (
	locked bool, err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: TruncateLock %s", id)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: TruncateLock %s (err=%v)", id, err)
	}()
	return md.getClient().TruncateLock(ctx, id.String())
}

// TruncateUnlock implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) TruncateUnlock(ctx context.Context, id tlf.ID) (
	unlocked bool, err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: TruncateUnlock %s", id)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: TruncateUnlock %s (err=%v)", id, err)
	}()
	return md.getClient().TruncateUnlock(ctx, id.String())
}

// GetLatestHandleForTLF implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetLatestHandleForTLF(ctx context.Context, id tlf.ID) (
	handle tlf.Handle, err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "MDServer: GetLatestHandle %s", id)
	defer func() {
		md.deferLog.LazyTrace(ctx, "MDServer: GetLatestHandle %s (err=%v)", id, err)
	}()
	buf, err := md.getClient().GetLatestFolderHandle(ctx, id.String())
	if err != nil {
		return tlf.Handle{}, err
	}
	if err := md.config.Codec().Decode(buf, &handle); err != nil {
		return tlf.Handle{}, err
	}
	return handle, nil
}

// OffsetFromServerTime implements the MDServer interface for
// MDServerRemote.
func (md *MDServerRemote) OffsetFromServerTime() (time.Duration, bool) {
	md.serverOffsetMu.RLock()
	defer md.serverOffsetMu.RUnlock()
	return md.serverOffset, md.serverOffsetKnown
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
	if md.config.Mode() == InitSingleOp {
		c <- nil
		return c
	}

	time.AfterFunc(5*time.Second, func() {
		md.log.CInfof(ctx, "CheckForRekeys: checking for rekeys")
		select {
		case <-ctx.Done():
			c <- ctx.Err()
		default:
		}
		if err := md.getFoldersForRekey(ctx, md.getClient()); err != nil {
			md.log.CDebugf(ctx, "getFoldersForRekey failed during "+
				"CheckForRekeys: %v", err)
			c <- err
		}
		md.resetRekeyTimer()
		c <- nil
	})
	return c
}

// getFoldersForRekey registers to receive updates about folders needing rekey actions.
func (md *MDServerRemote) getFoldersForRekey(ctx context.Context,
	client keybase1.MetadataClient) error {
	// get this device's crypt public key
	session, err := md.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	return client.GetFoldersForRekey(ctx, session.CryptPublicKey.KID())
}

// Shutdown implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) Shutdown() {
	md.connMu.Lock()
	defer md.connMu.Unlock()

	// close the connection
	md.conn.Shutdown()
	// cancel pending observers
	md.cancelObservers()
	// cancel the ping ticker
	md.pinger.cancelTicker()
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
	conn := md.getConn()
	return conn != nil && conn.IsConnected()
}

//
// The below methods support the MD server acting as the key server.
// This will be the case for v1 of KBFS but we may move to our own
// separate key server at some point.
//

// GetTLFCryptKeyServerHalf is an implementation of the KeyServer interface.
func (md *MDServerRemote) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID kbfscrypto.TLFCryptKeyServerHalfID,
	cryptKey kbfscrypto.CryptPublicKey) (
	serverHalf kbfscrypto.TLFCryptKeyServerHalf, err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "KeyServer: GetTLFCryptKeyServerHalf %s", serverHalfID)
	defer func() {
		md.deferLog.LazyTrace(ctx, "KeyServer: GetTLFCryptKeyServerHalf %s (err=%v)", serverHalfID, err)
	}()

	// encode the ID
	idBytes, err := md.config.Codec().Encode(serverHalfID)
	if err != nil {
		return
	}

	// get the key
	arg := keybase1.GetKeyArg{
		KeyHalfID: idBytes,
		DeviceKID: cryptKey.KID().String(),
		LogTags:   nil,
	}
	keyBytes, err := md.getClient().GetKey(ctx, arg)
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
	keyServerHalves kbfsmd.UserDeviceKeyServerHalves) (err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "KeyServer: PutTLFCryptKeyServerHalves %v", keyServerHalves)
	defer func() {
		md.deferLog.LazyTrace(ctx, "KeyServer: PutTLFCryptKeyServerHalves %v (err=%v)", keyServerHalves, err)
	}()

	// flatten out the map into an array
	var keyHalves []keybase1.KeyHalf
	for user, deviceMap := range keyServerHalves {
		for devicePubKey, serverHalf := range deviceMap {
			keyHalf, err := md.config.Codec().Encode(serverHalf)
			if err != nil {
				return err
			}
			keyHalves = append(keyHalves,
				keybase1.KeyHalf{
					User:      user,
					DeviceKID: devicePubKey.KID(),
					Key:       keyHalf,
				})
		}
	}
	// put the keys
	arg := keybase1.PutKeysArg{
		KeyHalves: keyHalves,
		LogTags:   nil,
	}
	return md.getClient().PutKeys(ctx, arg)
}

// DeleteTLFCryptKeyServerHalf is an implementation of the KeyServer interface.
func (md *MDServerRemote) DeleteTLFCryptKeyServerHalf(ctx context.Context,
	uid keybase1.UID, key kbfscrypto.CryptPublicKey,
	serverHalfID kbfscrypto.TLFCryptKeyServerHalfID) (err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "KeyServer: DeleteTLFCryptKeyServerHalf %s %s", uid, serverHalfID)
	defer func() {
		md.deferLog.LazyTrace(ctx, "KeyServer: DeleteTLFCryptKeyServerHalf %s %s done (err=%v)", uid, serverHalfID, err)
	}()

	// encode the ID
	idBytes, err := md.config.Codec().Encode(serverHalfID)
	if err != nil {
		return err
	}

	// get the key
	arg := keybase1.DeleteKeyArg{
		Uid:       uid,
		DeviceKID: key.KID(),
		KeyHalfID: idBytes,
		LogTags:   nil,
	}
	err = md.getClient().DeleteKey(ctx, arg)
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
			if !md.getConn().IsConnected() {
				md.resetRekeyTimer()
				continue
			}

			// Assign an ID to this rekey check so we can track it.
			newCtx := CtxWithRandomIDReplayable(ctx, CtxMDSRIDKey, CtxMDSROpID, md.log)
			md.log.CDebugf(newCtx, "Checking for rekey folders")
			if err := md.getFoldersForRekey(
				newCtx, md.getClient()); err != nil {
				md.log.CWarningf(newCtx, "MDServerRemote: getFoldersForRekey "+
					"failed with %v", err)
			}
			md.resetRekeyTimer()
		case <-ctx.Done():
			return
		}
	}
}

// GetKeyBundles implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetKeyBundles(ctx context.Context,
	tlf tlf.ID, wkbID kbfsmd.TLFWriterKeyBundleID, rkbID kbfsmd.TLFReaderKeyBundleID) (
	wkb *kbfsmd.TLFWriterKeyBundleV3, rkb *kbfsmd.TLFReaderKeyBundleV3, err error) {
	ctx = rpc.WithFireNow(ctx)
	md.log.LazyTrace(ctx, "KeyServer: GetKeyBundles %s %s %s", tlf, wkbID, rkbID)
	defer func() {
		md.deferLog.LazyTrace(ctx, "KeyServer: GetKeyBundles %s %s %s done (err=%v)", tlf, wkbID, rkbID, err)
	}()

	arg := keybase1.GetKeyBundlesArg{
		FolderID:       tlf.String(),
		WriterBundleID: wkbID.String(),
		ReaderBundleID: rkbID.String(),
	}

	response, err := md.getClient().GetKeyBundles(ctx, arg)
	if err != nil {
		return nil, nil, err
	}

	if response.WriterBundle.Bundle != nil {
		if response.WriterBundle.Version != int(kbfsmd.SegregatedKeyBundlesVer) {
			err = fmt.Errorf("Unsupported writer bundle version: %d",
				response.WriterBundle.Version)
			return nil, nil, err
		}
		wkb = new(kbfsmd.TLFWriterKeyBundleV3)
		err = md.config.Codec().Decode(response.WriterBundle.Bundle, wkb)
		if err != nil {
			return nil, nil, err
		}
		// Verify it's what we expect.
		bundleID, err := kbfsmd.MakeTLFWriterKeyBundleID(md.config.Codec(), *wkb)
		if err != nil {
			return nil, nil, err
		}
		if bundleID != wkbID {
			err = fmt.Errorf("Expected writer bundle ID %s, got: %s",
				wkbID, bundleID)
			return nil, nil, err
		}
	}

	if response.ReaderBundle.Bundle != nil {
		if response.ReaderBundle.Version != int(kbfsmd.SegregatedKeyBundlesVer) {
			err = fmt.Errorf("Unsupported reader bundle version: %d",
				response.ReaderBundle.Version)
			return nil, nil, err
		}
		rkb = new(kbfsmd.TLFReaderKeyBundleV3)
		err = md.config.Codec().Decode(response.ReaderBundle.Bundle, rkb)
		if err != nil {
			return nil, nil, err
		}
		// Verify it's what we expect.
		bundleID, err := kbfsmd.MakeTLFReaderKeyBundleID(md.config.Codec(), *rkb)
		if err != nil {
			return nil, nil, err
		}
		if bundleID != rkbID {
			err = fmt.Errorf("Expected reader bundle ID %s, got: %s",
				rkbID, bundleID)
			return nil, nil, err
		}
	}

	return wkb, rkb, nil
}

// FastForwardBackoff implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) FastForwardBackoff() {
	md.connMu.RLock()
	defer md.connMu.RUnlock()
	md.conn.FastForwardInitialBackoffTimer()
}

func (md *MDServerRemote) resetRekeyTimer() {
	md.rekeyTimer.Reset(nextRekeyTime())
}

// nextRekeyTime returns the time remaining to the next rekey.
// The time returned is random with the formula:
// MdServerBackgroundRekeyPeriod/2 + (k * (MdServerBackgroundRekeyPeriod/n))
// average: MdServerBackgroundRekeyPeriod
// minimum: MdServerBackgroundRekeyPeriod/2
// maximum: MdServerBackgroundRekeyPeriod*1.5
// k=0..n, random uniformly distributed.
func nextRekeyTime() time.Duration {
	var buf [1]byte
	err := kbfscrypto.RandRead(buf[:])
	if err != nil {
		panic("nextRekeyTime: Random source broken!")
	}
	return (MdServerBackgroundRekeyPeriod / 2) +
		(time.Duration(buf[0]) * (MdServerBackgroundRekeyPeriod / 0xFF))
}
