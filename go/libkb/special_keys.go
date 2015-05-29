package libkb

import ()

type SpecialKeyRing struct {

	// Cache of keys that are used in verifying the root
	keys map[PgpFingerprint](*PgpKeyBundle)

	// The only ones allowed for this purpose
	validFingerprints []PgpFingerprint
}

func NewSpecialKeyRing(v []PgpFingerprint) *SpecialKeyRing {
	return &SpecialKeyRing{
		keys:              make(map[PgpFingerprint](*PgpKeyBundle)),
		validFingerprints: v,
	}
}

func (sk *SpecialKeyRing) assertValid(fp PgpFingerprint) error {
	for _, vfp := range sk.validFingerprints {
		if vfp.Eq(fp) {
			return nil
		}
	}
	return WrongKeyError{&sk.validFingerprints[0], &fp}
}

func (sk *SpecialKeyRing) Load(fp PgpFingerprint) (*PgpKeyBundle, error) {

	G.Log.Debug("+ SpecialKeyRing.Load(%s)", fp)

	if err := sk.assertValid(fp); err != nil {
		return nil, err
	}

	key, found := sk.keys[fp]
	if found {
		G.Log.Debug("- SpecialKeyRing.Load(%s) -> hit inmem cache", fp)
		return key, nil
	}

	key, err := fp.LoadFromLocalDb()

	if err != nil || key == nil {

		G.Log.Debug("| Load(%s) going to network", fp)
		var res *ApiRes
		res, err = G.API.Get(ApiArg{
			Endpoint:    "key/special",
			NeedSession: false,
			Args: HttpArgs{
				"fingerprint": S{fp.String()},
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
		G.Log.Debug("| Load(%s) hit DB-backed cache", fp)
	}

	if err == nil && key != nil {
		sk.keys[fp] = key
	}

	G.Log.Debug("- SpecialKeyRing.Load(%s)", fp)

	return key, err
}
