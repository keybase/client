package libkbfs

import (
	"encoding/hex"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// BlockServerRemote implements the BlockServer interface and
// represents a remote KBFS block server.
type BlockServerRemote struct {
	config     Config
	conn       *Connection
	testClient keybase1.GenericClient // for testing
}

// Test that BlockServerRemote fully implements the BlockServer interface.
var _ BlockServer = (*BlockServerRemote)(nil)

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(ctx context.Context, config Config, blkSrvAddr string) *BlockServerRemote {
	bs := &BlockServerRemote{config: config}
	connection := NewConnection(ctx, config, blkSrvAddr, bs, BServerUnwrapError)
	bs.conn = connection
	return bs
}

// For testing.
func newBlockServerRemoteWithClient(ctx context.Context, config Config,
	testClient keybase1.GenericClient) *BlockServerRemote {
	bs := &BlockServerRemote{config: config, testClient: testClient}
	return bs
}

// OnConnect implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnect(ctx context.Context,
	conn *Connection, client keybase1.GenericClient) error {

	var token string
	var session *libkb.Session
	var err error
	if session, err = b.config.KBPKI().GetSession(ctx); err != nil {
		libkb.G.Log.Warning("BlockServerRemote: error getting session %q", err)
		return err
	} else if session != nil {
		token = session.GetToken()
	}

	var user keybase1.UID
	user, err = b.config.KBPKI().GetLoggedInUser(ctx)
	if err != nil {
		return err
	}

	arg := keybase1.EstablishSessionArg{
		User: user,
		Sid:  token,
	}

	// save the conn pointer
	b.conn = conn

	// using conn.DoCommand here would cause problematic recursion
	return runUnlessCanceled(ctx, func() error {
		c := keybase1.BlockClient{Cli: client}
		return c.EstablishSession(arg)
	})
}

// OnConnectError implements the ConnectionHandler interface.
func (b *BlockServerRemote) OnConnectError(err error, wait time.Duration) {
	libkb.G.Log.Warning("BlockServerRemote: connection error: %q; retrying in %s",
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
	libkb.G.Log.Warning("BlockServerRemote is disconnected\n")
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
	libkb.G.Log.Debug("BlockServerRemote.Get id=%s uid=%s\n",
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
		libkb.G.Log.Debug("BlockServerRemote.Get id=%s err=%v\n", id.String(), err)
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
	libkb.G.Log.Debug("BlockServerRemote.Put id=%s uid=%s\n",
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
		libkb.G.Log.Debug("BlockServerRemote.Put id=%s err=%v\n",
			id.String(), err)
		return err
	}

	return nil
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	libkb.G.Log.Debug("BlockServerRemote.AddBlockReference id=%s creator=%s uid=%s\n",
		id.String(), context.GetCreator(), context.GetWriter())
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
		libkb.G.Log.Debug("BlockServerRemote.AddBlockReference id=%s err=%v", id.String(), err)
		return err
	}
	return nil
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	libkb.G.Log.Debug("BlockServerRemote.RemoveBlockReference id=%s uid=%s\n",
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
		libkb.G.Log.Debug("BlockServerRemote.RemoveBlockReference id=%s err=%v", id.String(), err)
		return err
	}
	return nil
}

// Shutdown implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Shutdown() {
	b.conn.Shutdown()
}
