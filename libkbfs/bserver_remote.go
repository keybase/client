// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"time"

	"github.com/cenkalti/backoff"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

const (
	// BServerTokenServer is the expected server type for bserver authentication.
	BServerTokenServer = "kbfs_block"
	// BServerTokenExpireIn is the TTL to use when constructing an authentication token.
	BServerTokenExpireIn = 2 * 60 * 60 // 2 hours
)

// BlockServerRemote implements the BlockServer interface and
// represents a remote KBFS block server.
type BlockServerRemote struct {
	config     Config
	shutdownFn func()
	putClient  keybase1.BlockInterface
	getClient  keybase1.BlockInterface
	log        logger.Logger
	deferLog   logger.Logger
	blkSrvAddr string

	putAuthToken *kbfscrypto.AuthToken
	getAuthToken *kbfscrypto.AuthToken
}

// Test that BlockServerRemote fully implements the BlockServer interface.
var _ BlockServer = (*BlockServerRemote)(nil)

// blockServerRemoteAuthTokenRefresher is a helper struct for
// refreshing auth tokens.
type blockServerRemoteClientHandler struct {
	bs        *BlockServerRemote
	name      string
	authToken *kbfscrypto.AuthToken
	client    keybase1.BlockInterface
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (b *blockServerRemoteClientHandler) RefreshAuthToken(
	ctx context.Context) {
	if err := b.bs.resetAuth(ctx, b.client, b.authToken); err != nil {
		b.bs.log.CDebugf(ctx, "error refreshing auth token: %v", err)
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
	return b.bs.resetAuth(ctx, c, b.authToken)
}

// OnConnectError implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) OnConnectError(err error, wait time.Duration) {
	b.bs.log.Warning("connection error: %v; retrying in %s",
		err, wait)
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
}

// OnDoCommandError implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) OnDoCommandError(err error, wait time.Duration) {
	b.bs.log.Warning("DoCommand error: %v; retrying in %s",
		err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (b *blockServerRemoteClientHandler) OnDisconnected(ctx context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		b.bs.log.CWarningf(ctx, "disconnected")
	}
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
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
	if _, ok := err.(BServerErrorThrottle); ok {
		return true
	}
	if quotaErr, ok := err.(BServerErrorOverQuota); ok && quotaErr.Throttled {
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

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(config Config, blkSrvAddr string, ctx Context) *BlockServerRemote {
	log := config.MakeLogger("BSR")
	deferLog := log.CloneWithAddedDepth(1)
	bs := &BlockServerRemote{
		config:     config,
		log:        log,
		deferLog:   deferLog,
		blkSrvAddr: blkSrvAddr,
	}
	bs.log.Debug("new instance server addr %s", blkSrvAddr)

	// Use two separate auth tokens and clients -- one for writes and
	// one for reads.  This allows small reads to avoid getting
	// trapped behind large asynchronous writes.  TODO: use some real
	// network QoS to achieve better prioritization within the actual
	// network.
	putClientHandler := &blockServerRemoteClientHandler{
		bs:   bs,
		name: "BlockServerRemotePut",
	}
	bs.putAuthToken = kbfscrypto.NewAuthToken(config.Crypto(),
		BServerTokenServer, BServerTokenExpireIn,
		"libkbfs_bserver_remote", VersionString(), putClientHandler)
	putClientHandler.authToken = bs.putAuthToken
	getClientHandler := &blockServerRemoteClientHandler{
		bs:   bs,
		name: "BlockServerRemoteGet",
	}
	bs.getAuthToken = kbfscrypto.NewAuthToken(config.Crypto(),
		BServerTokenServer, BServerTokenExpireIn,
		"libkbfs_bserver_remote", VersionString(), getClientHandler)
	getClientHandler.authToken = bs.getAuthToken

	putConn := rpc.NewTLSConnection(blkSrvAddr,
		kbfscrypto.GetRootCerts(blkSrvAddr),
		bServerErrorUnwrapper{}, putClientHandler,
		false, /* connect only on-demand */
		ctx.NewRPCLogFactory(), libkb.WrapError, config.MakeLogger(""),
		LogTagsFromContext)
	bs.putClient = keybase1.BlockClient{Cli: putConn.GetClient()}
	putClientHandler.client = bs.putClient
	getConn := rpc.NewTLSConnection(blkSrvAddr,
		kbfscrypto.GetRootCerts(blkSrvAddr),
		bServerErrorUnwrapper{}, getClientHandler,
		false, /* connect only on-demand */
		ctx.NewRPCLogFactory(), libkb.WrapError, config.MakeLogger(""),
		LogTagsFromContext)
	bs.getClient = keybase1.BlockClient{Cli: getConn.GetClient()}
	getClientHandler.client = bs.getClient

	bs.shutdownFn = func() {
		putConn.Shutdown()
		getConn.Shutdown()
	}
	return bs
}

// For testing.
func newBlockServerRemoteWithClient(config Config,
	client keybase1.BlockInterface) *BlockServerRemote {
	log := config.MakeLogger("BSR")
	deferLog := log.CloneWithAddedDepth(1)
	bs := &BlockServerRemote{
		config:    config,
		putClient: client,
		getClient: client,
		log:       log,
		deferLog:  deferLog,
	}
	return bs
}

// RemoteAddress returns the remote bserver this client is talking to
func (b *BlockServerRemote) RemoteAddress() string {
	return b.blkSrvAddr
}

// resetAuth is called to reset the authorization on a BlockServer
// connection.
func (b *BlockServerRemote) resetAuth(
	ctx context.Context, c keybase1.BlockInterface,
	authToken *kbfscrypto.AuthToken) (err error) {

	defer func() {
		b.log.Debug("BlockServerRemote: resetAuth called, err: %#v", err)
	}()

	_, _, err = b.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		b.log.Debug("BlockServerRemote: User logged out, skipping resetAuth")
		return nil
	}

	// request a challenge
	challenge, err := c.GetSessionChallenge(ctx)
	if err != nil {
		return err
	}

	// get UID, deviceKID and normalized username
	username, uid, err := b.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}
	key, err := b.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return err
	}

	// get a new signature
	signature, err := authToken.Sign(ctx, username, uid, key, challenge)
	if err != nil {
		return err
	}

	return c.AuthenticateSession(ctx, signature)
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (b *BlockServerRemote) RefreshAuthToken(ctx context.Context) {
	if err := b.resetAuth(ctx, b.putClient, b.putAuthToken); err != nil {
		b.log.CDebugf(ctx, "error refreshing put auth token: %v", err)
	}
	if err := b.resetAuth(ctx, b.getClient, b.getAuthToken); err != nil {
		b.log.CDebugf(ctx, "error refreshing get auth token: %v", err)
	}
}

func makeBlockIDCombo(id BlockID, context BlockContext) keybase1.BlockIdCombo {
	// ChargedTo is somewhat confusing when this BlockIdCombo is
	// used in a BlockReference -- it just refers to the original
	// creator of the block, i.e. the original user charged for
	// the block.
	//
	// This may all change once we implement groups.
	return keybase1.BlockIdCombo{
		BlockHash: id.String(),
		ChargedTo: context.GetCreator(),
	}
}

func makeBlockReference(id BlockID, context BlockContext) keybase1.BlockReference {
	return keybase1.BlockReference{
		Bid: makeBlockIDCombo(id, context),
		// The actual writer to modify quota for.
		ChargedTo: context.GetWriter(),
		Nonce:     keybase1.BlockRefNonce(context.GetRefNonce()),
	}
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(ctx context.Context, tlfID tlf.ID, id BlockID,
	context BlockContext) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	var err error
	size := -1
	defer func() {
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "Get id=%s tlf=%s context=%s sz=%d err=%v",
				id, tlfID, context, size, err)
		} else {
			b.deferLog.CDebugf(
				ctx, "Get id=%s tlf=%s context=%s sz=%d",
				id, tlfID, context, size)
		}
	}()

	arg := keybase1.GetBlockArg{
		Bid:    makeBlockIDCombo(id, context),
		Folder: tlfID.String(),
	}

	res, err := b.getClient.GetBlock(ctx, arg)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	size = len(res.Buf)
	bk, err := kbfscrypto.ParseBlockCryptKeyServerHalf(res.BlockKey)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return res.Buf, bk, nil
}

