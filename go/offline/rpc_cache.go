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

func (c *RPCCache) get(m libkb.MetaContext, rpcName string, encrypted bool, arg interface{}, res interface{}) (found bool, err error) {
	defer m.CTrace(fmt.Sprintf("RPCCache#get(%s, %v, %+v)", rpcName, encrypted, arg), func() error { return err })()
	c.Lock()
	defer c.Unlock()

	dbk, err := dbKey(rpcName, arg)
	if err != nil {
		return false, err
	}

	if encrypted {
		found, err = c.edb.Get(m.Ctx(), dbk, res)
	} else {
		found, err = m.G().LocalDb.GetInto(res, dbk)
	}
	if err != nil {
		return false, err
	}
	m.CDebugf("Found: %v", found)
	return found, err
}

func (c *RPCCache) put(m libkb.MetaContext, rpcName string, encrypted bool, arg interface{}, res interface{}) (err error) {
	defer m.CTrace(fmt.Sprintf("RPCCache#put(%s, %v, %+v)", rpcName, encrypted, arg), func() error { return err })()
	c.Lock()
	defer c.Unlock()

	dbk, err := dbKey(rpcName, arg)
	if err != nil {
		return err
	}

	if encrypted {
		err = c.edb.Put(m.Ctx(), dbk, res)
	} else {
		err = m.G().LocalDb.PutObj(dbk, nil, res)
	}
	return err
}

func (c *RPCCache) Serve(m libkb.MetaContext, oa keybase1.OfflineAvailability, rpcName string, encrypted bool, arg interface{}, res interface{},
	handler func(m libkb.MetaContext) (interface{}, error)) (err error) {

	if oa == keybase1.OfflineAvailability_NONE {
		_, err := handler(m)
		return err
	}
	m = m.WithLogTag("OFLN")
	defer m.CTrace(fmt.Sprintf("RPCCache#Serve(%s, %v, %+v)", rpcName, encrypted, arg), func() error { return err })()
	if m.G().ConnectivityMonitor.IsConnected(m.Ctx()) == libkb.ConnectivityMonitorNo {
		found, err := c.get(m, rpcName, encrypted, arg, res)
		if err != nil {
			return err
		}
		if !found {
			return libkb.OfflineError{}
		}
		return nil
	}
	res, err = handler(m)
	if err != nil {
		return err
	}
	tmp := c.put(m, rpcName, encrypted, arg, res)
	if tmp != nil {
		m.CWarningf("Error putting RPC to offline storage: %s", tmp.Error())
	}
	return nil
}
