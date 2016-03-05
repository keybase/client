package libkbfs

import (
	"encoding/hex"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
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
func (b *BlockServerRemote) OnDisconnected(_ context.Context, status DisconnectStatus) {
	if status == StartingNonFirstConnection {
		b.log.Warning("disconnected")
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
		b.log.CDebugf(ctx, "Get id=%s uid=%s sz=%d err=%v",
			id, context.GetWriter(), size, err)
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
		b.log.CDebugf(ctx, "Put id=%s uid=%s sz=%d err=%v",
			id, context.GetWriter(), size, err)
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
		b.log.CDebugf(ctx, "AddBlockReference id=%s uid=%s err=%v",
			id, context.GetWriter(), err)
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
func (b *BlockServerRemote) RemoveBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	var err error
	defer func() {
		b.log.CDebugf(ctx, "RemoveBlockReference id=%s uid=%s err=%v",
			id, context.GetWriter(), err)
	}()

	ref := keybase1.BlockReference{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetCreator(),
			BlockHash: id.String(),
		},
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
		Nonce:     keybase1.BlockRefNonce(context.GetRefNonce()),
	}

	err = b.client.DelReference(ctx, keybase1.DelReferenceArg{
		Ref:    ref,
		Folder: tlfID.String(),
	})
	return err
}

func (b *BlockServerRemote) archiveBlockReferences(ctx context.Context,
	tlfID TlfID, refs []keybase1.BlockReference) (err error) {
	doneRefs := make(map[string]bool)
	notDone := refs
	prevProgress := true
	var res []keybase1.BlockReference
	for len(notDone) > 0 {

		res, err = b.client.ArchiveReference(ctx, keybase1.ArchiveReferenceArg{
			Refs:   notDone,
			Folder: tlfID.String(),
		})
		b.log.CDebugf(ctx, "ArchiveBlockReference request to archive %d refs actual archived %d",
			len(notDone), len(res))
		if err != nil {
			b.log.CWarningf(ctx, "ArchiveBlockReference err=%v", err)
		}
		if len(res) == 0 && !prevProgress {
			b.log.CErrorf(ctx, "ArchiveBlockReference failed to make progress err=%v", err)
			break
		}
		prevProgress = len(res) != 0
		for _, ref := range res {
			doneRefs[ref.Bid.BlockHash+string(ref.Nonce[:])] = true
		}
		notDone = b.getNotDoneRefs(refs, doneRefs)
	}
	return err
}

func (b *BlockServerRemote) getNotDoneRefs(refs []keybase1.BlockReference, done map[string]bool) (
	notDone []keybase1.BlockReference) {
	for _, ref := range refs {
		if _, ok := done[ref.Bid.BlockHash+string(ref.Nonce[:])]; ok {
		} else {
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

// ArchiveBlockReferences implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) ArchiveBlockReferences(ctx context.Context,
	tlfID TlfID, contexts map[BlockID][]BlockContext) error {
	refs := make([]keybase1.BlockReference, 0, len(contexts))
	for id, idContexts := range contexts {
		for _, context := range idContexts {
			refs = append(refs, keybase1.BlockReference{
				Bid: keybase1.BlockIdCombo{
					ChargedTo: context.GetCreator(),
					BlockHash: id.String(),
				},
				ChargedTo: context.GetWriter(),
				Nonce:     keybase1.BlockRefNonce(context.GetRefNonce()),
			})
		}
	}
	return b.archiveBlockReferences(ctx, tlfID, refs)
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
