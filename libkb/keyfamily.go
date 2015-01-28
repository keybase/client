// A KeyFamily is a group of sibling keys that have equal power for a user.
// A family can consist of 1 PGP keys, and arbitrarily many NaCl Sibkeys.
// There also can be some subkeys dangling off for ECDH.
package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
	"time"
)

type KeyStatus int

// We have two notions of time we can use -- standard UTC which might
// be screwy (skewy) based upon local clock problems; or MerkleRoot seqno,
// which is totally ordered and all clients and server ought to agree on it.
// The issue is that we're not uniformly signing Merkle roots into signatures,
// especially those generated on the Web site.
type KeybaseTime struct {
	Unix  int64 // UTC wallclock time
	Chain int   // Merkle root chain time
}

type ComputedKeyInfo struct {
	Status int
	Eldest bool
	Sibkey bool

	// Map of SigId -> KID, both as hex strings
	// (since we can't unmarhsal into KIDs)
	Delegations map[string]string
	DelegatedAt *KeybaseTime
	RevokedAt   *KeybaseTime
}

// As returned by user/lookup.json
type ServerKeyRecord struct {
	Kid            string  `json:"kid"`
	KeyType        int     `json:"key_type"`
	Bundle         string  `json:"bundle"`
	Mtime          int     `json:"mtime"`
	Ctime          int     `json:"ctime"`
	Etime          int     `json:"etime"`
	PgpFingerprint string  `json:"key_fingerprint"`
	SigningKid     *string `json:"signing_kid"`
	EldestKid      *string `json:"eldest_kid"`
	KeyLevel       int     `json:"key_level"`
	Status         int     `json:"status"`
	KeyBits        int     `json:"key_bits"`
	KeyAlgo        int     `json:"key_algo"a`

	key GenericKey `json:-`
}

type KeyMap map[string]*ServerKeyRecord

// When we play a sigchain forward, it yields ComputedKeyInfos (CKIs). We're going to
// store CKIs separately from the keys, since the server can clobber the
// former.  We should rewrite CKIs every time we (re)check a user's SigChain
type ComputedKeyInfos struct {
	dirty bool // whether it needs to be written to disk or not

	// Map of KID (in HEX) to a computed info
	Infos map[string]*ComputedKeyInfo

	// Map of a SigId (in Binary) to the ComputedKeyInfo describing when the key was
	// delegated.
	Sigs map[string]*ComputedKeyInfo

	// Map of DeviceID (in HEX) to the most current device object
	Devices map[string]*Device

	// Map of KID -> DeviceID (in Hex)
	KidToDeviceId map[string]string
}

// As returned by user/lookup.json
type KeyFamily struct {
	eldest  *FOKID
	pgps    []*PgpKeyBundle
	pgp2kid map[string]KID

	Sibkeys KeyMap `json:"sibkeys"`
	Subkeys KeyMap `json:"subkeys"`
}

type ComputedKeyFamily struct {
	kf  *KeyFamily
	cki *ComputedKeyInfos
}

func (cki ComputedKeyInfo) Copy() ComputedKeyInfo {
	ret := cki
	ret.Delegations = make(map[string]string)
	for k, v := range cki.Delegations {
		ret.Delegations[k] = v
	}
	return ret
}

// Insert inserts the given ComputedKeyInfo object 1 or 2 times,
// depending on if a KID or PgpFingerprint or both are available.
func (cki *ComputedKeyInfos) Insert(f *FOKID, i *ComputedKeyInfo) {
	if f != nil {
		v := f.ToStrings()
		for _, s := range v {
			cki.Infos[s] = i
		}
		cki.dirty = true
	}
}

func (cki ComputedKeyInfos) Copy() *ComputedKeyInfos {
	ret := &ComputedKeyInfos{
		dirty:         cki.dirty,
		Infos:         make(map[string]*ComputedKeyInfo),
		Sigs:          make(map[string]*ComputedKeyInfo),
		Devices:       make(map[string]*Device),
		KidToDeviceId: make(map[string]string),
	}
	for k, v := range cki.Infos {
		ret.Infos[k] = v
	}
	for k, v := range cki.Sigs {
		ret.Sigs[k] = v
	}
	return ret
}

