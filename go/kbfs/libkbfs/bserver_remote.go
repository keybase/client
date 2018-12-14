// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

const (
	// BServerDefaultPingIntervalSeconds is the default interval on which the
	// client should contact the block server.
	BServerDefaultPingIntervalSeconds = 10
	// BServerPingTimeout is how long to wait for a ping response
	// before breaking the connection and trying to reconnect.
	BServerPingTimeout = 30 * time.Second
)

// blockServerRemoteAuthTokenRefresher is a helper struct for
// refreshing auth tokens and managing connections.
type blockServerRemoteClientHandler struct {
	name          string
	log           logger.Logger
	deferLog      logger.Logger
	csg           CurrentSessionGetter
	authToken     *kbfscrypto.AuthToken
	srvRemote     rpc.Remote
	connOpts      rpc.ConnectionOpts
	rpcLogFactory rpc.LogFactory
	pinger        pinger

	connMu sync.RWMutex
	conn   *rpc.Connection
	client keybase1.BlockInterface
}

func newBlockServerRemoteClientHandler(name string, log logger.Logger,
	signer kbfscrypto.Signer, csg CurrentSessionGetter, srvRemote rpc.Remote,
	rpcLogFactory rpc.LogFactory) *blockServerRemoteClientHandler {
	deferLog := log.CloneWithAddedDepth(1)
	b := &blockServerRemoteClientHandler{
		name:          name,
		log:           log,
		deferLog:      deferLog,
		csg:           csg,
		srvRemote:     srvRemote,
		rpcLogFactory: rpcLogFactory,
	}

	b.pinger = pinger{
		name:    name,
		doPing:  b.pingOnce,
		timeout: BServerPingTimeout,
		log:     log,
	}

	b.authToken = kbfscrypto.NewAuthToken(
		signer, kbfsblock.ServerTokenServer, kbfsblock.ServerTokenExpireIn,
		"libkbfs_bserver_remote", VersionString(), b)

	constBackoff := backoff.NewConstantBackOff(RPCReconnectInterval)
	b.connOpts = rpc.ConnectionOpts{
		DontConnectNow:                true, // connect only on-demand
		WrapErrorFunc:                 libkb.WrapError,
		TagsFunc:                      libkb.LogTagsFromContext,
		ReconnectBackoff:              func() backoff.BackOff { return constBackoff },
		DialerTimeout:                 dialerTimeout,
		InitialReconnectBackoffWindow: func() time.Duration { return bserverReconnectBackoffWindow },
	}
	b.initNewConnection()
	return b
}

func (b *blockServerRemoteClientHandler) initNewConnection() {
	b.connMu.Lock()
	defer b.connMu.Unlock()

	if b.conn != nil {
		b.conn.Shutdown()
	}

	b.conn = rpc.NewTLSConnection(
		b.srvRemote, kbfscrypto.GetRootCerts(
			b.srvRemote.Peek(), libkb.GetBundledCAsFromHost),
		kbfsblock.ServerErrorUnwrapper{}, b, b.rpcLogFactory,
		logger.LogOutputWithDepthAdder{Logger: b.log},
		rpc.DefaultMaxFrameLength, b.connOpts)
	b.client = keybase1.BlockClient{Cli: b.conn.GetClient()}
}

func (b *blockServerRemoteClientHandler) reconnect() error {
	b.connMu.Lock()
	defer b.connMu.Unlock()

	if b.conn != nil {
		ctx, cancel := context.WithTimeout(
			context.Background(), reconnectTimeout)
		defer cancel()
		return b.conn.ForceReconnect(ctx)
	}

	b.initNewConnection()
	return nil

}

func (b *blockServerRemoteClientHandler) shutdown() {
	if b.authToken != nil {
		b.authToken.Shutdown()
	}

	b.connMu.Lock()
	defer b.connMu.Unlock()

	if b.conn != nil {
		b.conn.Shutdown()
	}

	// cancel the ping ticker
	b.pinger.cancelTicker()
}

