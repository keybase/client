package libkb

// Provision ourselves or other devices via the various key exchange
// posibilities
type SelfProvisioner struct {
	me        *User
	secretKey *SKB
}

func (sp *SelfProvisioner) LoadMe() (err error) {
	sp.me, err = LoadMe(LoadUserArg{})
	return
}

// CheckProvisionedKey checks the current status of our client, to see if
// it has a provisioned key or not, and if so, whether we have the corresponding
// private key.
func (sp *SelfProvisioner) CheckKeyProvisioned() (err error) {
	var key GenericKey
	var ring *SKBKeyringFile
	if did := G.Env.GetDeviceID(); did == nil {
		err = NotProvisionedError{}
	} else if ring, err = G.LoadSKBKeyring(sp.me.name); err != nil {
	} else if key, err = sp.me.GetComputedKeyFamily().GetSibkeyForDevice(*did); err != nil {
	} else if sp.secretKey = ring.LookupByKid(key.GetKid()); sp.secretKey == nil {
		err = NoSecretKeyError{}
	}
	return
}

// FindBestReprovisionKey finds the best key to use for reprovisioning a device
// if the user's config file was corrupted.  It will look at all active sibkeys,
// and all locally stored and available secret keys, and pick one to use.
func (sp *SelfProvisioner) FindBestReprovisionKey() (ret GenericKey, err error) {
	if sp.me == nil {
		err = InternalError{"no user loaded"}
		return
	}

	ckf := sp.me.GetComputedKeyFamily()
	if ckf == nil {
		err = NoKeyError{"no keys were available"}
		return
	}

	var ring *SKBKeyringFile
	if ring, err = G.LoadSKBKeyring(sp.me.name); err != nil {
		return
	}

	for i := len(ring.Blocks) - 1; i >= 0; i-- {
		if block := ring.Blocks[i]; block == nil {
			continue
		} else if key, e2 := block.GetPubKey(); key == nil || e2 != nil {
			continue
		} else if key2, _, e2 := ckf.FindActiveSibkey(GenericKeyToFOKID(key)); key2 != nil && e2 == nil {
			ret = key
			return
		}
	}

	err = NoSecretKeyError{}
	return
}

// Reprovision fixes a corruption in the user's setup by reprovisioning this user's
// stored private key
func (sp *SelfProvisioner) ReprovisionKey() (err error) {
	var key GenericKey
	if key, err = sp.FindBestReprovisionKey(); err != nil {
		return
	}
	kid := key.GetKid()
	G.Log.Warning("Not setting per-device KID to %s; NOOP due to partial implementation", kid)
	return
}
