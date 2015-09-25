package libkbfs

import (
	"encoding/hex"
	"time"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// BlockServerRemote implements the BlockServer interface and
// represents a remote KBFS block server.
type BlockServerRemote struct {
	config     Config
	conn       *Connection
	log        logger.Logger
	blkSrvAddr string
	testClient keybase1.GenericClient // for testing
}

// Test that BlockServerRemote fully implements the BlockServer interface.
var _ BlockServer = (*BlockServerRemote)(nil)

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(ctx context.Context, config Config, blkSrvAddr string) *BlockServerRemote {
	bs := &BlockServerRemote{config: config,
		log:        config.MakeLogger(""),
		blkSrvAddr: blkSrvAddr}
	connection := NewConnection(ctx, config, blkSrvAddr, bs, BServerUnwrapError)
	bs.conn = connection
	return bs
}

// For testing.
func newBlockServerRemoteWithClient(ctx context.Context, config Config,
	testClient keybase1.GenericClient) *BlockServerRemote {
	bs := &BlockServerRemote{
		config:     config,
		log:        config.MakeLogger(""),
		testClient: testClient,
	}
	return bs
}

// RemoteAddress returns the remote bserver this client is talking to
func (b *BlockServerRemote) RemoteAddress() string {
	return b.blkSrvAddr
}

// OnConnect implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnect(ctx context.Context,
	conn *Connection, client keybase1.GenericClient) error {
	token, err := b.config.KBPKI().GetCurrentToken(ctx)
	if err != nil {
		b.log.CWarningf(ctx, "BlockServerRemote: error getting session %q", err)
		return err
	}

	uid, err := b.config.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		return err
	}

	arg := keybase1.EstablishSessionArg{
		User: uid,
		Sid:  token,
	}

	// save the conn pointer
	b.conn = conn

	b.log.CDebugf(ctx, "BlockServerRemote.OnConnect establish session for "+
		"uid %s\n", uid.String())
	// using conn.DoCommand here would cause problematic recursion
	return runUnlessCanceled(ctx, func() error {
		c := keybase1.BlockClient{Cli: client}
		return c.EstablishSession(arg)
	})
}

// OnConnectError implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnectError(err error, wait time.Duration) {
	b.log.Warning("BlockServerRemote: connection error: %q; retrying in %s",
		err, wait)
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
}

// Helper to return a metadata client.
func (b *BlockServerRemote) client() keybase1.BlockClient {
	if b.testClient != nil {
		// for testing
		return keybase1.BlockClient{Cli: b.testClient}
	}
	return keybase1.BlockClient{Cli: b.conn.GetClient()}
}

// OnDisconnected implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnDisconnected() {
	b.log.Warning("BlockServerRemote is disconnected")
}

// ShouldThrottle implements the ConnectionHandler interface.
func (b *BlockServerRemote) ShouldThrottle(error) bool {
	return false
}

// Helper to call an rpc command.
func (b *BlockServerRemote) doCommand(ctx context.Context, command func() error) error {
	if b.testClient != nil {
		// for testing
		return runUnlessCanceled(ctx, command)
	}
	return b.conn.DoCommand(ctx, command)
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(ctx context.Context, id BlockID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	b.log.CDebugf(ctx, "BlockServerRemote.Get id=%s uid=%s",
		id.String(), context.GetWriter())
	bid := keybase1.BlockIdCombo{
		BlockHash: id.String(),
		ChargedTo: context.GetWriter(),
	}

	var err error
	var res keybase1.GetBlockRes
	err = b.doCommand(ctx, func() error {
		res, err = b.client().GetBlock(bid)
		return err
	})
	if err != nil {
		b.log.CDebugf(ctx, "BlockServerRemote.Get id=%s err=%v",
			id.String(), err)
		return nil, BlockCryptKeyServerHalf{}, err
	}

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
	b.log.CDebugf(ctx, "BlockServerRemote.Put id=%s uid=%s",
		id.String(), context.GetWriter())
	arg := keybase1.PutBlockArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetWriter(),
			BlockHash: id.String(),
		},
		BlockKey: serverHalf.String(),
		Folder:   tlfID.String(),
		Buf:      buf,
	}

	var err error
	err = b.doCommand(ctx, func() error {
		return b.client().PutBlock(arg)
	})

	if err != nil {
		b.log.CDebugf(ctx, "BlockServerRemote.Put id=%s err=%v",
			id.String(), err)
		return err
	}

	return nil
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	b.log.CDebugf(ctx, "BlockServerRemote.AddBlockReference id=%s "+
		"creator=%s uid=%s", id.String(), context.GetCreator(),
		context.GetWriter())
	arg := keybase1.IncBlockReferenceArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetCreator(),
			BlockHash: id.String(),
		},
		Folder:    tlfID.String(),
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
	}
	nonce := context.GetRefNonce()
	copy(arg.Nonce[:], nonce[:])

	var err error
	err = b.doCommand(ctx, func() error {
		return b.client().IncBlockReference(arg)
	})
	if err != nil {
		b.log.CDebugf(ctx, "BlockServerRemote.AddBlockReference id=%s err=%v",
			id.String(), err)
		return err
	}
	return nil
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	b.log.CDebugf(ctx, "BlockServerRemote.RemoveBlockReference id=%s uid=%s",
		id.String(), context.GetWriter())
	arg := keybase1.DecBlockReferenceArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetCreator(),
			BlockHash: id.String(),
		},
		Folder:    tlfID.String(),
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
	}
	nonce := context.GetRefNonce()
	copy(arg.Nonce[:], nonce[:])

	var err error
	err = b.doCommand(ctx, func() error {
		return b.client().DecBlockReference(arg)
	})
	if err != nil {
		b.log.CDebugf(ctx, "BlockServerRemote.RemoveBlockReference id=%s "+
			"err=%v", id.String(), err)
		return err
	}
	return nil
}

// Shutdown implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Shutdown() {
	if b.conn != nil {
		b.conn.Shutdown()
	}
}