// Put implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Put(ctx context.Context, tlfID tlf.ID, id BlockID,
	context BlockContext, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	var err error
	size := len(buf)
	defer func() {
		if err != nil {
			b.deferLog.CWarningf(
				ctx, "Put id=%s tlf=%s context=%s sz=%d err=%v",
				id, tlfID, context, size, err)
		} else {
			b.deferLog.CDebugf(
				ctx, "Put id=%s tlf=%s context=%s sz=%d",
				id, tlfID, context, size)
		}
	}()

	arg := keybase1.PutBlockArg{
		Bid: makeBlockIDCombo(id, context),
		// BlockKey is misnamed -- it contains just the server
		// half.
		BlockKey: serverHalf.String(),
		Folder:   tlfID.String(),
		Buf:      buf,
	}

	// Handle OverQuota errors at the caller
	return b.putClient.PutBlock(ctx, arg)
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, tlfID tlf.ID,
	id BlockID, context BlockContext) error {
	var err error
	defer func() {
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
	return b.putClient.AddReference(ctx, keybase1.AddReferenceArg{
		Ref:    makeBlockReference(id, context),
		Folder: tlfID.String(),
	})
}

// RemoveBlockReferences implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts map[BlockID][]BlockContext) (liveCounts map[BlockID]int, err error) {
	defer func() {
		if err != nil {
			b.deferLog.CWarningf(ctx, "RemoveBlockReferences batch size=%d err=%v", len(contexts), err)
		} else {
			b.deferLog.CDebugf(ctx, "RemoveBlockReferences batch size=%d", len(contexts))
		}
	}()
	doneRefs, err := b.batchDowngradeReferences(ctx, tlfID, contexts, false)
	liveCounts = make(map[BlockID]int)
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
	tlfID tlf.ID, contexts map[BlockID][]BlockContext) (err error) {
	defer func() {
		if err != nil {
			b.deferLog.CWarningf(ctx, "ArchiveBlockReferences batch size=%d err=%v", len(contexts), err)
		} else {
			b.deferLog.CDebugf(ctx, "ArchiveBlockReferences batch size=%d", len(contexts))
		}
	}()
	_, err = b.batchDowngradeReferences(ctx, tlfID, contexts, true)
	return err
}

