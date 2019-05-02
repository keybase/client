// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/packet"
)

// ScanKeys finds pgp decryption keys in SKB and also if there is
// one stored on the server.  It satisfies the openpgp.KeyRing
// interface.
//
// It also will find public pgp keys for signature verification.
//
// It is not an engine, but uses an engine and is used by engines,
// so has to be in the engine package.  It is a UIConsumer.
type ScanKeys struct {
	// keys  openpgp.EntityList
	skbs       []*libkb.SKB           // all skb blocks for local keys
	keyOwners  map[uint64]*libkb.User // user objects for owners of keys found, for convenience
	me         *libkb.User
	sync.Mutex // protect keyOwners map
	libkb.MetaContextified
}

const unlockReason = "PGP Decryption"

// enforce ScanKeys implements openpgp.KeyRing:
var _ openpgp.KeyRing = &ScanKeys{}

// NewScanKeys creates a ScanKeys type.  If there is a login
// session, it will load the pgp keys for that user.
func NewScanKeys(m libkb.MetaContext) (sk *ScanKeys, err error) {
	sk = &ScanKeys{
		keyOwners:        make(map[uint64]*libkb.User),
		MetaContextified: libkb.NewMetaContextified(m),
	}

	defer m.Trace("NewScanKeys", func() error { return err })()

	var loggedIn bool
	loggedIn, err = isLoggedInWithError(m)
	if err != nil {
		return nil, err
	}
	if !loggedIn {
		return sk, nil
	}

	sk.me, err = libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return nil, fmt.Errorf("loadme error: %s", err)
	}

	// if user provided, then load their local keys, and their synced secret keys:
	synced, err := sk.me.GetSyncedSecretKeys(m)
	if err != nil {
		return nil, fmt.Errorf("getsyncedsecret err: %s", err)
	}

	ring, err := m.ActiveDevice().Keyring(m)
	if err != nil {
		return nil, err
	}
	err = sk.coalesceBlocks(m, ring, synced)
	if err != nil {
		return nil, err
	}
	return sk, nil
}

func (s *ScanKeys) Name() string {
	return "ScanKeys"
}

func (s *ScanKeys) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.SecretUIKind}
}

func (s *ScanKeys) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PGPKeyfinder{},
	}
}

// Count returns the number of local keys available.
func (s *ScanKeys) Count() int {
	return len(s.skbs)
}

// KeysById returns the set of keys that have the given key id.
// It is only called during decryption by openpgp.
func (s *ScanKeys) KeysById(id uint64, fp []byte) []openpgp.Key {
	m := s.M()
	primaries := s.unlockByID(m, id)
	memres := primaries.KeysById(id, fp)
	m.Debug("ScanKeys:KeysById(%016x) => %d keys match in memory", id, len(memres))
	if len(memres) > 0 {
		m.Debug("ScanKeys:KeysById(%016x) => owner == me (%s)", id, s.me.GetName())
		s.Lock()
		s.keyOwners[id] = s.me
		s.Unlock()
		return memres
	}

	// KeysById is only used for decryption, so getting public keys from
	// API server via s.scan(id) is pointless, so just returning nil.
	return nil
}

