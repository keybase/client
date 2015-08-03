package libkbfs

import (
	"net"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/net/context"
)

// MDServerRemote is an implementation of the MDServer interface.
type MDServerRemote struct {
	srvAddr string
	client  keybase1.GenericClient
	config  Config
}

// NewMDServerRemote returns a new instance of MDServerRemote.
func NewMDServerRemote(ctx context.Context, config Config, srvAddr string) (
	*MDServerRemote, error) {
	// connect to server XXX TODO: need to handle reconnects+tls
	c, err := net.Dial("tcp", srvAddr)
	if err != nil {
		return nil, err
	}
	transport := rpc2.NewTransport(c, libkb.NewRPCLogFactory(), libkb.WrapError)
	client := rpc2.NewClient(transport, MDServerUnwrapError)

	mdserver := &MDServerRemote{
		srvAddr: srvAddr,
		client:  client,
		config:  config,
	}
	return mdserver, mdserver.connect(ctx)
}

// This is for testing only.
func newMDServerRemoteWithClient(ctx context.Context, config Config,
	client keybase1.GenericClient) (*MDServerRemote, error) {
	mdserver := &MDServerRemote{
		client: client,
		config: config,
	}
	return mdserver, mdserver.connect(ctx)
}

func (md *MDServerRemote) connect(ctx context.Context) error {
	// get UID, deviceKID and session token
	var err error
	var user keybase1.UID
	user, err = md.config.KBPKI().GetLoggedInUser(ctx)
	if err != nil {
		return err
	}
	var key CryptPublicKey
	key, err = md.config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return err
	}
	var token string
	var session *libkb.Session
	session, err = md.config.KBPKI().GetSession(ctx)
	if err != nil {
		libkb.G.Log.Warning("MDServerRemote: error getting session %q", err)
		return err
	} else if session != nil {
		token = session.GetToken()
	}

	// authenticate
	creds := keybase1.AuthenticateArg{
		User:      user,
		DeviceKID: key.KID,
		Sid:       token,
	}
	err = runUnlessCanceled(ctx, func() error {
		client := keybase1.MetadataClient{Cli: md.client}
		return client.Authenticate(creds)
	})
	if err != nil {
		return err
	}
	return nil
}

// Helper used to retrieve metadata blocks from the MD server.
func (md *MDServerRemote) get(ctx context.Context, id TlfID, handle *TlfHandle,
	unmerged bool, start, stop MetadataRevision) (TlfID, []*RootMetadataSigned, error) {
	// figure out which args to send
	if id == NullTlfID && handle == nil {
		return id, nil, MDInvalidGetArguments{
			id:     id,
			handle: handle,
		}
	}
	arg := keybase1.GetMetadataArg{
		StartRevision: start.Number(),
		StopRevision:  stop.Number(),
		Unmerged:      unmerged,
	}
	if id == NullTlfID {
		arg.FolderHandle = handle.ToBytes(md.config)
	} else {
		arg.FolderID = id.String()
	}

	// request
	var response keybase1.MetadataResponse
	err := runUnlessCanceled(ctx, func() error {
		var err error
		client := keybase1.MetadataClient{Cli: md.client}
		response, err = client.GetMetadata(arg)
		return err
	})
	if err != nil {
		return id, nil, err
	}

	// response
	id = ParseTlfID(response.FolderID)
	if id == NullTlfID {
		return id, nil, MDInvalidTlfID{response.FolderID}
	}

	// deserialize blocks
	rmdses := make([]*RootMetadataSigned, len(response.MdBlocks))
	for i := range response.MdBlocks {
		var rmds RootMetadataSigned
		err = md.config.Codec().Decode(response.MdBlocks[i], &rmds)
		if err != nil {
			return id, rmdses, err
		}
		rmdses[i] = &rmds
	}
	return id, rmdses, nil
}

// GetForHandle implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetForHandle(ctx context.Context, handle *TlfHandle, unmerged bool) (
	TlfID, *RootMetadataSigned, error) {
	id, rmdses, err := md.get(ctx, NullTlfID, handle, unmerged,
		MetadataRevisionHead, MetadataRevisionHead)
	if err != nil {
		return id, nil, err
	}
	if rmdses == nil || len(rmdses) == 0 {
		return id, nil, nil
	}
	return id, rmdses[0], nil
}

// GetForTLF implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetForTLF(ctx context.Context, id TlfID, unmerged bool) (
	*RootMetadataSigned, error) {
	_, rmdses, err := md.get(ctx, id, nil, unmerged, MetadataRevisionHead, MetadataRevisionHead)
	if err != nil {
		return nil, err
	}
	if rmdses == nil || len(rmdses) == 0 {
		return nil, nil
	}
	return rmdses[0], nil
}

// GetRange implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetRange(ctx context.Context, id TlfID, unmerged bool,
	start, stop MetadataRevision) ([]*RootMetadataSigned, error) {
	_, rmds, err := md.get(ctx, id, nil, unmerged, start, stop)
	return rmds, err
}

// Put implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) Put(ctx context.Context, rmds *RootMetadataSigned) error {
	// encode MD block
	rmdsBytes, err := md.config.Codec().Encode(rmds)
	if err != nil {
		return err
	}
	// put request
	return runUnlessCanceled(ctx, func() error {
		client := keybase1.MetadataClient{Cli: md.client}
		return client.PutMetadata(rmdsBytes)
	})
}

// PruneUnmerged implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) PruneUnmerged(ctx context.Context, id TlfID) error {
	return runUnlessCanceled(ctx, func() error {
		client := keybase1.MetadataClient{Cli: md.client}
		return client.PruneUnmerged(id.String())
	})
}

// GetFavorites implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetFavorites(ctx context.Context) ([]*TlfHandle, error) {
	//XXX mdserver isn't going to support this
	return nil, nil
}