func (b *blockServerRemoteClientHandler) getConn() *rpc.Connection {
	b.connMu.RLock()
	defer b.connMu.RUnlock()
	return b.conn
}

func (b *blockServerRemoteClientHandler) getClient() keybase1.BlockInterface {
	b.connMu.RLock()
	defer b.connMu.RUnlock()
	return b.client
}

type ctxBServerResetKeyType int

const (
	// ctxBServerResetKey identifies whether the current context has
	// already passed through `BServerRemote.resetAuth`.
	ctxBServerResetKey ctxBServerResetKeyType = iota
)

// resetAuth is called to reset the authorization on a BlockServer
// connection.
func (b *blockServerRemoteClientHandler) resetAuth(
	ctx context.Context, c keybase1.BlockInterface) (err error) {
	ctx = context.WithValue(ctx, ctxBServerResetKey, b.name)

	defer func() {
		b.deferLog.CDebugf(
			ctx, "BlockServerRemote: resetAuth called, err: %#v", err)
	}()

	session, err := b.csg.GetCurrentSession(ctx)
	if err != nil {
		b.log.CDebugf(
			ctx, "%s: User logged out, skipping resetAuth", b.name)
		return nil
	}

	// request a challenge
	challenge, err := c.GetSessionChallenge(ctx)
	if err != nil {
		return err
	}

	// get a new signature
	signature, err := b.authToken.Sign(ctx, session.Name,
		session.UID, session.VerifyingKey, challenge)
	if err != nil {
		return err
	}

	return c.AuthenticateSession(ctx, signature)
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (b *blockServerRemoteClientHandler) RefreshAuthToken(
	ctx context.Context) {
	if v := ctx.Value(ctxBServerResetKey); v == b.name {
		b.log.CDebugf(ctx, "Avoiding resetAuth recursion")
		return
	}

	if err := b.resetAuth(ctx, b.client); err != nil {
		b.log.CDebugf(ctx, "%s: error refreshing auth token: %v", b.name, err)
	}
}

var _ kbfscrypto.AuthTokenRefreshHandler = (*blockServerRemoteClientHandler)(nil)

// HandlerName implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) HandlerName() string {
	return b.name
}

// OnConnect implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) OnConnect(ctx context.Context,
	conn *rpc.Connection, client rpc.GenericClient, _ *rpc.Server) error {
	// reset auth -- using client here would cause problematic recursion.
	c := keybase1.BlockClient{Cli: client}
	err := b.resetAuth(ctx, c)
	if err != nil {
		return err
	}

	// Start pinging.
	b.pinger.resetTicker(BServerDefaultPingIntervalSeconds)
	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) OnConnectError(err error, wait time.Duration) {
	b.log.Warning("%s: connection error: %v; retrying in %s", b.name, err, wait)
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
	b.pinger.cancelTicker()
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
}

// OnDoCommandError implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) OnDoCommandError(err error, wait time.Duration) {
	b.log.Warning("%s: DoCommand error: %v; retrying in %s", b.name, err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) OnDisconnected(ctx context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		b.log.CWarningf(ctx, "%s: disconnected", b.name)
	}
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
	b.pinger.cancelTicker()
}

// ShouldRetry implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) ShouldRetry(rpcName string, err error) bool {
	// Do not let connection.go's DoCommand retry any batch rpcs
	// since batchDowngradeReferences already handles retries.
	switch rpcName {
	case "keybase.1.block.delReferenceWithCount":
		return false
	case "keybase.1.block.archiveReferenceWithCount":
		return false
	}
	return kbfsblock.IsThrottleError(err)
}

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
}

var _ rpc.ConnectionHandler = (*blockServerRemoteClientHandler)(nil)