// batchDowngradeReferences archives or deletes a batch of references
func (b *BlockServerRemote) batchDowngradeReferences(ctx context.Context,
	tlfID tlf.ID, contexts map[BlockID][]BlockContext, archive bool) (
	doneRefs map[BlockID]map[BlockRefNonce]int, finalError error) {
	doneRefs = make(map[BlockID]map[BlockRefNonce]int)
	notDone := b.getNotDone(contexts, doneRefs)

	throttleErr := backoff.Retry(func() error {
		var res keybase1.DowngradeReferenceRes
		var err error
		if archive {
			res, err = b.putClient.ArchiveReferenceWithCount(ctx,
				keybase1.ArchiveReferenceWithCountArg{
					Refs:   notDone,
					Folder: tlfID.String(),
				})
		} else {
			res, err = b.putClient.DelReferenceWithCount(ctx,
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
			bid, err := BlockIDFromString(ref.Ref.Bid.BlockHash)
			if err != nil {
				continue
			}
			nonces, ok := doneRefs[bid]
			if !ok {
				nonces = make(map[BlockRefNonce]int)
				doneRefs[bid] = nonces
			}
			nonces[BlockRefNonce(ref.Ref.Nonce)] = ref.LiveCount
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
			if _, ok := err.(BServerErrorThrottle); ok {
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
			return doneRefs, errors.New("batchDowngradeReferences inconsistent result\n")
		}
	}
	return doneRefs, finalError
}

// getNotDone returns the set of block references in "all" that do not yet appear in "results"
func (b *BlockServerRemote) getNotDone(all map[BlockID][]BlockContext, doneRefs map[BlockID]map[BlockRefNonce]int) (
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
func (b *BlockServerRemote) GetUserQuotaInfo(ctx context.Context) (info *UserQuotaInfo, err error) {
	res, err := b.getClient.GetUserQuotaInfo(ctx)
	if err != nil {
		return nil, err
	}
	return UserQuotaInfoDecode(res, b.config.Codec())
}

// Shutdown implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Shutdown() {
	if b.shutdownFn != nil {
		b.shutdownFn()
	}
	if b.getAuthToken != nil {
		b.getAuthToken.Shutdown()
	}
	if b.putAuthToken != nil {
		b.putAuthToken.Shutdown()
	}
}
