package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// MDServerRemote is an implementation of the MDServer interface.
type MDServerRemote struct {
	config Config
	conn   *Connection
	log    logger.Logger

	observerMu sync.Mutex // protects observers
	observers  map[TlfID]chan<- error

	testClient keybase1.GenericClient // for testing

	tickerCancel context.CancelFunc
	tickerMu     sync.Mutex // protects the ticker cancel function
}

// Test that MDServerRemote fully implements the MDServer interface.
var _ MDServer = (*MDServerRemote)(nil)

// Test that MDServerRemote fully implements the KeyServer interface.
var _ KeyServer = (*MDServerRemote)(nil)

// NewMDServerRemote returns a new instance of MDServerRemote.
func NewMDServerRemote(ctx context.Context, config Config, srvAddr string) *MDServerRemote {
	mdServer := &MDServerRemote{
		config:    config,
		observers: make(map[TlfID]chan<- error),
		log:       config.MakeLogger(""),
	}
	connection := NewConnection(ctx, config, srvAddr, mdServer, MDServerUnwrapError)
	mdServer.conn = connection
	return mdServer
}

// For testing.
func newMDServerRemoteWithClient(ctx context.Context, config Config,
	testClient keybase1.GenericClient) *MDServerRemote {
	mdServer := &MDServerRemote{
		config:     config,
		testClient: testClient,
		log:        config.MakeLogger(""),
	}
	return mdServer
}

// OnConnect implements the ConnectionHandler interface.
func (md *MDServerRemote) OnConnect(ctx context.Context,
	conn *Connection, client keybase1.GenericClient) error {
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

	// save the conn pointer
	md.conn = conn

	// using conn.DoCommand here would cause problematic recursion
	var pingIntervalSeconds int
	err = runUnlessCanceled(ctx, func() error {
		c := keybase1.MetadataClient{Cli: client}
		pingIntervalSeconds, err = c.Authenticate(creds)
		return err
	})

	// start pinging
	if err == nil {
		md.resetPingTicker(pingIntervalSeconds)
	}
	return err
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
				// wrap with doCommand so failures trigger reconnects
				md.doCommand(ctx, func() error {
					return md.client().Ping()
				})
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

// Helper to return a metadata client.
func (md *MDServerRemote) client() keybase1.MetadataClient {
	if md.testClient != nil {
		// for testing
		return keybase1.MetadataClient{Cli: md.testClient}
	}
	return keybase1.MetadataClient{Cli: md.conn.GetClient()}
}

// Helper to call an rpc command.
func (md *MDServerRemote) doCommand(ctx context.Context, command func() error) error {
	if md.testClient != nil {
		// for testing
		return runUnlessCanceled(ctx, command)
	}

	return md.conn.DoCommand(ctx, command)
}

// Helper used to retrieve metadata blocks from the MD server.
func (md *MDServerRemote) get(ctx context.Context, id TlfID, handle *TlfHandle,
	isUnmerged bool, start, stop MetadataRevision) (TlfID, []*RootMetadataSigned, error) {
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
		Unmerged:      isUnmerged,
		LogTags:       LogTagsFromContextToMap(ctx),
	}
	if id == NullTlfID {
		arg.FolderHandle = handle.ToBytes(md.config)
	} else {
		arg.FolderID = id.String()
	}

	// request
	var err error
	var response keybase1.MetadataResponse
	err = md.doCommand(ctx, func() error {
		response, err = md.client().GetMetadata(arg)
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
func (md *MDServerRemote) GetForHandle(ctx context.Context, handle *TlfHandle, isUnmerged bool) (
	TlfID, *RootMetadataSigned, error) {
	id, rmdses, err := md.get(ctx, NullTlfID, handle, isUnmerged,
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
func (md *MDServerRemote) GetForTLF(ctx context.Context, id TlfID, isUnmerged bool) (
	*RootMetadataSigned, error) {
	_, rmdses, err := md.get(ctx, id, nil, isUnmerged,
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
func (md *MDServerRemote) GetRange(ctx context.Context, id TlfID, isUnmerged bool,
	start, stop MetadataRevision) ([]*RootMetadataSigned, error) {
	_, rmds, err := md.get(ctx, id, nil, isUnmerged, start, stop)
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
	return md.doCommand(ctx, func() error {
		return md.client().PutMetadata(arg)
	})
}

// PruneUnmerged implements the MDServer interface for MDServerRemote.
func (md *MDServerRemote) PruneUnmerged(ctx context.Context, id TlfID) error {
	arg := keybase1.PruneUnmergedArg{
		FolderID: id.String(),
		LogTags:  LogTagsFromContextToMap(ctx),
	}
	return md.doCommand(ctx, func() error {
		return md.client().PruneUnmerged(arg)
	})
}

// MetadataUpdate implements the MetadataUpdateProtocol interface.
func (md *MDServerRemote) MetadataUpdate(arg keybase1.MetadataUpdateArg) error {
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
	err := md.doCommand(ctx, func() error {
		// set up the server to receive updates
		err := md.conn.Serve(keybase1.MetadataUpdateProtocol(md))
		if err != nil {
			return err
		}
		// keep re-adding the observer on retries
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
		err = md.client().RegisterForUpdates(arg)
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
	var keyBytes []byte
	err = md.doCommand(ctx, func() error {
		keyBytes, err = md.client().GetKey(arg)
		return err
	})
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
	return md.doCommand(ctx, func() error {
		return md.client().PutKeys(arg)
	})
}