func (b *blockServerRemoteClientHandler) pingOnce(ctx context.Context) {
	_, err := b.getClient().BlockPing(ctx)
	if err == context.DeadlineExceeded {
		b.log.CDebugf(
			ctx, "%s: Ping timeout -- reinitializing connection", b.name)
		if err = b.reconnect(); err != nil {
			b.log.CDebugf(ctx, "reconnect error: %v", err)
		}
	} else if err != nil {
		b.log.CDebugf(ctx, "%s: ping error %s", b.name, err)
	}
}

type blockServerRemoteConfig interface {
	diskBlockCacheGetter
	codecGetter
	signerGetter
	currentSessionGetterGetter
	logMaker
}

// BlockServerRemote implements the BlockServer interface and
// represents a remote KBFS block server.
type BlockServerRemote struct {
	config       blockServerRemoteConfig
	shutdownFn   func()
	log          traceLogger
	deferLog     traceLogger
	blkSrvRemote rpc.Remote

	putConn *blockServerRemoteClientHandler
	getConn *blockServerRemoteClientHandler
}

// Test that BlockServerRemote fully implements the BlockServer interface.
var _ BlockServer = (*BlockServerRemote)(nil)

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(config blockServerRemoteConfig,
	blkSrvRemote rpc.Remote, rpcLogFactory rpc.LogFactory) *BlockServerRemote {
	log := config.MakeLogger("BSR")
	deferLog := log.CloneWithAddedDepth(1)
	bs := &BlockServerRemote{
		config:       config,
		log:          traceLogger{log},
		deferLog:     traceLogger{deferLog},
		blkSrvRemote: blkSrvRemote,
	}
	// Use two separate auth clients -- one for writes and one for
	// reads.  This allows small reads to avoid getting trapped behind
	// large asynchronous writes.  TODO: use some real network QoS to
	// achieve better prioritization within the actual network.
	bs.putConn = newBlockServerRemoteClientHandler(
		"BlockServerRemotePut", log, config.Signer(),
		config.CurrentSessionGetter(), blkSrvRemote, rpcLogFactory)
	bs.getConn = newBlockServerRemoteClientHandler(
		"BlockServerRemoteGet", log, config.Signer(),
		config.CurrentSessionGetter(), blkSrvRemote, rpcLogFactory)

	bs.shutdownFn = func() {
		bs.putConn.shutdown()
		bs.getConn.shutdown()
	}
	return bs
}

// For testing.
func newBlockServerRemoteWithClient(config blockServerRemoteConfig,
	client keybase1.BlockInterface) *BlockServerRemote {
	log := config.MakeLogger("BSR")
	deferLog := log.CloneWithAddedDepth(1)
	bs := &BlockServerRemote{
		config:   config,
		log:      traceLogger{log},
		deferLog: traceLogger{deferLog},
		putConn: &blockServerRemoteClientHandler{
			log:      log,
			deferLog: deferLog,
			client:   client,
		},
		getConn: &blockServerRemoteClientHandler{
			log:      log,
			deferLog: deferLog,
			client:   client,
		},
	}
	return bs
}

// RemoteAddress returns the remote bserver this client is talking to
func (b *BlockServerRemote) RemoteAddress() string {
	return b.blkSrvRemote.String()
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (b *BlockServerRemote) RefreshAuthToken(ctx context.Context) {
	b.putConn.RefreshAuthToken(ctx)
	b.getConn.RefreshAuthToken(ctx)
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context, cacheType DiskBlockCacheType) (
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	ctx = rpc.WithFireNow(ctx)
	var res keybase1.GetBlockRes
	b.log.LazyTrace(ctx, "BServer: Get %s", id)

	// Once the block has been retrieved, cache it.
	defer func() {
		b.log.LazyTrace(ctx, "BServer: Get %s done (err=%v)", id, err)
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "Get id=%s tlf=%s context=%s sz=%d err=%v",
				id, tlfID, context, len(buf), err)
		} else {
			// But don't cache it if it's archived data.
			if res.Status == keybase1.BlockStatus_ARCHIVED {
				return
			}

			b.deferLog.CDebugf(
				ctx, "Get id=%s tlf=%s context=%s sz=%d",
				id, tlfID, context, len(buf))
			dbc := b.config.DiskBlockCache()
			if dbc != nil {
				// This used to be called in a goroutine to prevent blocking
				// the `Get`. But we need this cached synchronously so prefetch
				// operations can work correctly.
				dbc.Put(ctx, tlfID, id, buf, serverHalf, cacheType)
			}
		}
	}()

	arg := kbfsblock.MakeGetBlockArg(tlfID, id, context)
	res, err = b.getConn.getClient().GetBlock(ctx, arg)
	return kbfsblock.ParseGetBlockRes(res, err)
}

