// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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
	skbs      []*libkb.SKB // all skb blocks for local keys
	secui     libkb.SecretUI
	keyOwners map[uint64]*libkb.User // user objects for owners of keys found, for convenience
	me        *libkb.User
	libkb.Contextified
	sync.Mutex // protect keyOwners map
}

const unlockReason = "PGP Decryption"

// enforce ScanKeys implements openpgp.KeyRing:
var _ openpgp.KeyRing = &ScanKeys{}

// NewScanKeys creates a ScanKeys type.  If there is a login
// session, it will load the pgp keys for that user.
func NewScanKeys(secui libkb.SecretUI, g *libkb.GlobalContext) (*ScanKeys, error) {
	sk := &ScanKeys{
		secui:        secui,
		keyOwners:    make(map[uint64]*libkb.User),
		Contextified: libkb.NewContextified(g),
	}
	var err error

	g.Log.Debug("+ NewScanKeys")
	defer func() {
		g.Log.Debug("- NewScanKeys -> %v", err)
	}()

	lin, err := g.LoginState().LoggedInLoad()
	if err != nil {
		return nil, err
	}
	if !lin {
		return sk, nil
	}

	// logged in:

	sk.me, err = libkb.LoadMe(libkb.NewLoadUserArg(sk.G()))
	if err != nil {
		return nil, fmt.Errorf("loadme error: %s", err)
	}

	// if user provided, then load their local keys, and their synced secret key:
	synced, err := sk.me.GetSyncedSecretKey()
	if err != nil {
		return nil, fmt.Errorf("getsyncedsecret err: %s", err)
	}

	aerr := sk.G().LoginState().Account(func(a *libkb.Account) {
		var ring *libkb.SKBKeyringFile
		ring, err = a.Keyring()
		if err != nil {
			return
		}
		err = sk.coalesceBlocks(ring, synced)
	}, "NewScanKeys - coalesceBlocks")
	if aerr != nil {
		return nil, err
	}
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
	primaries := s.unlockByID(id)
	memres := primaries.KeysById(id, fp)
	s.G().Log.Debug("ScanKeys:KeysById(%016x) => %d keys match in memory", id, len(memres))
	if len(memres) > 0 {
		s.G().Log.Debug("ScanKeys:KeysById(%016x) => owner == me (%s)", id, s.me.GetName())
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
		panic(fmt.Sprintf("ScanKeys:  unexpected requiredUsage flags set: %x", requiredUsage))
	}

	// check the local keys first.
	primaries := s.publicByID(id)
	memres := primaries.KeysByIdUsage(id, fp, requiredUsage)
	s.G().Log.Debug("ScanKeys:KeysByIdUsage(%016x, %x) => %d keys match in memory", id, requiredUsage, len(memres))
	if len(memres) > 0 {
		s.G().Log.Debug("ScanKeys:KeysByIdUsage(%016x) => owner == me (%s)", id, s.me.GetName())
		s.Lock()
		s.keyOwners[id] = s.me
		s.Unlock()
		return memres
	}

	// no match, so now lookup the user on the api server by the key id.
	list, err := s.scan(id)
	if err != nil {
		s.G().Log.Debug("error finding keys for %016x: %s", id, err)
		return nil
	}
	// use the list to find the keys correctly
	s.G().Log.Debug("ScanKeys:KeysByIdUsage(%d, %x) => %d keys found via api scan", id, requiredUsage, len(list))
	return list.KeysByIdUsage(id, fp, requiredUsage)
}

// DecryptionKeys returns all private keys that are valid for
// decryption.  It is only used if there is no key id in the
// message.
func (s *ScanKeys) DecryptionKeys() []openpgp.Key {
	s.G().Log.Debug("ScanKeys:DecryptionKeys() => %d keys available", s.Count())
	all := s.unlockAll()
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
func (s *ScanKeys) coalesceBlocks(ring *libkb.SKBKeyringFile, synced *libkb.SKB) error {
	var err error
	s.G().Log.Debug("+ ScanKeys::coalesceBlocks")
	defer func() {
		s.G().Log.Debug("- ScanKeys::coalesceBlocks -> %s", libkb.ErrToOk(err))
	}()

	if synced != nil {
		s.skbs = append(s.skbs, synced)
	}

	for _, b := range ring.Blocks {
		if !libkb.IsPGPAlgo(b.Type) {
			continue
		}
		// make sure uid set on each block:
		b.SetUID(s.me.GetUID())
		s.skbs = append(s.skbs, b)
	}

	return nil
}

// scan finds the user on the api server for the key id.  Then it
// uses PGPKeyfinder to find the public pgp keys for the user.
func (s *ScanKeys) scan(id uint64) (openpgp.EntityList, error) {
	// lookup the user on the api server by the key id.
	username, uid, err := s.apiLookup(id)
	if err != nil {
		return nil, err
	}
	s.G().Log.Debug("key id %016x => %s, %s", id, id, username, uid)
	if len(username) == 0 || len(uid) == 0 {
		return nil, libkb.NoKeyError{}
	}

	// use PGPKeyfinder engine to get the pgp keys for the user
	arg := &PGPKeyfinderArg{Usernames: []string{username}}
	ctx := &Context{}
	eng := NewPGPKeyfinder(arg, s.G())
	if err := RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	uplus := eng.UsersPlusKeys()
	if len(uplus) != 1 {
		s.G().Log.Warning("error getting user plus pgp key from %s", username)
		return nil, err
	}
	// user found is the owner of the keys
	s.G().Log.Debug("scan(%016x) => owner of key = (%s)", id, uplus[0].User.GetName())
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
func (s *ScanKeys) apiLookup(id uint64) (username string, uid keybase1.UID, err error) {
	return libkb.PGPLookup(s.G(), id)
}

func (s *ScanKeys) publicByID(id uint64) openpgp.EntityList {
	var list openpgp.EntityList
	for _, skb := range s.skbs {
		pubkey, err := skb.GetPubKey()
		if err != nil {
			s.G().Log.Warning("error getting pub key from skb: %s", err)
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

func (s *ScanKeys) unlockByID(id uint64) openpgp.EntityList {
	var list openpgp.EntityList
	for _, skb := range s.skbs {
		pubkey, err := skb.GetPubKey()
		if err != nil {
			s.G().Log.Warning("error getting pub key from skb: %s", err)
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
			SecretUI: s.secui,
		}
		unlocked, err := skb.PromptAndUnlock(parg, nil, s.me)
		if err != nil {
			s.G().Log.Warning("error unlocking key: %s", err)
			continue
		}
		unlockedBundle, ok := unlocked.(*libkb.PGPKeyBundle)
		if !ok {
			s.G().Log.Warning("could not convert unlocked key to PGPKeyBundle")
			continue
		}
		list = append(list, unlockedBundle.Entity)
	}
	return list
}

func (s *ScanKeys) unlockAll() openpgp.EntityList {
	var list openpgp.EntityList
	for _, skb := range s.skbs {
		parg := libkb.SecretKeyPromptArg{
			Reason:   unlockReason,
			SecretUI: s.secui,
		}
		unlocked, err := skb.PromptAndUnlock(parg, nil, s.me)
		if err != nil {
			s.G().Log.Warning("error unlocking key: %s", err)
			continue
		}
		unlockedBundle, ok := unlocked.(*libkb.PGPKeyBundle)
		if !ok {
			s.G().Log.Warning("could not convert unlocked key to PGPKeyBundle")
			continue
		}
		list = append(list, unlockedBundle.Entity)
	}
	return list
}
