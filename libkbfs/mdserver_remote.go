package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// MDServerRemote is an implementation of the MDServer interface.
type MDServerRemote struct {
	config Config
	conn   *Connection
	client keybase1.MetadataClient
	log    logger.Logger

	observerMu sync.Mutex // protects observers
	observers  map[TlfID]chan<- error

	tickerCancel context.CancelFunc
	tickerMu     sync.Mutex // protects the ticker cancel function
}

// Test that MDServerRemote fully implements the MDServer interface.
var _ MDServer = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the KeyServer interface.
var _ KeyServer = (*MDServerRemote)(nil)

// NewMDServerRemote returns a new instance of MDServerRemote.
func NewMDServerRemote(config Config, srvAddr string) *MDServerRemote {
	mdServer := &MDServerRemote{
		config:    config,
		observers: make(map[TlfID]chan<- error),
		log:       config.MakeLogger(""),
	}
	conn := NewTLSConnection(config, srvAddr, MDServerErrorUnwrapper{}, mdServer)
	mdServer.conn = conn
	mdServer.client = keybase1.MetadataClient{Cli: conn.GetClient()}
	return mdServer
}

// OnConnect implements the ConnectionHandler interface.
func (md *MDServerRemote) OnConnect(ctx context.Context,
	conn *Connection, client keybase1.GenericClient,
	_ *rpc.Server) error {
	// get UID, deviceKID and session token
	uid, err := md.config.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		return err
	}
	key, err := md.config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return err
	}
	token, err := md.config.KBPKI().GetCurrentToken(ctx)
	if err != nil {
		md.log.CWarningf(ctx, "MDServerRemote: error getting token %q", err)
		return err
	}

	// authenticate
	creds := keybase1.AuthenticateArg{
		User:      uid,
		DeviceKID: key.KID,
		Sid:       token,
	}

	// Using md.client here would cause problematic recursion.
	c := keybase1.MetadataClient{Cli: cancelableClient{client}}
	pingIntervalSeconds, err := c.Authenticate(ctx, creds)
	if err != nil {
		return err
	}

	// start pinging
	md.resetPingTicker(pingIntervalSeconds)
	return nil
}

// Helper to reset a ping ticker.
func (md *MDServerRemote) resetPingTicker(intervalSeconds int) {
	md.tickerMu.Lock()
	defer md.tickerMu.Unlock()

	if md.tickerCancel != nil {
		md.tickerCancel()
		md.tickerCancel = nil
	}
	if intervalSeconds <= 0 {
		return
	}

	md.log.Debug("MDServerRemote: starting new ping ticker with interval %d",
		intervalSeconds)

	var ctx context.Context
	ctx, md.tickerCancel = context.WithCancel(context.Background())
	go func() {
		ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
		for {
			select {
			case <-ticker.C:
				err := md.client.Ping(ctx)
				if err != nil {
					md.log.Debug("MDServerRemote: ping error %s", err)
				}

			case <-ctx.Done():
				md.log.Debug("MDServerRemote: stopping ping ticker")
				ticker.Stop()
				return
			}
		}
	}()
}

// OnConnectError implements the ConnectionHandler interface.
func (md *MDServerRemote) OnConnectError(err error, wait time.Duration) {
	md.log.Warning("MDServerRemote: connection error: %q; retrying in %s",
		err, wait)
	// TODO: it might make sense to show something to the user if this is
	// due to authentication, for example.
	md.cancelObservers()
	md.resetPingTicker(0)
}

// OnDisconnected implements the ConnectionHandler interface.
func (md *MDServerRemote) OnDisconnected() {
	md.cancelObservers()
	md.resetPingTicker(0)
}

// ShouldThrottle implements the ConnectionHandler interface.
func (md *MDServerRemote) ShouldThrottle(err error) bool {
	if err == nil {
		return false
	}
	_, shouldThrottle := err.(MDServerErrorThrottle)
	return shouldThrottle
}

// Signal errors and clear any registered observers.
func (md *MDServerRemote) cancelObservers() {
	md.observerMu.Lock()
	defer md.observerMu.Unlock()
	// fire errors for any registered observers
	for id, observerChan := range md.observers {
		md.signalObserverLocked(observerChan, id, MDServerDisconnected{})
	}
}

// Signal an observer. The observer lock must be held.
func (md *MDServerRemote) signalObserverLocked(observerChan chan<- error, id TlfID, err error) {
	observerChan <- err
	close(observerChan)
	delete(md.observers, id)
}

// Helper used to retrieve metadata blocks from the MD server.
func (md *MDServerRemote) get(ctx context.Context, id TlfID, handle *TlfHandle,
	mStatus MergeStatus, start, stop MetadataRevision) (
	TlfID, []*RootMetadataSigned, error) {
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
		Unmerged:      mStatus == Unmerged,
		LogTags:       LogTagsFromContextToMap(ctx),
	}
	if id == NullTlfID {
		arg.FolderHandle = handle.ToBytes(md.config)
	} else {
		arg.FolderID = id.String()
	}

	// request
	response, err := md.client.GetMetadata(ctx, arg)
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
func (md *MDServerRemote) GetForHandle(ctx context.Context, handle *TlfHandle,
	mStatus MergeStatus) (TlfID, *RootMetadataSigned, error) {
	id, rmdses, err := md.get(ctx, NullTlfID, handle, mStatus,
		MetadataRevisionUninitialized, MetadataRevisionUninitialized)
	if err != nil {
		return id, nil, err
	}
	if len(rmdses) == 0 {
		return id, nil, nil
	}
	return id, rmdses[0], nil
}