// GetEncodedSize implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) GetEncodedSize(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context) (
	size uint32, status keybase1.BlockStatus, err error) {
	ctx = rpc.WithFireNow(ctx)
	b.log.LazyTrace(ctx, "BServer: GetEncodedSize %s", id)
	defer func() {
		b.log.LazyTrace(
			ctx, "BServer: GetEncodedSize %s done (err=%v)", id, err)
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "GetEncodedSize id=%s tlf=%s context=%s err=%v",
				id, tlfID, context, err)
		} else {
			b.deferLog.CDebugf(
				ctx, "GetEncodedSize id=%s tlf=%s context=%s sz=%d status=%s",
				id, tlfID, context, size, status)
		}
	}()

	arg := kbfsblock.MakeGetBlockArg(tlfID, id, context)
	arg.SizeOnly = true
	res, err := b.getConn.getClient().GetBlock(ctx, arg)
	if err != nil {
		return 0, 0, nil
	}
	return uint32(res.Size), res.Status, nil
}

// Put implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Put(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	bContext kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	cacheType DiskBlockCacheType) (err error) {
	ctx = rpc.WithFireNow(ctx)
	dbc := b.config.DiskBlockCache()
	if dbc != nil {
		dbc.Put(ctx, tlfID, id, buf, serverHalf, cacheType)
	}
	size := len(buf)
	b.log.LazyTrace(ctx, "BServer: Put %s", id)
	defer func() {
		b.log.LazyTrace(ctx, "BServer: Put %s done (err=%v)", id, err)
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "Put id=%s tlf=%s context=%s sz=%d err=%v",
				id, tlfID, bContext, size, err)
		} else {
			b.deferLog.CDebugf(
				ctx, "Put id=%s tlf=%s context=%s sz=%d",
				id, tlfID, bContext, size)
		}
	}()

	arg := kbfsblock.MakePutBlockArg(tlfID, id, bContext, buf, serverHalf)
	// Handle OverQuota errors at the caller
	return b.putConn.getClient().PutBlock(ctx, arg)
}

// PutAgain implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) PutAgain(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	bContext kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	cacheType DiskBlockCacheType) (err error) {
	ctx = rpc.WithFireNow(ctx)
	dbc := b.config.DiskBlockCache()
	if dbc != nil {
		dbc.Put(ctx, tlfID, id, buf, serverHalf, cacheType)
	}
	size := len(buf)
	b.log.LazyTrace(ctx, "BServer: Put %s", id)
	defer func() {
		b.log.LazyTrace(ctx, "BServer: Put %s done (err=%v)", id, err)
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "Put id=%s tlf=%s context=%s sz=%d err=%v",
				id, tlfID, bContext, size, err)
		} else {
			b.deferLog.CDebugf(
				ctx, "Put id=%s tlf=%s context=%s sz=%d",
				id, tlfID, bContext, size)
		}
	}()

	arg := kbfsblock.MakePutBlockAgainArg(tlfID, id, bContext, buf, serverHalf)
	// Handle OverQuota errors at the caller
	return b.putConn.getClient().PutBlockAgain(ctx, arg)
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, tlfID tlf.ID,
	id kbfsblock.ID, context kbfsblock.Context) (err error) {
	ctx = rpc.WithFireNow(ctx)
	b.log.LazyTrace(ctx, "BServer: AddRef %s", id)
	defer func() {
		b.log.LazyTrace(ctx, "BServer: AddRef %s done (err=%v)", id, err)
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "AddBlockReference id=%s tlf=%s context=%s err=%v",
				id, tlfID, context, err)
		} else {
			b.deferLog.CDebugf(
				ctx, "AddBlockReference id=%s tlf=%s context=%s",
				id, tlfID, context)
		}
	}()

	arg := kbfsblock.MakeAddReferenceArg(tlfID, id, context)
	// Handle OverQuota errors at the caller
	return b.putConn.getClient().AddReference(ctx, arg)
}