// NewComputedKeyInfos creates a new ComputedKeyInfos object
// from the given key family.  It finds the eldest sibling in the family and marks
// his status LIVE, so that he can be used to verify signatures. There's
// obviously no one who can delegate to him, so we take it on faith.
func (kf KeyFamily) NewComputedKeyInfos() *ComputedKeyInfos {

	ret := ComputedKeyInfos{
		Infos:         make(map[string]*ComputedKeyInfo),
		Sigs:          make(map[string]*ComputedKeyInfo),
		Devices:       make(map[string]*Device),
		KidToDeviceId: make(map[string]string),
	}

	ret.Insert(kf.eldest, &ComputedKeyInfo{
		Eldest: true,
		Sibkey: true,
		Status: KEY_LIVE,
	})

	return &ret
}

// FindSibkey finds a sibkey in our KeyFamily, by either PGP fingerprint or
// KID. It returns the GenericKey object that's useful for actually performing
// PGP ops.
func (kf KeyFamily) FindActiveSibkey(f FOKID) (key GenericKey, err error) {

	var found bool
	var i string
	kid := f.Kid
	if kid == nil && f.Fp != nil {
		i = f.Fp.String()
		if kid, found = kf.pgp2kid[i]; !found {
			err = KeyFamilyError{fmt.Sprintf("No KID for PGP fingerprint %s found", i)}
			return
		}
	}
	if kid == nil {
		err = KeyFamilyError{"Can't lookup sibkey without a KID"}
		return
	}

	i = kid.String()
	if sk, ok := kf.Sibkeys[i]; !ok {
		err = KeyFamilyError{fmt.Sprintf("No sibkey found for %s", i)}
	} else {
		key = sk.key
	}
	return
}

// Import takes all ServerKeyRecords in this KeyMap and imports the
// key bundle into a GenericKey object that can perform crypto ops. It
// also collects all PgpKeyBundles along the way.
func (km KeyMap) Import(pgps_i []*PgpKeyBundle) (pgps_o []*PgpKeyBundle, err error) {
	pgps_o = pgps_i
	for _, v := range km {
		var pgp *PgpKeyBundle
		if pgp, err = v.Import(); err != nil {
			return
		}
		if pgp != nil {
			pgps_o = append(pgps_o, pgp)
		}
	}
	return
}

// Import takes all Subkeys and Subkeys and imports them and indexes them.
// It indexes them both by KID and by PgpFingerprint, if available.
func (kf *KeyFamily) Import() (err error) {
	G.Log.Debug("+ ImportKeys")
	defer func() {
		G.Log.Debug("- ImportKeys -> %s", ErrToOk(err))
	}()
	if kf.pgps, err = kf.Sibkeys.Import(kf.pgps); err != nil {
		return
	}
	if kf.pgps, err = kf.Subkeys.Import(kf.pgps); err != nil {
		return
	}
	for _, p := range kf.pgps {
		kf.pgp2kid[p.GetFingerprint().String()] = p.GetKid()
	}
	err = kf.findEldest()
	return
}

// setEldest sets this keyFamily's eldest KID to the given KID (specified in hex).
// It is strict that there can only be one eldest KID in the family.
func (kf *KeyFamily) setEldest(hx string) (err error) {
	var kid KID
	if kid, err = ImportKID(hx); err != nil {
		return
	}
	if kf.eldest == nil {
		kf.eldest = &FOKID{Kid: kid}
	} else if !kf.eldest.EqKid(kid) {
		err = KeyFamilyError{fmt.Sprintf("Kid mismatch: %s != %s",
			kf.eldest.Kid.String(), hx)}
	}
	return
}

// GetEldest gets the KID of the eldest key in the family.
func (kf *KeyFamily) GetEldest() *FOKID {
	return kf.eldest
}