// KeysByIdAndUsage returns the set of public keys with the given
// id that also meet the key usage given by requiredUsage.
//
// The requiredUsage is expressed as the bitwise-OR of
// packet.KeyFlag* values.
//
// It is only called during signature verification so therefore
// requiredUsage will only equal KeyFlagSign, thus only public
// keys are required.  If this ever changes upstream in openpgp,
// this function will panic.
//
func (s *ScanKeys) KeysByIdUsage(id uint64, fp []byte, requiredUsage byte) []openpgp.Key {
	if requiredUsage != packet.KeyFlagSign {
		panic(fmt.Sprintf("ScanKeys: unexpected requiredUsage flags set: %x", requiredUsage))
	}

	m := s.M()

	// check the local keys first.
	primaries := s.publicByID(m, id)
	memres := primaries.KeysByIdUsage(id, fp, requiredUsage)
	m.Debug("ScanKeys#KeysByIdUsage(%016x, %x) => %d keys match in memory", id, requiredUsage, len(memres))
	if len(memres) > 0 {
		m.Debug("ScanKeys#KeysByIdUsage(%016x) => owner == me (%s)", id, s.me.GetName())
		s.Lock()
		s.keyOwners[id] = s.me
		s.Unlock()
		return memres
	}

	// no match, so now lookup the user on the api server by the key id.
	list, err := s.scan(m, id)
	if err != nil {
		m.Debug("error finding keys for %016x: %s", id, err)
		return nil
	}
	// use the list to find the keys correctly
	m.Debug("ScanKeys#KeysByIdUsage(%d, %x) => %d keys found via api scan", id, requiredUsage, len(list))
	return list.KeysByIdUsage(id, fp, requiredUsage)
}

// DecryptionKeys returns all private keys that are valid for
// decryption.  It is only used if there is no key id in the
// message.
func (s *ScanKeys) DecryptionKeys() []openpgp.Key {
	m := s.M()
	m.Debug("ScanKeys#DecryptionKeys() => %d keys available", s.Count())
	all := s.unlockAll(m)
	return all.DecryptionKeys()
}

// KeyOwner returns the owner of the keys found by ScanKeys that were
// used in KeysById or KeysByIdUsage, indexed by keyID.
func (s *ScanKeys) KeyOwner(keyID uint64) *libkb.User {
	s.Lock()
	defer s.Unlock()

	return s.keyOwners[keyID]
}

func (s *ScanKeys) KeyOwnerByEntity(entity *openpgp.Entity) *libkb.User {
	s.Lock()
	defer s.Unlock()

	if entity == nil {
		return nil
	}
	if u, found := s.keyOwners[entity.PrimaryKey.KeyId]; found {
		return u
	}
	for _, subKey := range entity.Subkeys {
		if u, found := s.keyOwners[subKey.PublicKey.KeyId]; found {
			return u
		}
	}
	return nil
}

// coalesceBlocks puts the synced pgp key block and all the pgp key
// blocks in ring into s.skbs.
func (s *ScanKeys) coalesceBlocks(m libkb.MetaContext, ring *libkb.SKBKeyringFile, synced []*libkb.SKB) (err error) {
	defer m.Trace("ScanKeys#coalesceBlocks", func() error { return err })()

	// We want keys in this order: first local keyring keys that are LKSec, and
	// then server synced keys that are triplesec. In ScanKeys.KeysById, this
	// allows us to prompt for passphrase once and get both passphrase stream
	// cache and triplesec cache the moment first LKSec key is processed by
	// SKB.UnlockSecretKey.

	// If they were in different order and we got triplesec bundle first, we
	// would prompt for passphrase to get triplesec stream, and then prompt
	// again to get passphrase stream to unlock LKSec bundle, prompting twice
	// in total (assuming someone has both a server-synced bundle and local
	// one).

	for _, b := range ring.Blocks {
		if !libkb.IsPGPAlgo(b.Type) {
			continue
		}
		// make sure uid set on each block:
		b.SetUID(s.me.GetUID())
		s.skbs = append(s.skbs, b)
	}

	s.skbs = append(s.skbs, synced...)

	return nil
}