// GetForTLF implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetForTLF(ctx context.Context, id TlfID,
	mStatus MergeStatus) (*RootMetadataSigned, error) {
	_, rmdses, err := md.get(ctx, id, nil, mStatus,
		MetadataRevisionUninitialized, MetadataRevisionUninitialized)
	if err != nil {
		return nil, err
	}
	if len(rmdses) == 0 {
		return nil, nil
	}
	return rmdses[0], nil
}

// GetRange implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) GetRange(ctx context.Context, id TlfID,
	mStatus MergeStatus, start, stop MetadataRevision) (
	[]*RootMetadataSigned, error) {
	_, rmds, err := md.get(ctx, id, nil, mStatus, start, stop)
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
	arg := keybase1.PutMetadataArg{
		MdBlock: rmdsBytes,
		LogTags: LogTagsFromContextToMap(ctx),
	}
	return md.client.PutMetadata(ctx, arg)
}

// PruneUnmerged implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) PruneUnmerged(ctx context.Context, id TlfID) error {
	arg := keybase1.PruneUnmergedArg{
		FolderID: id.String(),
		LogTags:  LogTagsFromContextToMap(ctx),
	}
	return md.client.PruneUnmerged(ctx, arg)
}

// MetadataUpdate implements the MetadataUpdateProtocol interface.
func (md *MDServerRemote) MetadataUpdate(_ context.Context, arg keybase1.MetadataUpdateArg) error {
	id := ParseTlfID(arg.FolderID)
	if id == NullTlfID {
		return MDServerErrorBadRequest{"Invalid folder ID"}
	}

	md.observerMu.Lock()
	defer md.observerMu.Unlock()
	observerChan, ok := md.observers[id]
	if !ok {
		// not registered
		return nil
	}

	// signal that we've seen the update
	md.signalObserverLocked(observerChan, id, nil)
	return nil
}

// RegisterForUpdate implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) RegisterForUpdate(ctx context.Context, id TlfID,
	currHead MetadataRevision) (<-chan error, error) {
	arg := keybase1.RegisterForUpdatesArg{
		FolderID:     id.String(),
		CurrRevision: currHead.Number(),
		LogTags:      LogTagsFromContextToMap(ctx),
	}

	// register
	var c chan error
	err := md.conn.DoCommand(ctx, func(rawClient keybase1.GenericClient) error {
		// set up the server to receive updates, since we may
		// get disconnected between retries.
		server := md.conn.GetServer()
		err := server.Register(keybase1.MetadataUpdateProtocol(md))
		if err != nil {
			if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
				return err
			}
		}
		err = server.Run(true)
		if err != nil {
			return err
		}

		// keep re-adding the observer on retries, since
		// disconnects or connection errors clear observers.
		func() {
			md.observerMu.Lock()
			defer md.observerMu.Unlock()
			if _, ok := md.observers[id]; ok {
				panic(fmt.Sprintf("Attempted double-registration for folder: %s",
					id))
			}
			c = make(chan error, 1)
			md.observers[id] = c
		}()
		// Use this instead of md.client since we're already
		// inside a DoCommand().
		c := keybase1.MetadataClient{Cli: rawClient}
		err = c.RegisterForUpdates(ctx, arg)
		if err != nil {
			func() {
				md.observerMu.Lock()
				defer md.observerMu.Unlock()
				// we could've been canceled by a shutdown so look this up
				// again before closing and deleting.
				if updateChan, ok := md.observers[id]; ok {
					close(updateChan)
					delete(md.observers, id)
				}
			}()
		}
		return err
	})
	if err != nil {
		c = nil
	}

	return c, err
}

// Shutdown implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) Shutdown() {
	// close the connection
	md.conn.Shutdown()
	// cancel pending observers
	md.cancelObservers()
	// cancel the ping ticker
	md.resetPingTicker(0)
}

//
// The below methods support the MD server acting as the key server.
// This will be the case for v1 of KBFS but we may move to our own
// separate key server at some point.
//

// GetTLFCryptKeyServerHalf is an implementation of the KeyServer interface.
func (md *MDServerRemote) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID TLFCryptKeyServerHalfID) (TLFCryptKeyServerHalf, error) {
	// encode the ID
	idBytes, err := md.config.Codec().Encode(serverHalfID)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}

	// get the key
	arg := keybase1.GetKeyArg{
		KeyHalfID: idBytes,
		LogTags:   LogTagsFromContextToMap(ctx),
	}
	keyBytes, err := md.client.GetKey(ctx, arg)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}

	// decode the key
	var serverHalf TLFCryptKeyServerHalf
	err = md.config.Codec().Decode(keyBytes, &serverHalf)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}

	return serverHalf, nil
}

// PutTLFCryptKeyServerHalves is an implementation of the KeyServer interface.
func (md *MDServerRemote) PutTLFCryptKeyServerHalves(ctx context.Context,
	serverKeyHalves map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf) error {
	// flatten out the map into an array
	var keyHalves []keybase1.KeyHalf
	for user, deviceMap := range serverKeyHalves {
		for deviceKID, serverHalf := range deviceMap {
			keyHalf, err := md.config.Codec().Encode(serverHalf)
			if err != nil {
				return err
			}
			keyHalves = append(keyHalves,
				keybase1.KeyHalf{
					User:      user,
					DeviceKID: deviceKID,
					Key:       keyHalf,
				})
		}
	}
	// put the keys
	arg := keybase1.PutKeysArg{
		KeyHalves: keyHalves,
		LogTags:   LogTagsFromContextToMap(ctx),
	}
	return md.client.PutKeys(ctx, arg)
}