// findEldest finds the eldest key in the given Key family, and sanity
// checks that the eldest key is unique.  If tests pass, it sets a "FOKID"
// object to capture both the KID and the (optional) PgpFingerprint
// of the eldest key in the family.
func (kf *KeyFamily) findEldest() (err error) {
	for _, v := range kf.Sibkeys {
		if v.EldestKid == nil {
			err = kf.setEldest(v.Kid)
		} else {
			err = kf.setEldest(*v.EldestKid)
		}
		if err != nil {
			return
		}
	}
	if kf.eldest != nil {
		x := kf.eldest.Kid.String()
		if key, found := kf.Sibkeys[x]; !found {
			err = KeyFamilyError{fmt.Sprintf("Eldest KID %s disappeared", x)}
		} else {
			kf.eldest.Fp, err = PgpFingerprintFromHex(key.PgpFingerprint)
		}
	}
	return
}

// ParseKeyFamily takes as input a dictionary from a JSON file and returns
// a parsed version for manipulation in the program.
func ParseKeyFamily(jw *jsonw.Wrapper) (ret *KeyFamily, err error) {
	if jw == nil && jw.IsNil() {
		err = KeyFamilyError{"nil record from server"}
	}

	// Somewhat wasteful but probably faster than using Jsonw wrappers,
	// and less error-prone
	var obj KeyFamily
	if err = jw.UnmarshalAgain(&obj); err != nil {
		return
	}

	// Initialize this before the import step.
	obj.pgp2kid = make(map[string]KID)

	if err = obj.Import(); err != nil {
		return
	}
	ret = &obj
	return
}

func (skr *ServerKeyRecord) Import() (pgp *PgpKeyBundle, err error) {
	switch {
	case IsPgpAlgo(skr.KeyAlgo):
		if pgp, err = ReadOneKeyFromString(skr.Bundle); err == nil {
			skr.key = pgp
		}
	case skr.KeyAlgo == KID_NACL_EDDSA:
		skr.key, err = ImportNaclSigningKeyPairFromHex(skr.Bundle)
	case skr.KeyAlgo == KID_NACL_DH:
		skr.key, err = ImportNaclDHKeyPairFromHex(skr.Bundle)
	default:
		err = BadKeyError{fmt.Sprintf("algo=%d is unknown", skr.KeyAlgo)}
	}
	if err == nil {
		G.Log.Debug("| Imported Key %s", skr.key.GetKid())
	}
	return
}

func (kf KeyFamily) GetSigningKey(kid_s string) (ret GenericKey) {
	if skr, found := kf.Sibkeys[kid_s]; found {
		ret = skr.key
	}
	return
}

func (ckf ComputedKeyFamily) FindActiveSibkey(f FOKID) (key GenericKey, err error) {
	s := f.String()
	if ki := ckf.cki.Infos[s]; ki == nil {
		err = NoKeyError{fmt.Sprintf("The key '%s' wasn't found", s)}
	} else if ki.Status != KEY_LIVE {
		err = KeyRevokedError{fmt.Sprintf("The key '%s' is no longer active", s)}
	} else if !ki.Sibkey {
		err = BadKeyError{fmt.Sprintf("The key '%s' wasn't delegated as a sibkey", s)}
	} else {
		key, err = ckf.kf.FindActiveSibkey(f)
	}
	return
}

// TclToKeybaseTime turns a TypedChainLink into a KeybaseTime tuple, looking
// inside the chainlink for the Unix wallclock and the global MerkleChain seqno.
func TclToKeybaseTime(tcl TypedChainLink) *KeybaseTime {
	return &KeybaseTime{
		Unix:  tcl.GetCTime().Unix(),
		Chain: tcl.GetMerkleSeqno(),
	}
}

// NowAsKeybaseTime makes a representation of now.  IF we don't know the MerkleTree
// chain seqno, just use 0
func NowAsKeybaseTime(seqno int) *KeybaseTime {
	return &KeybaseTime{
		Unix:  time.Now().Unix(),
		Chain: seqno,
	}
}

