package engine

import (
	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp"
)

// ScanKeys finds pgp decryption keys in SKB and also if there is
// one stored on the server.  It satisfies the openpgp.KeyRing
// interface.
//
// It is not an engine, but uses an engine and is used by engines,
// so has to be in the engine package.  It is a UIConsumer.
type ScanKeys struct {
	keys  openpgp.EntityList
	secui libkb.SecretUI
	idui  libkb.IdentifyUI
}

// enforce ScanKeys implements openpgp.KeyRing:
var _ openpgp.KeyRing = &ScanKeys{}

func NewScanKeys(u *libkb.User, secui libkb.SecretUI, idui libkb.IdentifyUI) (*ScanKeys, error) {
	if u == nil {
		return nil, libkb.ErrNilUser
	}
	ring, err := G.LoadSKBKeyring(u.GetName())
	if err != nil {
		return nil, err
	}
	synced, err := u.GetSyncedSecretKey()
	if err != nil {
		return nil, err
	}
	sk := &ScanKeys{secui: secui, idui: idui}
	if err := sk.extractKeys(ring, synced, secui); err != nil {
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
	return nil
}

func (s *ScanKeys) Count() int {
	return len(s.keys)
}

// KeysById returns the set of keys that have the given key id.
func (s *ScanKeys) KeysById(id uint64) []openpgp.Key {
	return s.keys.KeysById(id)
}

// KeysByIdAndUsage returns the set of keys with the given id
// that also meet the key usage given by requiredUsage.
// The requiredUsage is expressed as the bitwise-OR of
// packet.KeyFlag* values.
func (s *ScanKeys) KeysByIdUsage(id uint64, requiredUsage byte) []openpgp.Key {
	memres := s.keys.KeysByIdUsage(id, requiredUsage)
	G.Log.Debug("ScanKeys:KeysByIdUsage(%d, %x) => %d keys match in memory", id, requiredUsage, len(memres))

	if len(memres) > 0 {
		return memres
	}

	username, uid, err := s.apiLookup(id)
	if err != nil {
		G.Log.Warning("error looking up key: %s", err)
		return []openpgp.Key{}
	}
	G.Log.Info("key id %d => (%s, %s)", id, username, uid)

	arg := &PGPKeyfinderArg{Users: []string{"uid://" + uid}}
	ctx := &Context{SecretUI: s.secui, IdentifyUI: s.idui}
	eng := NewPGPKeyfinder(arg)
	if err := RunEngine(eng, ctx); err != nil {
		G.Log.Warning("error finding pgp key for %s: %s", username, err)
		return []openpgp.Key{}
	}
	uplus := eng.UsersPlusKeys()
	if len(uplus) != 1 {
		G.Log.Warning("error getting user plus pgp key from %s", username)
		return []openpgp.Key{}
	}

	var list openpgp.EntityList
	for _, k := range uplus[0].Keys {
		list = append(list, (*openpgp.Entity)(k))
	}
	return list.KeysByIdUsage(id, requiredUsage)
}

// DecryptionKeys returns all private keys that are valid for
// decryption.
func (s *ScanKeys) DecryptionKeys() []openpgp.Key {
	return s.keys.DecryptionKeys()
}

func (s *ScanKeys) extractKeys(ring *libkb.SKBKeyringFile, synced *libkb.SKB, ui libkb.SecretUI) error {
	if err := s.extractKey(synced, ui); err != nil {
		return err
	}

	for _, b := range ring.Blocks {
		if err := s.extractKey(b, ui); err != nil {
			return err
		}
	}

	return nil
}

func (s *ScanKeys) extractKey(skb *libkb.SKB, ui libkb.SecretUI) error {
	if skb == nil {
		return nil
	}
	k, err := skb.PromptAndUnlock("", "", ui)
	if err != nil {
		return err
	}
	bundle, ok := k.(*libkb.PgpKeyBundle)
	if ok {
		s.keys = append(s.keys, (*openpgp.Entity)(bundle))
	} else {
		G.Log.Debug("not pgp key: %T", k)
	}
	return nil
}

func (s *ScanKeys) apiLookup(id uint64) (username, uid string, err error) {
	var data struct {
		Username string
		UID      string
	}

	// lookup key on api server
	args := libkb.ApiArg{
		Endpoint: "key/basics",
		Args: libkb.HttpArgs{
			"pgp_key_id": libkb.UHex{Val: id},
		},
	}
	if err = G.API.GetDecode(args, &data); err != nil {
		return "", "", err
	}
	G.Log.Debug("response data: %+v", data)
	return data.Username, data.UID, nil
}
