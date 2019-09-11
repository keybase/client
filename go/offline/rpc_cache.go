package offline

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type RPCCache struct {
	sync.Mutex
	edb *encrypteddb.EncryptedDB
}

const (
	bestEffortHandlerTimeout = 500 * time.Millisecond
)

func newEncryptedDB(g *libkb.GlobalContext) *encrypteddb.EncryptedDB {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		// Use EncryptionReasonChatLocalStorage for legacy reasons. This
		// function used to use chat/storage.GetSecretBoxKey in the past, and
		// we didn't want users to lose encrypted data after we switched to
		// more generic encrypteddb.GetSecretBoxKey.
		return encrypteddb.GetSecretBoxKey(ctx, g, encrypteddb.DefaultSecretUI,
			libkb.EncryptionReasonChatLocalStorage, "offline rpc cache")
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return encrypteddb.New(g, dbFn, keyFn)
}

func NewRPCCache(g *libkb.GlobalContext) *RPCCache {
	return &RPCCache{
		edb: newEncryptedDB(g),
	}
}

type hashStruct struct {
	UID     keybase1.UID
	RPCName string
	Arg     interface{}
}

func hash(rpcName string, uid keybase1.UID, arg interface{}) ([]byte, error) {
	h := sha256.New()
	raw, err := msgpack.Encode(hashStruct{uid, rpcName, arg})
	if err != nil {
		return nil, err
	}
	_, err = h.Write(raw)
	if err != nil {
		return nil, err
	}
	return h.Sum(nil), nil
}

func dbKey(rpcName string, uid keybase1.UID, arg interface{}) (libkb.DbKey,
	error) {
	raw, err := hash(rpcName, uid, arg)
	if err != nil {
		return libkb.DbKey{}, err
	}
	return libkb.DbKey{
		Typ: libkb.DBOfflineRPC,
		Key: hex.EncodeToString(raw[0:16]),
	}, nil

}

type Version int

type Value struct {
	Version Version
	Data    []byte
}

func (c *RPCCache) get(mctx libkb.MetaContext, version Version, rpcName string, encrypted bool, arg interface{}, res interface{}) (found bool, err error) {
	defer mctx.CTraceString(fmt.Sprintf("RPCCache#get(%d, %s, %v, %+v)", version, rpcName, encrypted, arg), func() string { return fmt.Sprintf("(%v,%v)", found, err) })()
	c.Lock()
	defer c.Unlock()

	dbk, err := dbKey(rpcName, mctx.G().GetMyUID(), arg)
	if err != nil {
		return false, err
	}

	var value Value
	if encrypted {
		found, err = c.edb.Get(mctx.Ctx(), dbk, &value)
	} else {
		found, err = mctx.G().LocalDb.GetIntoMsgpack(&value, dbk)
	}

	if err != nil || !found {
		return found, err
	}

	if value.Version != version {
		mctx.Debug("Found the wrong version (%d != %d) so returning 'not found", value.Version, version)
		return false, nil
	}

	err = msgpack.Decode(res, value.Data)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (c *RPCCache) put(mctx libkb.MetaContext, version Version, rpcName string, encrypted bool, arg interface{}, res interface{}) (err error) {
	defer mctx.Trace(fmt.Sprintf("RPCCache#put(%d, %s, %v, %+v)", version, rpcName, encrypted, arg), func() error { return err })()
	c.Lock()
	defer c.Unlock()

	dbk, err := dbKey(rpcName, mctx.G().GetMyUID(), arg)
	if err != nil {
		return err
	}

	value := Value{Version: version}
	value.Data, err = msgpack.Encode(res)
	if err != nil {
		return err
	}

	if encrypted {
		err = c.edb.Put(mctx.Ctx(), dbk, value)
	} else {
		err = mctx.G().LocalDb.PutObjMsgpack(dbk, nil, value)
	}
	return err
}

// Serve an RPC out of the offline cache. The machinery only kicks
// into gear if the `oa` OfflineAvailability mode is set to
// BEST_EFFORT. If not, then just use the function `handler` which
// does the main work of handling the RPC. Note that `handler` must
// not modify anything in the caller's stack frame; it might be run in
// a background goroutine after this function returns, to populate the
// cache. `handler` also returns the return value for the RPC as an
// interface, so it can be inserted into the offline cache in the
// success case. We also pass this function a `version`, which will
// tell the cache-access machinery to fail if the wrong version of the
// data is cached. Next, we pass the `rpcName`, the argument, and the
// pointer to which the result is stored if we hit the cache.
//
// If this function doesn't return an error, and the returned `res` is
// nil, then `resPtr` will have been filled in already by the cache.
// Otherwise, `res` should be used by the caller as the response.
func (c *RPCCache) Serve(mctx libkb.MetaContext, oa keybase1.OfflineAvailability, version Version, rpcName string, encrypted bool, arg interface{}, resPtr interface{},
	handler func(mctx libkb.MetaContext) (interface{}, error)) (res interface{}, err error) {

	if oa != keybase1.OfflineAvailability_BEST_EFFORT {
		return handler(mctx)
	}
	mctx = mctx.WithLogTag("OFLN")
	defer mctx.Trace(fmt.Sprintf("RPCCache#Serve(%d, %s, %v, %+v)", version, rpcName, encrypted, arg), func() error { return err })()

	found, err := c.get(mctx, version, rpcName, encrypted, arg, resPtr)
	if err != nil {
		return nil, err
	}

	// If we know we're not connected, use the cache value right away.
	// TODO: API calls shouldn't necessarily depend on the
	// connectivity as measured by gregor.
	if mctx.G().ConnectivityMonitor.IsConnected(mctx.Ctx()) == libkb.ConnectivityMonitorNo {
		if !found {
			return nil, libkb.OfflineError{}
		}
		return nil, nil // resPtr was filled in by get()
	}

	type handlerRes struct {
		res interface{}
		err error
	}
	resCh := make(chan handlerRes, 1)

	// New goroutine needs a new metacontext, in case the original
	// gets canceled after the timeout below.  Preserve the log tags
	// though.
	newMctx := mctx.BackgroundWithLogTags()

	// Launch a background goroutine to try to invoke the handler.
	// Even if we hit a timeout below and return the cached value,
	// this goroutine will keep going in an attempt to populate the
	// cache on a slow network.
	go func() {
		res, err := handler(newMctx)
		if err != nil {
			resCh <- handlerRes{res, err}
			return
		}
		tmp := c.put(newMctx, version, rpcName, encrypted, arg, res)
		if tmp != nil {
			newMctx.Warning("Error putting RPC to offline storage: %s", tmp.Error())
		}
		resCh <- handlerRes{res, nil}
	}()

	var timerCh <-chan time.Time
	if found {
		// Use a quick timeout if there's an available cached value.
		timerCh = mctx.G().Clock().After(bestEffortHandlerTimeout)
	} else {
		// Wait indefinitely on the handler if there's nothing in the cache.
		timerCh = make(chan time.Time)
	}
	select {
	case hr := <-resCh:
		// Explicitly return hr.res rather than nil in the err != nil
		// case, because some RPCs might depend on getting a result
		// along with an error.
		return hr.res, hr.err
	case <-timerCh:
		mctx.Debug("Timeout waiting for handler; using cached value instead")
		return res, nil
	case <-mctx.Ctx().Done():
		return nil, mctx.Ctx().Err()
	}
}
