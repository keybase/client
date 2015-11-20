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
	// BServerTokenType is the expected token type for bserver authentication.
	BServerTokenType = "kbfs_bserver_auth"
	// BServerTokenExpireIn is the TTL to use when constructing an authentication token.
	BServerTokenExpireIn = 2 * 60 * 60 // 2 hours
	// BServerClientName is the client name to include in an authentication token.
	BServerClientName = "libkbfs_bserver_remote"
	// BServerClientVersion is the client version to include in an authentication token.
	BServerClientVersion = "1" // TODO: use some TBD build version
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
		log:        config.MakeLogger(""),
		blkSrvAddr: blkSrvAddr,
	}
	bs.log.Debug("BlockServerRemote new instance "+
		"server addr %s", blkSrvAddr)
	bs.authToken = NewAuthToken(config,
		BServerTokenType, BServerTokenExpireIn,
		BServerClientName, BServerClientVersion, bs)
	// This will connect only on-demand due to the last argument.
	conn := NewTLSConnection(config, blkSrvAddr, bServerErrorUnwrapper{}, bs, false)
	bs.client = keybase1.BlockClient{Cli: conn.GetClient()}
	bs.shutdownFn = conn.Shutdown
	return bs
}

// For testing.
func newBlockServerRemoteWithClient(ctx context.Context, config Config,
	client keybase1.GenericClient) *BlockServerRemote {
	bs := &BlockServerRemote{
		config: config,
		client: keybase1.BlockClient{Cli: client},
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
	conn *Connection, client keybase1.GenericClient, _ *rpc.Server) error {
	// get a new signature
	signature, err := b.authToken.Sign(ctx)
	if err != nil {
		return err
	}

	// Using b.client here would cause problematic recursion.
	c := keybase1.BlockClient{Cli: cancelableClient{client}}
	return c.AuthenticateSession(ctx, signature)
}

// RefreshAuthToken implements the AuthTokenRefreshHandler interface.
func (b *BlockServerRemote) RefreshAuthToken(ctx context.Context) {
	// get a new signature
	signature, err := b.authToken.Sign(ctx)
	if err != nil {
		b.log.Debug("BlockServerRemote: error signing auth token: %v", err)
	}
	// update authentication
	if err := b.client.AuthenticateSession(ctx, signature); err != nil {
		b.log.Debug("BlockServerRemote: error refreshing auth token: %v", err)
	}
}

// OnConnectError implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnectError(err error, wait time.Duration) {
	b.log.Warning("BlockServerRemote: connection error: %v; retrying in %s",
		err, wait)
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
}

// OnDoCommandError implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnDoCommandError(err error, wait time.Duration) {
	b.log.Warning("BlockServerRemote: DoCommand error: %q; retrying in %s",
		err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnDisconnected() {
	b.log.Warning("BlockServerRemote is disconnected")
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
func (b *BlockServerRemote) Get(ctx context.Context, id BlockID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	var err error
	size := -1
	defer func() {
		b.log.CDebugf(ctx, "BlockServerRemote.Get id=%s uid=%s sz=%d err=%v",
			id, context.GetWriter(), size, err)
	}()

	bid := keybase1.BlockIdCombo{
		BlockHash: id.String(),
		ChargedTo: context.GetWriter(),
	}

	res, err := b.client.GetBlock(ctx, bid)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	size = len(res.Buf)
	bk := BlockCryptKeyServerHalf{}
	var kbuf []byte
	if kbuf, err = hex.DecodeString(res.BlockKey); err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	copy(bk.ServerHalf[:], kbuf)
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
		b.log.CDebugf(ctx, "BlockServerRemote.Put id=%s uid=%s sz=%d err=%v",
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
		b.log.CDebugf(ctx, "BlockServerRemote.AddBlockReference id=%s uid=%s err=%v",
			id, context.GetWriter(), err)
	}()

	ref := keybase1.BlockReference{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetCreator(),
			BlockHash: id.String(),
		},
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
	}
	nonce := context.GetRefNonce()
	copy(ref.Nonce[:], nonce[:])

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
		b.log.CDebugf(ctx, "BlockServerRemote.RemoveBlockReference id=%s uid=%s err=%v",
			id, context.GetWriter(), err)
	}()

	ref := keybase1.BlockReference{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetCreator(),
			BlockHash: id.String(),
		},
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
	}
	nonce := context.GetRefNonce()
	copy(ref.Nonce[:], nonce[:])

	err = b.client.DelReference(ctx, keybase1.DelReferenceArg{
		Ref:    ref,
		Folder: tlfID.String(),
	})
	return err
}

// ArchiveBlockReference archives Block references
func (b *BlockServerRemote) ArchiveBlockReference(ctx context.Context, tlfID TlfID, refs []keybase1.BlockReference) (err error) {
	doneRefs := make(map[string]bool)
	notDone := refs
	prevProgress := true
	var res []keybase1.BlockReference
	for len(notDone) > 0 {

		res, err = b.client.ArchiveReference(ctx, keybase1.ArchiveReferenceArg{
			Refs:   notDone,
			Folder: tlfID.String(),
		})
		b.log.CDebugf(ctx, "BlockServerRemote.ArchiveBlockReference request to archive %d refs actual archived %d\n",
			len(notDone), len(res))
		if err != nil {
			b.log.CWarningf(ctx, "BlockServerRemote.ArchiveBlockReference err=%v", err)
		}
		if len(res) == 0 && !prevProgress {
			b.log.CErrorf(ctx, "BlockServerRemote.ArchiveBlockReference failed to make proress err=%v", err)
			break
		}
		prevProgress = len(res) == 0
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

// Shutdown implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Shutdown() {
	if b.shutdownFn != nil {
		b.shutdownFn()
	}
	if b.authToken != nil {
		b.authToken.Shutdown()
	}
}
