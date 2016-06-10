// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding/hex"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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
	client     keybase1.BlockInterface
	log        logger.Logger
	deferLog   logger.Logger
	blkSrvAddr string
	authToken  *AuthToken
}

// Test that BlockServerRemote fully implements the BlockServer interface.
var _ BlockServer = (*BlockServerRemote)(nil)

// Test that BlockServerRemote fully implements the AuthTokenRefreshHandler interface.
var _ AuthTokenRefreshHandler = (*BlockServerRemote)(nil)

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(config Config, blkSrvAddr string) *BlockServerRemote {
	log := config.MakeLogger("BSR")
	deferLog := log.CloneWithAddedDepth(1)
	bs := &BlockServerRemote{
		config:     config,
		log:        log,
		deferLog:   deferLog,
		blkSrvAddr: blkSrvAddr,
	}
	bs.log.Debug("new instance server addr %s", blkSrvAddr)
	bs.authToken = NewAuthToken(config,
		BServerTokenServer, BServerTokenExpireIn,
		"libkbfs_bserver_remote", bs)
	// This will connect only on-demand due to the last argument.
	conn := rpc.NewTLSConnection(blkSrvAddr, GetRootCerts(blkSrvAddr),
		bServerErrorUnwrapper{}, bs, false, libkb.NewRPCLogFactory(libkb.G),
		libkb.WrapError, config.MakeLogger(""), LogTagsFromContext)
	bs.client = keybase1.BlockClient{Cli: conn.GetClient()}
	bs.shutdownFn = conn.Shutdown
	return bs
}

// For testing.
func newBlockServerRemoteWithClient(config Config,
	client keybase1.BlockInterface) *BlockServerRemote {
	log := config.MakeLogger("BSR")
	deferLog := log.CloneWithAddedDepth(1)
	bs := &BlockServerRemote{
		config:   config,
		client:   client,
		log:      log,
		deferLog: deferLog,
	}
	return bs
}

// RemoteAddress returns the remote bserver this client is talking to
func (b *BlockServerRemote) RemoteAddress() string {
	return b.blkSrvAddr
}

// HandlerName implements the ConnectionHandler interface.
func (*BlockServerRemote) HandlerName() string {
	return "BlockServerRemote"
}

// OnConnect implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnect(ctx context.Context,
	_ *rpc.Connection, client rpc.GenericClient, _ *rpc.Server) error {
	// reset auth -- using b.client here would cause problematic recursion.
	c := keybase1.BlockClient{Cli: client}
	return b.resetAuth(ctx, c)
}

// resetAuth is called to reset the authorization on a BlockServer
// connection.
func (b *BlockServerRemote) resetAuth(ctx context.Context, c keybase1.BlockInterface) error {
	_, _, err := b.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		b.log.Debug("BServerRemote: User logged out, skipping resetAuth")
		return nil
	}

	// request a challenge
	challenge, err := c.GetSessionChallenge(ctx)
	if err != nil {
		return err
	}

	// get a new signature
	signature, err := b.authToken.Sign(ctx, challenge)
	if err != nil {
		return err
	}

	return c.AuthenticateSession(ctx, signature)
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (b *BlockServerRemote) RefreshAuthToken(ctx context.Context) {
	if err := b.resetAuth(ctx, b.client); err != nil {
		b.log.CDebugf(ctx, "error refreshing auth token: %v", err)
	}
}

// OnConnectError implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnectError(err error, wait time.Duration) {
	b.log.Warning("connection error: %v; retrying in %s",
		err, wait)
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
}

// OnDoCommandError implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnDoCommandError(err error, wait time.Duration) {
	b.log.Warning("DoCommand error: %v; retrying in %s",
		err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnDisconnected(ctx context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		b.log.CWarningf(ctx, "disconnected")
	}
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
}

