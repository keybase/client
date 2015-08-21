package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/openpgp"
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
	keys  openpgp.EntityList
	secui libkb.SecretUI
	idui  libkb.IdentifyUI
	opts  *keybase1.TrackOptions
	owner *libkb.User // the owner of the found key(s).  Can be `me` or any other keybase user.
	me    *libkb.User
	libkb.Contextified
}

// enforce ScanKeys implements openpgp.KeyRing:
var _ openpgp.KeyRing = &ScanKeys{}

// NewScanKeys creates a ScanKeys type.  If there is a login
// session, it will load the pgp keys for that user.
func NewScanKeys(secui libkb.SecretUI, idui libkb.IdentifyUI, opts *keybase1.TrackOptions, g *libkb.GlobalContext) (*ScanKeys, error) {
	sk := &ScanKeys{
		secui:        secui,
		idui:         idui,
		opts:         opts,
		Contextified: libkb.NewContextified(g),
	}
	var err error

	g.Log.Debug("+ NewScanKeys")
	defer func() {
		g.Log.Debug("- NewScanKeys -> %s", err)
	}()

	lin, err := g.LoginState().LoggedInLoad()
	if err != nil {
		return nil, err
	}
	if !lin {
		return sk, nil
	}

	// logged in:

	sk.me, err = libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return nil, fmt.Errorf("loadme error: %s", err)
	}

	// if user provided, then load their local keys, and their synced secret key:
	synced, err := sk.me.GetSyncedSecretKey()
	if err != nil {
		return nil, fmt.Errorf("getsyncedsecret err: %s", err)
	}

	aerr := sk.G().LoginState().Account(func(a *libkb.Account) {
		if !a.PassphraseStreamCache().Valid() {
			g.Log.Debug("| NewScanKeys: passphrase stream cache wasn't valid, so bailing out!")
			return
		}
		pps := a.PassphraseStream()
		lks := libkb.NewLKSec(pps, sk.me.GetUID(), sk.G())
		err = lks.Load(a)
		if err != nil {
			// It's ok if lks fails to load.  Probably due to lack of device.
			// This is just a preloaded lksec, and further down the line will
			// handle it.
			sk.G().Log.Debug("No lksec available due to %q error.  Proceeding anyway.", err)
			lks = nil
		}

		var ring *libkb.SKBKeyringFile
		ring, err = a.Keyring()
		if err != nil {
			return
		}
		g.Log.Debug("| NewScanKeys: callling into extractKeys")
		err = sk.extractKeys(a, ring, synced, secui, lks, g)
	}, "NewScanKeys - extractKeys")
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
	return len(s.keys)
}

// KeysById returns the set of keys that have the given key id.
func (s *ScanKeys) KeysById(id uint64) []openpgp.Key {
	memres := s.keys.KeysById(id)
	s.G().Log.Debug("ScanKeys:KeysById(%d) => %d keys match in memory", id, len(memres))
	if len(memres) > 0 {
		s.G().Log.Debug("ScanKeys:KeysById(%d) => owner == me (%s)", id, s.me.GetName())
		s.owner = s.me // `me` is the owner of all s.keys
		return memres
	}

	// no match, so use api server to find keys for this id
	list, err := s.scan(id)
	if err != nil {
		s.G().Log.Warning("error finding keys for %016x: %s", id, err)
		return nil
	}
	s.G().Log.Debug("ScanKeys:KeysById(%d) => %d keys found via api scan", id, len(list))
	return list.KeysById(id)
}

// KeysByIdAndUsage returns the set of keys with the given id
// that also meet the key usage given by requiredUsage.
// The requiredUsage is expressed as the bitwise-OR of
// packet.KeyFlag* values.
func (s *ScanKeys) KeysByIdUsage(id uint64, requiredUsage byte) []openpgp.Key {
	// first, check the keys we already extracted.
	memres := s.keys.KeysByIdUsage(id, requiredUsage)
	s.G().Log.Debug("ScanKeys:KeysByIdUsage(%d, %x) => %d keys match in memory", id, requiredUsage, len(memres))
	if len(memres) > 0 {
		s.G().Log.Debug("ScanKeys:KeysByIdUsage(%d) => owner == me (%s)", id, s.me.GetName())
		s.owner = s.me // `me` is the owner of all s.keys
		return memres
	}

	// no match, so now lookup the user on the api server by the key id.
	list, err := s.scan(id)
	if err != nil {
		s.G().Log.Warning("error finding keys for %016x: %s", err)
		return nil
	}
	// use the list to find the keys correctly
	s.G().Log.Debug("ScanKeys:KeysByIdUsage(%d, %x) => %d keys found via api scan", id, requiredUsage, len(list))
	return list.KeysByIdUsage(id, requiredUsage)
}

