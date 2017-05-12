// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
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
	// BServerTokenServer is the expected server type for bserver authentication.
	BServerTokenServer = "kbfs_block"
	// BServerTokenExpireIn is the TTL to use when constructing an authentication token.
	BServerTokenExpireIn = 2 * 60 * 60 // 2 hours
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
	srvAddr       string
	connOpts      rpc.ConnectionOpts
	rpcLogFactory *libkb.RPCLogFactory
	pinger        pinger

	connMu sync.RWMutex
	conn   *rpc.Connection
	client keybase1.BlockInterface
}

func newBlockServerRemoteClientHandler(name string, log logger.Logger,
	signer kbfscrypto.Signer, csg CurrentSessionGetter, srvAddr string,
	rpcLogFactory *libkb.RPCLogFactory) *blockServerRemoteClientHandler {
	deferLog := log.CloneWithAddedDepth(1)
	b := &blockServerRemoteClientHandler{
		name:          name,
		log:           log,
		deferLog:      deferLog,
		csg:           csg,
		srvAddr:       srvAddr,
		rpcLogFactory: rpcLogFactory,
	}

	b.pinger = pinger{
		name:    name,
		doPing:  b.pingOnce,
		timeout: BServerPingTimeout,
		log:     log,
	}

	b.authToken = kbfscrypto.NewAuthToken(
		signer, BServerTokenServer, BServerTokenExpireIn,
		"libkbfs_bserver_remote", VersionString(), b)

	constBackoff := backoff.NewConstantBackOff(RPCReconnectInterval)
	b.connOpts = rpc.ConnectionOpts{
		DontConnectNow:   true, // connect only on-demand
		WrapErrorFunc:    libkb.WrapError,
		TagsFunc:         libkb.LogTagsFromContext,
		ReconnectBackoff: func() backoff.BackOff { return constBackoff },
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
		b.srvAddr, kbfscrypto.GetRootCerts(b.srvAddr),
		kbfsblock.BServerErrorUnwrapper{}, b, b.rpcLogFactory, b.log,
		b.connOpts)
	b.client = keybase1.BlockClient{Cli: b.conn.GetClient()}
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

// resetAuth is called to reset the authorization on a BlockServer
// connection.
func (b *blockServerRemoteClientHandler) resetAuth(
	ctx context.Context, c keybase1.BlockInterface) (err error) {
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
	//do not let connection.go's DoCommand retry any batch rpcs automatically
	//because i will manually retry them without successfully completed references
	switch rpcName {
	case "keybase.1.block.delReferenceWithCount":
		return false
	case "keybase.1.block.archiveReferenceWithCount":
		return false
	case "keybase.1.block.archiveReference":
		return false
	}
	if _, ok := err.(kbfsblock.BServerErrorThrottle); ok {
		return true
	}
	if quotaErr, ok := err.(kbfsblock.BServerErrorOverQuota); ok && quotaErr.Throttled {
		return true
	}
	return false
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
		b.initNewConnection()
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
	config     blockServerRemoteConfig
	shutdownFn func()
	log        traceLogger
	deferLog   traceLogger
	blkSrvAddr string

	putConn *blockServerRemoteClientHandler
	getConn *blockServerRemoteClientHandler
}

// Test that BlockServerRemote fully implements the BlockServer interface.
var _ BlockServer = (*BlockServerRemote)(nil)

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(config blockServerRemoteConfig,
	blkSrvAddr string, rpcLogFactory *libkb.RPCLogFactory) *BlockServerRemote {
	log := config.MakeLogger("BSR")
	deferLog := log.CloneWithAddedDepth(1)
	bs := &BlockServerRemote{
		config:     config,
		log:        traceLogger{log},
		deferLog:   traceLogger{deferLog},
		blkSrvAddr: blkSrvAddr,
	}
	// Use two separate auth clients -- one for writes and one for
	// reads.  This allows small reads to avoid getting trapped behind
	// large asynchronous writes.  TODO: use some real network QoS to
	// achieve better prioritization within the actual network.
	bs.putConn = newBlockServerRemoteClientHandler(
		"BlockServerRemotePut", log, config.Signer(),
		config.CurrentSessionGetter(), blkSrvAddr, rpcLogFactory)
	bs.getConn = newBlockServerRemoteClientHandler(
		"BlockServerRemoteGet", log, config.Signer(),
		config.CurrentSessionGetter(), blkSrvAddr, rpcLogFactory)

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
	return b.blkSrvAddr
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (b *BlockServerRemote) RefreshAuthToken(ctx context.Context) {
	b.putConn.RefreshAuthToken(ctx)
	b.getConn.RefreshAuthToken(ctx)
}

func makeBlockIDCombo(id kbfsblock.ID, context kbfsblock.Context) keybase1.BlockIdCombo {
	// ChargedTo is somewhat confusing when this BlockIdCombo is
	// used in a BlockReference -- it just refers to the original
	// creator of the block, i.e. the original user charged for
	// the block.
	//
	// This may all change once we implement groups.
	return keybase1.BlockIdCombo{
		BlockHash: id.String(),
		ChargedTo: context.GetCreator(),
		BlockType: context.GetBlockType(),
	}
}

func makeBlockReference(id kbfsblock.ID, context kbfsblock.Context) keybase1.BlockReference {
	// Block references to MD blocks are allowed, because they can be
	// deleted in the case of an MD put failing.
	return keybase1.BlockReference{
		Bid: makeBlockIDCombo(id, context),
		// The actual writer to modify quota for.
		ChargedTo: context.GetWriter(),
		Nonce:     keybase1.BlockRefNonce(context.GetRefNonce()),
	}
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context) (
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	size := -1
	b.log.LazyTrace(ctx, "BServer: Get %s", id)
	defer func() {
		b.log.LazyTrace(ctx, "BServer: Get %s done (err=%v)", id, err)
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "Get id=%s tlf=%s context=%s sz=%d err=%v",
				id, tlfID, context, size, err)
		} else {
			b.deferLog.CDebugf(
				ctx, "Get id=%s tlf=%s context=%s sz=%d",
				id, tlfID, context, size)
			dbc := b.config.DiskBlockCache()
			if dbc != nil {
				go dbc.Put(ctx, tlfID, id, buf, serverHalf)
			}
		}
	}()

	arg := keybase1.GetBlockArg{
		Bid:    makeBlockIDCombo(id, context),
		Folder: tlfID.String(),
	}

	res, err := b.getConn.getClient().GetBlock(ctx, arg)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	size = len(res.Buf)
	serverHalf, err = kbfscrypto.ParseBlockCryptKeyServerHalf(res.BlockKey)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return res.Buf, serverHalf, nil
}