// Delegate performs a delegation to the key described in the given TypedChainLink.
// This maybe be a sub- or sibkey delegation.
func (ckf *ComputedKeyFamily) Delegate(tcl TypedChainLink) (err error) {
	kid := tcl.GetDelegatedKid()
	kid_s := kid.String()
	sigid := tcl.GetSigId()
	tm := TclToKeybaseTime(tcl)

	err = ckf.cki.Delegate(kid_s, tm, sigid, tcl.GetKid(), (tcl.IsDelegation() == DLG_SIBKEY))
	return
}

// Delegate marks the given ComputedKeyInfos object that the given kid_s is now
// delegated, as of time tm, in sigid, as signed by signingKid, etc.
func (cki *ComputedKeyInfos) Delegate(kid_s string, tm *KeybaseTime, sigid SigId, signingKid KID, isSibkey bool) (err error) {
	info, found := cki.Infos[kid_s]
	if !found {
		info = &ComputedKeyInfo{
			Eldest:      false,
			Status:      KEY_LIVE,
			Delegations: make(map[string]string),
			DelegatedAt: tm,
		}
		cki.Infos[kid_s] = info
	} else {
		info.Status = KEY_LIVE
	}
	info.Delegations[sigid.ToString(true)] = signingKid.String()
	info.Sibkey = isSibkey
	cki.Sigs[sigid.ToString(true)] = info
	return
}

// Revoke examines a TypeChainLink and applies any revocations in the link
// to the current ComputedKeyInfos.
func (ckf *ComputedKeyFamily) Revoke(tcl TypedChainLink) (err error) {
	err = ckf.revokeSigs(tcl.GetRevocations(), tcl)
	if err == nil {
		err = ckf.revokeKids(tcl.GetRevokeKids(), tcl)
	}
	return err
}

// revokeSigs operates on the per-signature revocations in the given
// TypedChainLink and applies them accordingly.
func (ckf *ComputedKeyFamily) revokeSigs(sigs []*SigId, tcl TypedChainLink) (err error) {
	for _, s := range sigs {
		if s != nil {
			if err = ckf.RevokeSig(*s, tcl); err != nil {
				return
			}
		}
	}
	return
}

// revokeKids operates on the per-kid revocations in the given
// TypedChainLink and applies them accordingly.
func (ckf *ComputedKeyFamily) revokeKids(kids []KID, tcl TypedChainLink) (err error) {
	for _, k := range kids {
		if k != nil {
			if err = ckf.RevokeKid(k, tcl); err != nil {
				return
			}
		}
	}
	return
}

func (ckf *ComputedKeyFamily) RevokeSig(sig SigId, tcl TypedChainLink) (err error) {
	if info, found := ckf.cki.Sigs[sig.ToString(true)]; !found {
	} else if _, found = info.Delegations[sig.ToString(true)]; !found {
		err = BadRevocationError{fmt.Sprintf("Can't find sigId %s in delegation list",
			sig.ToString(true))}
	} else {
		info.Status = KEY_REVOKED
		info.RevokedAt = TclToKeybaseTime(tcl)
	}
	return
}

func (ckf *ComputedKeyFamily) RevokeKid(kid KID, tcl TypedChainLink) (err error) {
	if info, found := ckf.cki.Infos[kid.String()]; found {
		info.Status = KEY_REVOKED
		info.RevokedAt = TclToKeybaseTime(tcl)
	}
	return
}

// FindKeybaseName looks at all PGP keys in this key family that are active
// sibkeys to find a key with a signed identity of <name@keybase.io>. IF
// found return true, and otherwise false.
func (ckf ComputedKeyFamily) FindKeybaseName(s string) bool {
	kem := KeybaseEmailAddress(s)
	for _, pgp := range ckf.kf.pgps {
		kid := pgp.GetKid()
		if info, found := ckf.cki.Infos[kid.String()]; !found {
			continue
		} else if info.Status != KEY_LIVE || !info.Sibkey {
			continue
		}
		if pgp.FindEmail(kem) {
			G.Log.Debug("| Found self-sig for %s in key ID: %s", s, kid)
			return true
		}
	}
	return false
}

