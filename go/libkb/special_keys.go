package libkb

// SpecialKeyRing holds blessed keys, like the one Keybase uses to sign
// its Merkle Root.
type SpecialKeyRing struct {

	// Cache of keys that are used in verifying the root
	keys map[KIDMapKey]GenericKey

	// The only ones allowed for this purpose
	validKIDs map[KIDMapKey]bool
}

// NewSpecialKeyRing allocates a new SpecialKeyRing with the given
// vector of KIDs. For NaCl keys, it will actually import those
// keys into the Keyring.
func NewSpecialKeyRing(v []KID) *SpecialKeyRing {
	ret := &SpecialKeyRing{
		keys:      make(map[KIDMapKey]GenericKey),
		validKIDs: make(map[KIDMapKey]bool),
	}
	for _, kid := range v {
		mapKey := kid.ToMapKey()
		if key, _ := ImportKeypairFromKID(kid); key != nil {
			ret.keys[mapKey] = key
		}
		ret.validKIDs[mapKey] = true
	}
	return ret

}

// IsValidKID returns if this KID is valid (blessed) according to this Keyring
func (sk *SpecialKeyRing) IsValidKID(kid KID) bool {
	val, found := sk.validKIDs[kid.ToMapKey()]
	return val && found
}

// Load takes a blessed KID and returns, if possible, the GenericKey
// associated with that KID, for signature verification. If the key isn't
// found in memory or on disk (in the case of PGP), then it will attempt
// to fetch the key from the keybase server.
func (sk *SpecialKeyRing) Load(kid KID) (GenericKey, error) {

	G.Log.Debug("+ SpecialKeyRing.Load(%s)", kid)

	if !sk.IsValidKID(kid) {
		err := UnknownSpecialKIDError{kid}
		return nil, err
	}

	if key, found := sk.keys[kid.ToMapKey()]; found {
		G.Log.Debug("- SpecialKeyRing.Load(%s) -> hit inmem cache", kid)
		return key, nil
	}

	key, err := kid.LoadPGPKeyFromLocalDB()

	if err != nil || key == nil {

		G.Log.Debug("| Load(%s) going to network", kid)
		var res *ApiRes
		res, err = G.API.Get(ApiArg{
			Endpoint:    "key/special",
			NeedSession: false,
			Args: HttpArgs{
				"kid": S{kid.String()},
			},
		})

		if err == nil {
			key, err = GetOneKey(res.Body.AtKey("bundle"))
		}
		if err == nil {
			if e2 := key.StoreToLocalDb(); e2 != nil {
				G.Log.Warning("Failed to store key: %s", e2.Error())
			}
		}
	} else {
		G.Log.Debug("| Load(%s) hit DB-backed cache", kid)
	}

	if err == nil && key != nil {
		sk.keys[kid.ToMapKey()] = key
	}

	G.Log.Debug("- SpecialKeyRing.Load(%s)", kid)

	return key, err
}
