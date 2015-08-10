package libkbfs

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/net/context"
)

const (
	// MDServerReconnectThrottleMinSecs is the min number of seconds to wait before attempting a reconnect.
	MDServerReconnectThrottleMinSecs = 1
	// MDServerReconnectThrottleMaxSecs is the max number of seconds to wait before attempting a reconnect.
	MDServerReconnectThrottleMaxSecs = 30
)

// MDServerRemote is an implementation of the MDServer interface.
type MDServerRemote struct {
	srvAddr               string
	transport             *rpc2.Transport
	client                keybase1.GenericClient
	config                Config
	certs                 *x509.CertPool
	reconnectThrottleSecs int
}

// NewMDServerRemote returns a new instance of MDServerRemote.
func NewMDServerRemote(ctx context.Context, config Config, srvAddr string) (
	*MDServerRemote, error) {
	certs := x509.NewCertPool()
	if !certs.AppendCertsFromPEM(config.CACert()) {
		return nil, errors.New("Unable to load CA certificate")
	}
	mdserver := &MDServerRemote{
		srvAddr: srvAddr,
		config:  config,
		certs:   certs,
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

	if len(md.srvAddr) != 0 {
		// connect to server
		var c net.Conn
		err = runUnlessCanceled(ctx, func() error {
			config := tls.Config{RootCAs: md.certs}
			c, err = tls.Dial("tcp", md.srvAddr, &config)
			if err != nil {
				return err
			}
			return err
		})
		if err != nil {
			return err
		}
		md.transport = rpc2.NewTransport(c, libkb.NewRPCLogFactory(), libkb.WrapError)
		md.client = rpc2.NewClient(md.transport, MDServerUnwrapError)
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

// This method will attempt to reconnect if passed a retrieable error code.
func (md *MDServerRemote) checkReconnect(ctx context.Context, err error) bool {
	if err == nil {
		md.reconnectThrottleSecs = 0
		return false
	}
	_, disconnected := err.(rpc2.DisconnectedError)
	_, eof := err.(rpc2.EofError)
	retry := disconnected || eof
	if retry {
		if md.reconnectThrottleSecs <= 0 {
			md.reconnectThrottleSecs = MDServerReconnectThrottleMinSecs
		} else {
			md.reconnectThrottleSecs *= 2
			if md.reconnectThrottleSecs > MDServerReconnectThrottleMaxSecs {
				md.reconnectThrottleSecs = MDServerReconnectThrottleMaxSecs
			}
		}
		libkb.G.Log.Warning("MDServerRemote: disconnected; retrying in %d seconds",
			md.reconnectThrottleSecs)
		time.Sleep(time.Duration(md.reconnectThrottleSecs) * time.Second)
		md.connect(ctx) // ignore any error, we'll retry
	} else {
		md.reconnectThrottleSecs = 0
	}
	return retry
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
		for true {
			client := keybase1.MetadataClient{Cli: md.client}
			response, err = client.GetMetadata(arg)
			if !md.checkReconnect(ctx, err) {
				break
			}
		}
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
		for true {
			client := keybase1.MetadataClient{Cli: md.client}
			err = client.PutMetadata(rmdsBytes)
			if !md.checkReconnect(ctx, err) {
				break
			}
		}
		return err
	})
}

// PruneUnmerged implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) PruneUnmerged(ctx context.Context, id TlfID) error {
	return runUnlessCanceled(ctx, func() error {
		var err error
		for true {
			client := keybase1.MetadataClient{Cli: md.client}
			err = client.PruneUnmerged(id.String())
			if !md.checkReconnect(ctx, err) {
				break
			}
		}
		return err
	})
}

// RegisterForUpdate implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) RegisterForUpdate(ctx context.Context, id TlfID,
	currHead MetadataRevision) (<-chan error, error) {
	// This could work by a long-poll RPC that runs in a separate
	// goroutine, or by listening as a server on the same RPC
	// connection for an incoming RPC from the MD server.  Either way,
	// it will have to know when the underlying TCP connection goes
	// away so it can fire the observer with an error.
	return nil, nil
}

// GetFavorites implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetFavorites(ctx context.Context) ([]*TlfHandle, error) {
	//XXX mdserver isn't going to support this
	return nil, nil
}