// LocalDelegate performs a local key delegation, without the server's permissions.
// We'll need to do this when a key is locally generated.  If it's the eldest,
// we'll try to mark the keyFamily as having an eldest, and will fail if there's
// a clash.
func (kf *KeyFamily) LocalDelegate(key GenericKey, isSibkey bool, eldest bool) (err error) {
	if pgp, ok := key.(*PgpKeyBundle); ok {
		kf.pgp2kid[pgp.GetFingerprint().String()] = pgp.GetKid()
		kf.pgps = append(kf.pgps, pgp)
	}
	kid_s := key.GetKid().String()
	skr := &ServerKeyRecord{key: key}
	if isSibkey {
		kf.Sibkeys[kid_s] = skr
	} else {
		kf.Subkeys[kid_s] = skr
	}

	fokid := GenericKeyToFOKID(key)

	if !eldest || !isSibkey {
	} else if kf.eldest != nil && !kf.eldest.Eq(fokid) {
		err = KeyFamilyError{fmt.Sprintf("Fokid mismatch on eldest key: %s != %s",
			fokid.String(), kf.eldest.String())}
	} else if kf.eldest == nil {
		kf.eldest = &fokid
	}

	return
}

// IsKidActive computes whether the given KID is active, and if so,
// whether it's a sib or subkey
func (ckf ComputedKeyFamily) IsKidActive(kid KID) (ret KeyStatus) {
	return ckf.isKidHexActive(kid.String())
}

func (ckf ComputedKeyFamily) isKidHexActive(hex string) (ret KeyStatus) {
	if info, ok := ckf.cki.Infos[hex]; !ok || info.Status != KEY_LIVE {
		ret = DLG_NONE
	} else if info.Sibkey {
		ret = DLG_SIBKEY
	} else {
		ret = DLG_SUBKEY
	}
	return
}

// IsFOKIDActive computes whether this FOKID is currently active, and whether
// as a sibkey or a subkey
func (ckf ComputedKeyFamily) IsFOKIDActive(f FOKID) (ret KeyStatus) {
	if f.Kid != nil {
		return ckf.IsKidActive(f.Kid)
	} else if f.Fp == nil {
		return DLG_NONE
	} else if kid, found := ckf.kf.pgp2kid[f.Fp.String()]; found {
		return ckf.IsKidActive(kid)
	} else {
		return DLG_NONE
	}
}

// GetAllActiveSibkeys gets all active Sibkeys from given ComputedKeyFamily,
// sorted from oldest to newest.
func (ckf ComputedKeyFamily) GetAllActiveSibkeys() (ret []GenericKey) {
	for _, skr := range ckf.kf.Sibkeys {
		if ckf.isKidHexActive(skr.Kid) == DLG_SIBKEY && skr.key != nil {
			ret = append(ret, skr.key)
		}
	}
	return
}

// GetAllActiveSibkeyKIDs gets all active Sibkeys from given ComputedKeyFamily,
// sorted from oldest to newest, and returns their KIDs
func (ckf ComputedKeyFamily) GetAllActiveSibkeysKIDs() (ret []KID) {
	for _, key := range ckf.GetAllActiveSibkeys() {
		ret = append(ret, key.GetKid())
	}
	return
}

// HasActiveKey returns if the given ComputeKeyFamily has any active keys.
// The key has to be in the server-given KeyFamily and also in our ComputedKeyFamily.
// The former check is so that we can handle the case nuked sigchains.
func (ckf ComputedKeyFamily) HasActiveKey() bool {
	for k := range ckf.kf.Sibkeys {
		if ckf.isKidHexActive(k) == DLG_SIBKEY {
			return true
		}
	}
	return false
}

