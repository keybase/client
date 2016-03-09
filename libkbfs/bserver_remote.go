package libkbfs

import (
	"encoding/hex"
	"time"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
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
	bs := &BlockServerRemote{
		config:     config,
		log:        config.MakeLogger("BSR"),
		blkSrvAddr: blkSrvAddr,
	}
	bs.log.Debug("new instance server addr %s", blkSrvAddr)
	bs.authToken = NewAuthToken(config,
		BServerTokenServer, BServerTokenExpireIn,
		"libkbfs_bserver_remote", bs)
	// This will connect only on-demand due to the last argument.
	conn := NewTLSConnection(config, blkSrvAddr, GetRootCerts(blkSrvAddr), bServerErrorUnwrapper{}, bs, false)
	bs.client = keybase1.BlockClient{Cli: conn.GetClient()}
	bs.shutdownFn = conn.Shutdown
	return bs
}

// For testing.
func newBlockServerRemoteWithClient(ctx context.Context, config Config,
	client keybase1.BlockInterface) *BlockServerRemote {
	bs := &BlockServerRemote{
		config: config,
		client: client,
		log:    config.MakeLogger(""),
	}
	return bs
}

// RemoteAddress returns the remote bserver this client is talking to
func (b *BlockServerRemote) RemoteAddress() string {
	return b.blkSrvAddr
}

// OnConnect implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnect(ctx context.Context,
	_ *Connection, client rpc.GenericClient, _ *rpc.Server) error {
	// reset auth -- using b.client here would cause problematic recursion.
	c := keybase1.BlockClient{Cli: cancelableClient{client}}
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
func (b *BlockServerRemote) OnDisconnected(ctx context.Context, status DisconnectStatus) {
	if status == StartingNonFirstConnection {
		b.log.CWarningf(ctx, "disconnected")
	}
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
}

// ShouldThrottle implements the ConnectionHandler interface.
func (b *BlockServerRemote) ShouldThrottle(err error) bool {
	if err == nil {
		return false
	}
	_, shouldThrottle := err.(BServerErrorThrottle)
	return shouldThrottle
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	var err error
	size := -1
	defer func() {
		if err != nil {
			b.log.CWarningf(ctx, "Get id=%s uid=%s sz=%d err=%v",
				id, context.GetWriter(), size, err)
		} else {
			b.log.CDebugf(ctx, "Get id=%s uid=%s sz=%d",
				id, context.GetWriter(), size)
		}
	}()

	arg := keybase1.GetBlockArg{
		Bid: keybase1.BlockIdCombo{
			BlockHash: id.String(),
			ChargedTo: context.GetWriter(),
		},
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
// TODO: store the server-half of the block key
func (b *BlockServerRemote) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	var err error
	size := len(buf)
	defer func() {
		if err != nil {
			b.log.CWarningf(ctx, "Put id=%s uid=%s sz=%d err=%v",
				id, context.GetWriter(), size, err)
		} else {
			b.log.CDebugf(ctx, "Put id=%s uid=%s sz=%d",
				id, context.GetWriter(), size)
		}
	}()

	arg := keybase1.PutBlockArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetWriter(),
			BlockHash: id.String(),
		},
		BlockKey: serverHalf.String(),
		Folder:   tlfID.String(),
		Buf:      buf,
	}

	err = b.client.PutBlock(ctx, arg)
	return err
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	var err error
	defer func() {
		if err != nil {
			b.log.CWarningf(ctx, "AddBlockReference id=%s uid=%s err=%v",
				id, context.GetWriter(), err)
		} else {
			b.log.CDebugf(ctx, "AddBlockReference id=%s uid=%s",
				id, context.GetWriter())
		}
	}()

	ref := keybase1.BlockReference{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetCreator(),
			BlockHash: id.String(),
		},
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
		Nonce:     keybase1.BlockRefNonce(context.GetRefNonce()),
	}

	err = b.client.AddReference(ctx, keybase1.AddReferenceArg{
		Ref:    ref,
		Folder: tlfID.String(),
	})
	return err
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReference(ctx context.Context,
	tlfID TlfID, contexts map[BlockID][]BlockContext) (liveCounts map[BlockID]int, err error) {
	defer func() {
		if err != nil {
			b.log.CWarningf(ctx, "RemoveBlockReference batch size=%d err=%v", len(contexts), err)
		} else {
			b.log.CDebugf(ctx, "RemoveBlockReference batch size=%d", len(contexts))
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
			b.log.CWarningf(ctx, "ArchiveBlockReferences batch size=%d err=%v", len(contexts), err)
		} else {
			b.log.CDebugf(ctx, "ArchiveBlockReferences batch size=%d", len(contexts))
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
		if _, ok := doneRefs[id]; ok {
			continue
		}
		for _, context := range idContexts {
			if _, ok := doneRefs[id][context.GetRefNonce()]; ok {
				continue
			}
			notDone = append(notDone, keybase1.BlockReference{
				Bid: keybase1.BlockIdCombo{
					ChargedTo: context.GetCreator(),
					BlockHash: id.String(),
				},
				ChargedTo: context.GetWriter(),
				Nonce:     keybase1.BlockRefNonce(context.GetRefNonce()),
			})
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
