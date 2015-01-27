// A module for syncing secrets with the server, such as P3SKB PGP keys,
// and server-halves of our various secret keys.
package libkb

import (
	"fmt"
	"sync"
)

type ServerPrivateKey struct {
	Kid     string `json:"kid"`
	KeyType int    `json:"key_type"`
	Bundle  string `json:"bundle"`
	Mtime   int    `json:"mtime"`
	Ctime   int    `json:"ctime"`
	KeyBits int    `json:"key_bits"`
	KeyAlgo int    `json:"key_algo"`
}

type ServerPrivateKeyMap map[string]ServerPrivateKey

type ServerPrivateKeys struct {
	Status      ApiStatus           `json:"status"`
	Version     int                 `json:"version"`
	Mtime       *int                `json:"mtime"`
	PrivateKeys ServerPrivateKeyMap `json:"private_keys"`
}

type SecretSyncer struct {
	// Locks the whole object
	sync.Mutex
	Uid    *UID
	loaded bool
	dirty  bool
	keys   ServerPrivateKeys
}

// Load loads a set of secret keys from storage and then checks if there are
// updates on the server.  If there are, it will sync and store them.
func (ss *SecretSyncer) Load(uid UID) (err error) {

	ss.Lock()
	defer ss.Unlock()

	uid_s := uid.String()

	G.Log.Debug("+ SecretSyncer.Load(%s)", uid_s)
	defer func() {
		G.Log.Debug("- SecretSyncer.Load(%s) -> %s", uid_s, ErrToOk(err))
	}()

	if ss.Uid != nil && !ss.Uid.Eq(uid) {
		err = UidMismatchError{fmt.Sprintf("%s != %s", ss.Uid, uid)}
		return
	}
	ss.Uid = &uid

	if err = ss.loadFromStorage(); err != nil {
		return
	}
	if err = ss.syncFromServer(); err != nil {
		return
	}
	if err = ss.store(); err != nil {
		return
	}
	return
}

func (ss *SecretSyncer) loadFromStorage() (err error) {
	ss.loaded, err = G.LocalDb.GetInto(&ss.keys, ss.dbKey())
	G.Log.Debug("| loadFromStorage -> %v, %s", ss.loaded, ErrToOk(err))
	if ss.loaded {
		G.Log.Debug("| Loaded version %d", ss.keys.Version)
	}
	return
}

func (ss *SecretSyncer) syncFromServer() (err error) {
	hargs := HttpArgs{}
	if ss.loaded {
		hargs.Add("version", I{ss.keys.Version})
	}
	var res *ApiRes
	res, err = G.API.Get(ApiArg{
		Endpoint:    "key/fetch_private",
		Args:        hargs,
		NeedSession: true,
	})
	G.Log.Debug("| syncFromServer -> %s", ErrToOk(err))
	if err != nil {
		return
	}

	var obj ServerPrivateKeys
	if err = res.Body.UnmarshalAgain(&obj); err != nil {
		return
	}

	if !ss.loaded || obj.Version > ss.keys.Version {
		G.Log.Debug("| upgrade to version -> %d", obj.Version)
		ss.keys = obj
		ss.dirty = true
	}
	ss.loaded = true
	return
}

func (ss *SecretSyncer) dbKey() DbKey {
	return DbKey{Typ: DB_USER_SECRET_KEYS, Key: ss.Uid.String()}
}

func (ss *SecretSyncer) store() (err error) {
	if !ss.dirty {
		return
	}
	if err = G.LocalDb.PutObj(ss.dbKey(), nil, ss.keys); err != nil {
		return
	}
	ss.dirty = false
	return
}

// FindActiveKey examines the synced keys, looking for one that's currently active.
// Returns ret=nil if none was found.
func (ss *SecretSyncer) FindActiveKey(ckf *ComputedKeyFamily) (ret *P3SKB, err error) {
	for _, key := range ss.keys.PrivateKeys {
		if ret, _ = key.FindActiveKey(ckf); ret != nil {
			return
		}
	}
	return
}

func (k *ServerPrivateKey) FindActiveKey(ckf *ComputedKeyFamily) (ret *P3SKB, err error) {
	var kid KID
	var packet *KeybasePacket

	if kid, err = ImportKID(k.Kid); err != nil {
		return
	}
	if ckf.IsKidActive(kid) != DLG_SIBKEY {
		return
	}
	if packet, err = DecodeArmoredPacket(k.Bundle); err != nil && packet == nil {
		return
	}
	return packet.ToP3SKB()
}