// scan finds the user on the api server for the key id.  Then it
// uses PGPKeyfinder to find the public pgp keys for the user.
func (s *ScanKeys) scan(m libkb.MetaContext, id uint64) (openpgp.EntityList, error) {
	// lookup the user on the api server by the key id.
	username, uid, err := s.apiLookup(m, id)
	if err != nil {
		return nil, err
	}
	m.Debug("key id %016x => %s, %s", id, id, username, uid)
	if len(username) == 0 || len(uid) == 0 {
		return nil, libkb.NoKeyError{}
	}

	// use PGPKeyfinder engine to get the pgp keys for the user
	arg := &PGPKeyfinderArg{Usernames: []string{username}}
	eng := NewPGPKeyfinder(m.G(), arg)
	if err := RunEngine2(m, eng); err != nil {
		return nil, err
	}
	uplus := eng.UsersPlusKeys()
	if len(uplus) != 1 {
		m.Warning("error getting user plus pgp key from %s", username)
		return nil, err
	}
	// user found is the owner of the keys
	m.Debug("scan(%016x) => owner of key = (%s)", id, uplus[0].User.GetName())
	s.Lock()
	s.keyOwners[id] = uplus[0].User
	s.Unlock()

	// convert the bundles to an openpgp entity list
	// (which implements the openpgp.KeyRing interface)
	var list openpgp.EntityList
	for _, k := range uplus[0].Keys {
		list = append(list, k.Entity)
	}
	return list, nil
}

// apiLookup gets the username and uid from the api server for the
// key id.
func (s *ScanKeys) apiLookup(m libkb.MetaContext, id uint64) (username string, uid keybase1.UID, err error) {
	return libkb.PGPLookup(m, id)
}

func (s *ScanKeys) publicByID(m libkb.MetaContext, id uint64) openpgp.EntityList {
	var list openpgp.EntityList
	for _, skb := range s.skbs {
		pubkey, err := skb.GetPubKey()
		if err != nil {
			m.Warning("error getting pub key from skb: %s", err)
			continue
		}
		bundle, ok := pubkey.(*libkb.PGPKeyBundle)
		if !ok {
			continue
		}
		if len(bundle.KeysById(id, nil)) == 0 {
			// no match
			continue
		}
		list = append(list, bundle.Entity)
	}
	return list
}

func (s *ScanKeys) unlockByID(m libkb.MetaContext, id uint64) openpgp.EntityList {
	var list openpgp.EntityList
	for _, skb := range s.skbs {
		pubkey, err := skb.GetPubKey()
		if err != nil {
			m.Warning("error getting pub key from skb: %s", err)
			continue
		}
		bundle, ok := pubkey.(*libkb.PGPKeyBundle)
		if !ok {
			continue
		}
		if len(bundle.KeysById(id, nil)) == 0 {
			// no match
			continue
		}

		// some key in the bundle matched, so unlock everything:
		parg := libkb.SecretKeyPromptArg{
			Reason:   unlockReason,
			SecretUI: m.UIs().SecretUI,
		}
		secretStore := libkb.NewSecretStore(m.G(), s.me.GetNormalizedName())
		unlocked, err := skb.PromptAndUnlock(m, parg, secretStore, s.me)
		if err != nil {
			m.Warning("error unlocking key: %s", err)
			continue
		}
		unlockedBundle, ok := unlocked.(*libkb.PGPKeyBundle)
		if !ok {
			m.Warning("could not convert unlocked key to PGPKeyBundle")
			continue
		}
		list = append(list, unlockedBundle.Entity)
	}
	return list
}

func (s *ScanKeys) unlockAll(m libkb.MetaContext) openpgp.EntityList {
	var list openpgp.EntityList
	for _, skb := range s.skbs {
		parg := libkb.SecretKeyPromptArg{
			Reason:   unlockReason,
			SecretUI: m.UIs().SecretUI,
		}
		secretStore := libkb.NewSecretStore(m.G(), s.me.GetNormalizedName())
		unlocked, err := skb.PromptAndUnlock(m, parg, secretStore, s.me)
		if err != nil {
			m.Warning("error unlocking key: %s", err)
			continue
		}
		unlockedBundle, ok := unlocked.(*libkb.PGPKeyBundle)
		if !ok {
			m.Warning("could not convert unlocked key to PGPKeyBundle")
			continue
		}
		list = append(list, unlockedBundle.Entity)
	}
	return list
}