// HasActiveKey returns if the given ComputeKeyInfos has any active keys.
func (cki ComputedKeyInfos) HasActiveKey() bool {
	for _, v := range cki.Infos {
		if v.Status == KEY_LIVE {
			return true
		}
	}
	return false
}

// GetActivePgpKeys gets the active PGP keys from the ComputedKeyFamily.
// If sibkey is False it will return all active PGP keys. Otherwise, it
// will return only the Sibkeys.
func (ckf ComputedKeyFamily) GetActivePgpKeys(sibkey bool) (ret []*PgpKeyBundle) {
	for _, pgp := range ckf.kf.pgps {
		if info, ok := ckf.cki.Infos[pgp.GetKid().String()]; ok {
			if (!sibkey || info.Sibkey) && info.Status == KEY_LIVE {
				ret = append(ret, pgp)
			}
		}
	}
	return
}

// DumpToLog dumps info about the current KeyFamily to the given log UI
func (ckf ComputedKeyFamily) DumpToLog(ui LogUI) {

	server_dump := func(key GenericKey, sibOrSub string) {
		ui.Info("▶ Server key: algo=%d, kid=%s; %s", key.GetAlgoType(),
			key.GetKid().String(), sibOrSub)
	}
	cki_dump := func(kid string) {
		if info, ok := ckf.cki.Infos[kid]; !ok {
			ui.Warning(" • No key info available!")
		} else {
			ui.Info(" • Status=%d; Sibkey=%v; Eldest=%v",
				info.Status, info.Sibkey, info.Eldest)
			for k, v := range info.Delegations {
				ui.Info(" • Delegation by KID=%s in Sig=%s", v, k)
			}
		}
	}

	for k, v := range ckf.kf.Sibkeys {
		server_dump(v.key, "SIB")
		cki_dump(k)
	}
	for k, v := range ckf.kf.Subkeys {
		server_dump(v.key, "SUB")
		cki_dump(k)
	}
}

// UpdateDevices takes the Device object from the given ChainLink
// and updates keys to reflects any device changes encoded therein.
func (ckf *ComputedKeyFamily) UpdateDevices(tcl TypedChainLink) (err error) {
	var dobj *Device
	if dobj = tcl.GetDevice(); dobj == nil {
		return
	}

	did := dobj.Id
	kid := dobj.Kid
	var prevKid *string

	if existing, found := ckf.cki.Devices[did]; found {
		prevKid = existing.Kid
		existing.Merge(dobj)
		dobj = existing
	} else {
		ckf.cki.Devices[did] = dobj
	}

	// Clear out the old Key that this device used to refer to.
	// We might wind up just clobbering it with the same thing, but
	// that's fine for now.
	if prevKid != nil && len(*prevKid) > 0 {
		delete(ckf.cki.KidToDeviceId, *prevKid)
	}

	if kid != nil && len(*kid) > 0 {
		ckf.cki.KidToDeviceId[*kid] = did
	}
	return
}

// GetSibkeyForDevice gets the current per-device key for the given Device. Will
// return nil if one isn't found, and set err for a real error. The sibkey should
// be a signing key, not an encryption key of course.
func (ckf *ComputedKeyFamily) GetSibkeyForDevice(did DeviceId) (key GenericKey, err error) {
	var kid KID
	if device, found := ckf.cki.Devices[did.String()]; !found {
	} else if device.Kid == nil || len(*device.Kid) == 0 {
	} else if kid, err = ImportKID(*device.Kid); err != nil {
	} else {
		key, err = ckf.FindActiveSibkey(FOKID{Kid: kid})
	}
	return
}

// GetDeviceForKey gets the device that this key is bound to, if any.
func (ckf *ComputedKeyFamily) GetDeviceForKey(key GenericKey) (ret *Device, err error) {
	if didString, found := ckf.cki.KidToDeviceId[key.GetKid().String()]; found {
		ret = ckf.cki.Devices[didString]
	}
	return
}