// RemoveBlockReferences implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts kbfsblock.ContextMap) (liveCounts map[kbfsblock.ID]int, err error) {
	ctx = rpc.WithFireNow(ctx)
	// TODO: Define a more compact printout of contexts.
	b.log.LazyTrace(ctx, "BServer: RemRef %v", contexts)
	defer func() {
		b.log.LazyTrace(ctx, "BServer: RemRef %v done (err=%v)", contexts, err)
		if err != nil {
			b.deferLog.CWarningf(ctx, "RemoveBlockReferences batch size=%d err=%v", len(contexts), err)
		} else {
			b.deferLog.CDebugf(ctx, "RemoveBlockReferences batch size=%d", len(contexts))
		}
	}()
	doneRefs, err := kbfsblock.BatchDowngradeReferences(ctx, b.log, tlfID, contexts, false, b.putConn.getClient())
	return kbfsblock.GetLiveCounts(doneRefs), err
}

// ArchiveBlockReferences implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) ArchiveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts kbfsblock.ContextMap) (err error) {
	ctx = rpc.WithFireNow(ctx)
	b.log.LazyTrace(ctx, "BServer: ArchiveRef %v", contexts)
	defer func() {
		b.log.LazyTrace(ctx, "BServer: ArchiveRef %v done (err=%v)", contexts, err)
		if err != nil {
			b.deferLog.CWarningf(ctx, "ArchiveBlockReferences batch size=%d err=%v", len(contexts), err)
		} else {
			b.deferLog.CDebugf(ctx, "ArchiveBlockReferences batch size=%d", len(contexts))
		}
	}()
	_, err = kbfsblock.BatchDowngradeReferences(ctx, b.log, tlfID, contexts, true, b.putConn.getClient())
	return err
}

// IsUnflushed implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) IsUnflushed(
	_ context.Context, _ tlf.ID, _ kbfsblock.ID) (
	bool, error) {
	return false, nil
}

// GetUserQuotaInfo implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) GetUserQuotaInfo(ctx context.Context) (info *kbfsblock.QuotaInfo, err error) {
	ctx = rpc.WithFireNow(ctx)
	b.log.LazyTrace(ctx, "BServer: GetUserQuotaInfo")
	defer func() {
		b.log.LazyTrace(ctx, "BServer: GetUserQuotaInfo done (err=%v)", err)
	}()
	res, err := b.getConn.getClient().GetUserQuotaInfo(ctx)
	return kbfsblock.ParseGetQuotaInfoRes(b.config.Codec(), res, err)
}

// GetTeamQuotaInfo implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) GetTeamQuotaInfo(
	ctx context.Context, tid keybase1.TeamID) (
	info *kbfsblock.QuotaInfo, err error) {
	ctx = rpc.WithFireNow(ctx)
	b.log.LazyTrace(ctx, "BServer: GetTeamQuotaInfo")
	defer func() {
		b.log.LazyTrace(ctx, "BServer: GetTeamQuotaInfo done (err=%v)", err)
	}()
	res, err := b.getConn.getClient().GetTeamQuotaInfo(ctx, tid)
	return kbfsblock.ParseGetQuotaInfoRes(b.config.Codec(), res, err)
}

// Shutdown implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Shutdown(ctx context.Context) {
	if b.shutdownFn != nil {
		b.shutdownFn()
	}
	b.getConn.shutdown()
	b.putConn.shutdown()
}
