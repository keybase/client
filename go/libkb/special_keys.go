package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

// SpecialKeyRing holds blessed keys, like the one Keybase uses to sign
// its Merkle Root.
type SpecialKeyRing struct {

	// Cache of keys that are used in verifying the root
	keys map[keybase1.KID]GenericKey

	// The only ones allowed for this purpose
	validKIDs map[keybase1.KID]bool
}

// NewSpecialKeyRing allocates a new SpecialKeyRing with the given
// vector of KIDs. For NaCl keys, it will actually import those
// keys into the Keyring.
func NewSpecialKeyRing(v []keybase1.KID) *SpecialKeyRing {
	ret := &SpecialKeyRing{
		keys:      make(map[keybase1.KID]GenericKey),
		validKIDs: make(map[keybase1.KID]bool),
	}
	for _, kid := range v {
		if key, _ := ImportKeypairFromKID(kid); key != nil {
			ret.keys[kid] = key
		}
		ret.validKIDs[kid] = true
	}
	return ret

}

// IsValidKID returns if this KID is valid (blessed) according to this Keyring
func (sk *SpecialKeyRing) IsValidKID(kid keybase1.KID) bool {
	val, found := sk.validKIDs[kid]
	return val && found
}

func LoadPGPKeyFromLocalDB(k keybase1.KID) (*PGPKeyBundle, error) {
	dbobj, err := G.LocalDb.Get(DbKey{
		Typ: DBPGPKey,
		Key: k.String(),
	})
	if err != nil {
		return nil, err
	}
	if dbobj == nil {
		return nil, nil
	}
	return GetOneKey(dbobj)
}

// Load takes a blessed KID and returns, if possible, the GenericKey
// associated with that KID, for signature verification. If the key isn't
// found in memory or on disk (in the case of PGP), then it will attempt
// to fetch the key from the keybase server.
func (sk *SpecialKeyRing) Load(kid keybase1.KID) (GenericKey, error) {

	G.Log.Debug("+ SpecialKeyRing.Load(%s)", kid)

	if !sk.IsValidKID(kid) {
		err := UnknownSpecialKIDError{kid}
		return nil, err
	}

	if key, found := sk.keys[kid]; found {
		G.Log.Debug("- SpecialKeyRing.Load(%s) -> hit inmem cache", kid)
		return key, nil
	}

	key, err := LoadPGPKeyFromLocalDB(kid)

	if err != nil || key == nil {

		G.Log.Debug("| Load(%s) going to network", kid)
		var res *APIRes
		res, err = G.API.Get(APIArg{
			Endpoint:    "key/special",
			NeedSession: false,
			Args: HTTPArgs{
				"kid": S{kid.String()},
			},
		})

		if err == nil {
			key, err = GetOneKey(res.Body.AtKey("bundle"))
		}
		if err == nil {
			if e2 := key.StoreToLocalDb(); e2 != nil {
				G.Log.Warning("Failed to store key: %s", e2)
			}
		}
	} else {
		G.Log.Debug("| Load(%s) hit DB-backed cache", kid)
	}

	if err == nil && key != nil {
		sk.keys[kid] = key
	}

	G.Log.Debug("- SpecialKeyRing.Load(%s)", kid)

	return key, err
}