// ShouldRetry implements the ConnectionHandler interface.
func (b *BlockServerRemote) ShouldRetry(rpcName string, err error) bool {
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
func (b *BlockServerRemote) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
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
func (b *BlockServerRemote) Get(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
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

	res, err := b.client.GetBlock(ctx, arg)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	size = len(res.Buf)
	bk := BlockCryptKeyServerHalf{}
	var kbuf []byte
	if kbuf, err = hex.DecodeString(res.BlockKey); err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	copy(bk.data[:], kbuf)
	return res.Buf, bk, nil
}

// Put implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
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

	err = b.client.PutBlock(ctx, arg)
	if err != nil {
		if qe, ok := err.(BServerErrorOverQuota); ok && !qe.Throttled {
			return nil
		}
		return err
	}
	return nil
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
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

	err = b.client.AddReference(ctx, keybase1.AddReferenceArg{
		Ref:    makeBlockReference(id, context),
		Folder: tlfID.String(),
	})
	if err != nil {
		if qe, ok := err.(BServerErrorOverQuota); ok && !qe.Throttled {
			return nil
		}
		return err
	}
	return nil
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReference(ctx context.Context,
	tlfID TlfID, contexts map[BlockID][]BlockContext) (liveCounts map[BlockID]int, err error) {
	defer func() {
		if err != nil {
			b.deferLog.CWarningf(ctx, "RemoveBlockReference batch size=%d err=%v", len(contexts), err)
		} else {
			b.deferLog.CDebugf(ctx, "RemoveBlockReference batch size=%d", len(contexts))
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
	tlfID TlfID, contexts map[BlockID][]BlockContext) (err error) {
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
	tlfID TlfID, contexts map[BlockID][]BlockContext, archive bool) (
	doneRefs map[BlockID]map[BlockRefNonce]int, finalError error) {
	tries := 0
	doneRefs = make(map[BlockID]map[BlockRefNonce]int)
	notDone := b.getNotDone(contexts, doneRefs)
	var res keybase1.DowngradeReferenceRes
	var err error
	for len(notDone) > 0 {
		if archive {
			res, err = b.client.ArchiveReferenceWithCount(ctx, keybase1.ArchiveReferenceWithCountArg{
				Refs:   notDone,
				Folder: tlfID.String(),
			})
		} else {
			res, err = b.client.DelReferenceWithCount(ctx, keybase1.DelReferenceWithCountArg{
				Refs:   notDone,
				Folder: tlfID.String(),
			})
		}
		tries++
		if err != nil {
			b.log.CWarningf(ctx, "batchDowngradeReferences archive %t (tries %d) sent=%s done=%s failedRef=%s err=%v",
				archive, tries, notDone, res.Completed, res.Failed, err)
		} else {
			b.log.CDebugf(ctx, "batchDowngradeReferences archive %t (tries %d) sent=%s all succeeded",
				archive, tries, notDone)
		}
		if err != nil {
			//if Failed reference is not a throttle error, do not retry it
			_, tmpErr := err.(BServerErrorThrottle)
			if !tmpErr {
				finalError = err
				bid, err := BlockIDFromString(res.Failed.Bid.BlockHash)
				if err == nil {
					if refs, ok := contexts[bid]; ok {
						for i := range refs {
							if refs[i].GetRefNonce() == BlockRefNonce(res.Failed.Nonce) {
								refs = append(refs[:i], refs[i+1:]...)
								contexts[bid] = refs
								break
							}
						}
					}
				}
			}
		}

		//update the set of completed reference
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

		//figure out the not-yet-deleted references
		notDone = b.getNotDone(contexts, doneRefs)

		//if context is cancelled, return immediately
		select {
		case <-ctx.Done():
			return doneRefs, ctx.Err()
		default:
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
	res, err := b.client.GetUserQuotaInfo(ctx)
	if err != nil {
		return nil, err
	}
	return UserQuotaInfoDecode(res, b.config)
}

// Shutdown implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Shutdown() {
	if b.shutdownFn != nil {
		b.shutdownFn()
	}
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
}