// Put implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Put(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	bContext kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	dbc := b.config.DiskBlockCache()
	if dbc != nil {
		go dbc.Put(ctx, tlfID, id, buf, serverHalf)
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

	arg := keybase1.PutBlockArg{
		Bid: makeBlockIDCombo(id, bContext),
		// BlockKey is misnamed -- it contains just the server
		// half.
		BlockKey: serverHalf.String(),
		Folder:   tlfID.String(),
		Buf:      buf,
	}

	// Handle OverQuota errors at the caller
	return b.putConn.getClient().PutBlock(ctx, arg)
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, tlfID tlf.ID,
	id kbfsblock.ID, context kbfsblock.Context) (err error) {
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

	// Handle OverQuota errors at the caller
	return b.putConn.getClient().AddReference(ctx, keybase1.AddReferenceArg{
		Ref:    makeBlockReference(id, context),
		Folder: tlfID.String(),
	})
}

// RemoveBlockReferences implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts kbfsblock.ContextMap) (liveCounts map[kbfsblock.ID]int, err error) {
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
	doneRefs, err := b.batchDowngradeReferences(ctx, tlfID, contexts, false)
	liveCounts = make(map[kbfsblock.ID]int)
	for id, nonces := range doneRefs {
		for _, count := range nonces {
			if existing, ok := liveCounts[id]; !ok || existing > count {
				liveCounts[id] = count
			}
		}
	}
	return liveCounts, err

}

// ArchiveBlockReferences implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) ArchiveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts kbfsblock.ContextMap) (err error) {
	b.log.LazyTrace(ctx, "BServer: ArchiveRef %v", contexts)
	defer func() {
		b.log.LazyTrace(ctx, "BServer: ArchiveRef %v done (err=%v)", contexts, err)
		if err != nil {
			b.deferLog.CWarningf(ctx, "ArchiveBlockReferences batch size=%d err=%v", len(contexts), err)
		} else {
			b.deferLog.CDebugf(ctx, "ArchiveBlockReferences batch size=%d", len(contexts))
		}
	}()
	_, err = b.batchDowngradeReferences(ctx, tlfID, contexts, true)
	return err
}

