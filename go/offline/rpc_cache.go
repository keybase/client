package offline

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"sync"
)

type RPCCache struct {
	sync.Mutex
	edb *encrypteddb.EncryptedDB
}

func newEncryptedDB(g *libkb.GlobalContext) *encrypteddb.EncryptedDB {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g, storage.DefaultSecretUI)
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

func hash(rpcName string, arg interface{}) ([]byte, error) {
	h := sha256.New()
	h.Write([]byte(rpcName))
	h.Write([]byte{0})
	raw, err := libkb.MsgpackEncode(arg)
	if err != nil {
		return nil, err
	}
	h.Write(raw)
	return h.Sum(nil), nil
}

func dbKey(rpcName string, arg interface{}) (libkb.DbKey, error) {
	raw, err := hash(rpcName, arg)
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

	dbk, err := dbKey(rpcName, arg)
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

	err = libkb.MsgpackDecode(res, value.Data)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (c *RPCCache) put(mctx libkb.MetaContext, version Version, rpcName string, encrypted bool, arg interface{}, res interface{}) (err error) {
	defer mctx.Trace(fmt.Sprintf("RPCCache#put(%d, %s, %v, %+v)", version, rpcName, encrypted, arg), func() error { return err })()
	c.Lock()
	defer c.Unlock()

	dbk, err := dbKey(rpcName, arg)
	if err != nil {
		return err
	}

	value := Value{Version: version}
	value.Data, err = libkb.MsgpackEncode(res)
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
// pointer to which the result is stored if we hit the cache. This
// flow is unfortunately complicated, but the issue is that we're
// trying to maintain runtime type checking, and it's hard to do
// without generics.
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
	if mctx.G().ConnectivityMonitor.IsConnected(mctx.Ctx()) == libkb.ConnectivityMonitorNo {
		found, err := c.get(mctx, version, rpcName, encrypted, arg, resPtr)
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, libkb.OfflineError{}
		}
		return nil, nil
	}
	res, err = handler(mctx)
	if err != nil {
		return nil, err
	}
	tmp := c.put(mctx, version, rpcName, encrypted, arg, res)
	if tmp != nil {
		mctx.Warning("Error putting RPC to offline storage: %s", tmp.Error())
	}
	return res, nil
}