// DecryptionKeys returns all private keys that are valid for
// decryption.
func (s *ScanKeys) DecryptionKeys() []openpgp.Key {
	s.G().Log.Debug("ScanKeys:DecryptionKeys() => %d keys available", len(s.keys))
	return s.keys.DecryptionKeys()
}

// Owner returns the owner of the keys found by ScanKeys that were
// used in KeysById or KeysByIdUsage.
func (s *ScanKeys) Owner() *libkb.User {
	return s.owner
}

// extractKeys gets all the private pgp keys out of the ring and
// the synced key.
func (s *ScanKeys) extractKeys(lctx libkb.LoginContext, ring *libkb.SKBKeyringFile, synced *libkb.SKB, ui libkb.SecretUI, lks *libkb.LKSec, g *libkb.GlobalContext) error {
	var err error
	g.Log.Debug("+ ScanKeys::extractKeys")
	defer func() {
		g.Log.Debug("- ScanKeys::extractKeys -> %s", err)
	}()

	if synced == nil {
		g.Log.Debug("| No synced key; so not attempting to extract")
	}
	if err = s.extractKey(lctx, synced, ui, lks); err != nil {
		return fmt.Errorf("extracting synced key error: %s", err)
	}

	for i, b := range ring.Blocks {
		desc, e2 := b.VerboseDescription()
		if e2 == nil {
			g.Log.Debug("| Attempting extract on Key=%s", desc)
		} else {
			g.Log.Debug("| Failed to get description from Key %d", i)
		}
		if !libkb.IsPGPAlgo(b.Type) {
			continue
		}
		if err := s.extractKey(lctx, b, ui, lks); err != nil {
			return fmt.Errorf("extracting ring block error: %s", err)
		}
	}

	return nil
}

// extractKey gets the private key out of skb.  If it's a pgp key,
// it adds it to the keys stored in s.
func (s *ScanKeys) extractKey(lctx libkb.LoginContext, skb *libkb.SKB, ui libkb.SecretUI, lks *libkb.LKSec) error {
	if skb == nil {
		return nil
	}
	k, err := skb.PromptAndUnlock(lctx, "pgp decrypt", "", nil, ui, lks)
	if err != nil {
		return err
	}
	bundle, ok := k.(*libkb.PGPKeyBundle)
	if ok {
		s.keys = append(s.keys, (*openpgp.Entity)(bundle))
	}
	return nil
}

// scan finds the user on the api server for the key id.  Then it
// uses PGPKeyfinder to find the public pgp keys for the user,
// identifying/tracking along the way.
func (s *ScanKeys) scan(id uint64) (openpgp.EntityList, error) {
	// lookup the user on the api server by the key id.
	username, uid, err := s.apiLookup(id)
	if err != nil {
		return nil, err
	}
	s.G().Log.Debug("key id %d (%16x) => %s, %s", id, id, username, uid)
	if len(username) == 0 || len(uid) == 0 {
		s.G().Log.Warning("key id %d (%16x) => %s, %s", id, id, username, uid)
		return nil, libkb.NoKeyError{}
	}

	// use PGPKeyfinder engine to get the pgp keys for the user
	// could use "uid://xxxxxxx" instead of username here, but the log output
	// is more user-friendly with usernames.
	arg := &PGPKeyfinderArg{Users: []string{username}}
	if s.opts != nil {
		arg.TrackOptions = *s.opts
	}
	ctx := &Context{SecretUI: s.secui, IdentifyUI: s.idui}
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
	s.G().Log.Debug("scan(%d) => owner of key = (%s)", id, uplus[0].User.GetName())
	s.owner = uplus[0].User

	// convert the bundles to an openpgp entity list
	// (which implements the openpgp.KeyRing interface)
	var list openpgp.EntityList
	for _, k := range uplus[0].Keys {
		list = append(list, (*openpgp.Entity)(k))
	}
	return list, nil

}

// apiLookup gets the username and uid from the api server for the
// key id.
func (s *ScanKeys) apiLookup(id uint64) (username, uid string, err error) {
	var data struct {
		Username string
		UID      string
	}

	// lookup key on api server
	args := libkb.APIArg{
		Endpoint: "key/basics",
		Args: libkb.HTTPArgs{
			"pgp_key_id": libkb.UHex{Val: id},
		},
	}
	if err = s.G().API.GetDecode(args, &data); err != nil {
		return "", "", err
	}
	return data.Username, data.UID, nil
}