// IsUnflushed implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) IsUnflushed(
	_ context.Context, _ tlf.ID, _ kbfsblock.ID) (
	bool, error) {
	return false, nil
}

// batchDowngradeReferences archives or deletes a batch of references
func (b *BlockServerRemote) batchDowngradeReferences(ctx context.Context,
	tlfID tlf.ID, contexts kbfsblock.ContextMap, archive bool) (
	doneRefs map[kbfsblock.ID]map[kbfsblock.RefNonce]int, finalError error) {
	doneRefs = make(map[kbfsblock.ID]map[kbfsblock.RefNonce]int)
	notDone := b.getNotDone(contexts, doneRefs)

	throttleErr := backoff.Retry(func() error {
		var res keybase1.DowngradeReferenceRes
		var err error
		if archive {
			res, err = b.putConn.getClient().ArchiveReferenceWithCount(ctx,
				keybase1.ArchiveReferenceWithCountArg{
					Refs:   notDone,
					Folder: tlfID.String(),
				})
		} else {
			res, err = b.putConn.getClient().DelReferenceWithCount(ctx,
				keybase1.DelReferenceWithCountArg{
					Refs:   notDone,
					Folder: tlfID.String(),
				})
		}

		// log errors
		if err != nil {
			b.log.CWarningf(ctx, "batchDowngradeReferences archive %t sent=%v done=%v failedRef=%v err=%v",
				archive, notDone, res.Completed, res.Failed, err)
		} else {
			b.log.CDebugf(ctx, "batchDowngradeReferences archive %t notdone=%v all succeeded",
				archive, notDone)
		}

		// update the set of completed reference
		for _, ref := range res.Completed {
			bid, err := kbfsblock.IDFromString(ref.Ref.Bid.BlockHash)
			if err != nil {
				continue
			}
			nonces, ok := doneRefs[bid]
			if !ok {
				nonces = make(map[kbfsblock.RefNonce]int)
				doneRefs[bid] = nonces
			}
			nonces[kbfsblock.RefNonce(ref.Ref.Nonce)] = ref.LiveCount
		}
		// update the list of references to downgrade
		notDone = b.getNotDone(contexts, doneRefs)

		//if context is cancelled, return immediately
		select {
		case <-ctx.Done():
			finalError = ctx.Err()
			return nil
		default:
		}

		// check whether to backoff and retry
		if err != nil {
			// if error is of type throttle, retry
			if _, ok := err.(kbfsblock.BServerErrorThrottle); ok {
				return err
			}
			// non-throttle error, do not retry here
			finalError = err
		}
		return nil
	}, backoff.NewExponentialBackOff())

	// if backoff has given up retrying, return error
	if throttleErr != nil {
		return doneRefs, throttleErr
	}

	if finalError == nil {
		if len(notDone) != 0 {
			b.log.CErrorf(ctx, "batchDowngradeReferences finished successfully with outstanding refs? all=%v done=%v notDone=%v\n", contexts, doneRefs, notDone)
			return doneRefs,
				errors.New("batchDowngradeReferences inconsistent result")
		}
	}
	return doneRefs, finalError
}

// getNotDone returns the set of block references in "all" that do not yet appear in "results"
func (b *BlockServerRemote) getNotDone(all kbfsblock.ContextMap, doneRefs map[kbfsblock.ID]map[kbfsblock.RefNonce]int) (
	notDone []keybase1.BlockReference) {
	for id, idContexts := range all {
		for _, context := range idContexts {
			if _, ok := doneRefs[id]; ok {
				if _, ok1 := doneRefs[id][context.GetRefNonce()]; ok1 {
					continue
				}
			}
			ref := makeBlockReference(id, context)
			notDone = append(notDone, ref)
		}
	}
	return notDone
}

// GetUserQuotaInfo implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) GetUserQuotaInfo(ctx context.Context) (info *kbfsblock.UserQuotaInfo, err error) {
	b.log.LazyTrace(ctx, "BServer: GetQuotaInfo")
	defer func() {
		b.log.LazyTrace(ctx, "BServer: GetQuotaInfo done (err=%v)", err)
	}()
	res, err := b.getConn.getClient().GetUserQuotaInfo(ctx)
	if err != nil {
		return nil, err
	}
	return kbfsblock.UserQuotaInfoDecode(res, b.config.Codec())
}

// Shutdown implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Shutdown(ctx context.Context) {
	if b.shutdownFn != nil {
		b.shutdownFn()
	}
	b.getConn.shutdown()
	b.putConn.shutdown()
}
