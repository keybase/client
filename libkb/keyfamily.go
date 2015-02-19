// A KeyFamily is a group of sibling keys that have equal power for a user.
// A family can consist of 1 PGP keys, and arbitrarily many NaCl Sibkeys.
// There also can be some subkeys dangling off for ECDH.
package libkb

import (
	"fmt"
	"time"

	jsonw "github.com/keybase/go-jsonw"
)

// We have two notions of time we can use -- standard UTC which might
// be screwy (skewy) based upon local clock problems; or MerkleRoot seqno,
// which is totally ordered and all clients and server ought to agree on it.
// The issue is that we're not uniformly signing Merkle roots into signatures,
// especially those generated on the Web site.
type KeybaseTime struct {
	Unix  int64 // UTC wallclock time
	Chain int   // Merkle root chain time
}

// ComputedKeyInfo is a set of annotations that we apply to a ServerKeyRecord.
// Everything here has been checked by the client. Each ComputedKeyInfo
// refers to exactly one ServerKeyInfo.
type ComputedKeyInfo struct {
	Status KeyStatus
	Eldest bool
	Sibkey bool

	// These have to be ints so they can be written to disk and read
	// back in.
	CTime int64 // In Seconds since the Epoch
	ETime int64 // In Seconds since the Epoch or 0 if none

	// For subkeys, a pointer back to our parent
	Parent *string

	// For Sibkeys, a pointer to the last-added subkey
	Subkey *string

	// Map of SigId -> KID, both as hex strings
	// (since we can't unmarhsal into KIDs)
	Delegations map[string]string
	DelegatedAt *KeybaseTime
	RevokedAt   *KeybaseTime
}

func (cki ComputedKeyInfo) GetCTime() time.Time {
	return time.Unix(cki.CTime, 0)
}

func (cki ComputedKeyInfo) GetETime() time.Time {
	return UnixToTimeMappingZero(cki.ETime)
}

// As returned by user/lookup.json; these records are not to be trusted,
// we need to Verify this data against the sigchain as we play the sigchain
// forward.
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
	KeyAlgo        int     `json:"key_algo"`

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

	// The last-added Web device, to figure out where the DetKey is.
	WebDevice *Device
}

// As returned by user/lookup.json; these records are not to be trusted,
// we need to Verify this data against the sigchain as we play the sigchain
// forward.
type KeyFamily struct {
	eldest *FOKID
	pgps   []*PgpKeyBundle

	// These fields are computed on the client side, so they can be trusted.
	pgp2kid map[string]KID
	kid2pgp map[string]string

	Sibkeys KeyMap `json:"sibkeys"`
	Subkeys KeyMap `json:"subkeys"`
}

// ComputedKeyFamily is a joining of two sets of data; the KeyFamily is
// what the server returned and is not to be trusted; the ComputedKeyInfos
// is what we compute as a result of playing the user's sigchain forward.
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

func NewComputedKeyInfos() *ComputedKeyInfos {
	return &ComputedKeyInfos{
		Infos:         make(map[string]*ComputedKeyInfo),
		Sigs:          make(map[string]*ComputedKeyInfo),
		Devices:       make(map[string]*Device),
		KidToDeviceId: make(map[string]string),
	}
}

func NewComputedKeyInfo(eldest, sibkey bool, status KeyStatus, ctime, etime int64) ComputedKeyInfo {
	return ComputedKeyInfo{
		Eldest:      eldest,
		Sibkey:      sibkey,
		Status:      status,
		CTime:       ctime,
		ETime:       etime,
		Delegations: make(map[string]string),
	}
}

func (ckis ComputedKeyInfos) InsertLocalEldestKey(fokid FOKID) {
	// CTime and ETime are both initialized to zero, meaning that (until we get
	// updates from the server) this key never expires.
	eldestCki := NewComputedKeyInfo(true, true, KEY_UNCANCELLED, 0, 0)
	ckis.Insert(&fokid, &eldestCki)
}

// For use when there are no chain links at all, so all we can do is trust the
// eldest key that the server reported.
func (ckis ComputedKeyInfos) InsertServerEldestKey(eldestKey GenericKey, un string) error {
	kbid := KeybaseIdentity(un)
	if pgp, ok := eldestKey.(*PgpKeyBundle); ok {
		match, ctime, etime := pgp.CheckIdentity(kbid)
		if match {
			eldestCki := NewComputedKeyInfo(true, true, KEY_UNCANCELLED, ctime, etime)
			// If fokid is just a PGP fingerprint, expand it to include a proper KID.
			// TODO: This is duplicated logic from InsertEldestKey. Clean them up somehow.
			fokidWithKid := GenericKeyToFOKID(eldestKey)
			ckis.Insert(&fokidWithKid, &eldestCki)
			return nil
		} else {
			return KeyFamilyError{"InsertServerEldestKey found a non-matching eldest key."}
		}
	} else {
		return KeyFamilyError{"InsertServerEldestKey found a non-PGP key."}
	}
}

func (ckf ComputedKeyFamily) InsertEldestLink(tcl TypedChainLink, username string) (err error) {

	fokid := tcl.GetFOKID()

	var key GenericKey
	if key, err = ckf.kf.FindActiveSibkey(fokid); err != nil {
		return
	}

	found := false

	// Figure out the creation time and expire time of the eldest key.
	var ctimeKb, etimeKb int64 = 0, 0
	if _, ok := tcl.(*SelfSigChainLink); ok {
		// We don't need to check the signature on the first link, because
		// verifySubchain will take care of that.
		//
		// These times will get overruled by times we get from PGP, if any.
		ctimeKb = tcl.GetCTime().Unix()
		etimeKb = tcl.GetETime().Unix()
		found = true
	}

	// Also check PGP key times.
	var ctimePgp, etimePgp int64 = -1, -1
	if pgp, ok := key.(*PgpKeyBundle); ok {
		kbid := KeybaseIdentity(username)
		var foundPgp bool
		foundPgp, ctimePgp, etimePgp = pgp.CheckIdentity(kbid)
		found = found || foundPgp
		if !found {
			return KeyFamilyError{"First link signed by key that doesn't match Keybase user id."}
		}
	} else if !found {
		return KeyFamilyError{"First link not self-signing and not pgp-signed."}
	}

	var ctime int64
	if ctimePgp >= 0 {
		ctime = ctimePgp
	} else {
		ctime = ctimeKb
	}

	var etime int64
	if etimePgp >= 0 {
		etime = etimePgp
	} else {
		etime = etimeKb
	}

	eldestCki := NewComputedKeyInfo(true, true, KEY_UNCANCELLED, ctime, etime)

	// If fokid is just a PGP fingerprint, expand it to include a proper KID.
	fokidWithKid := GenericKeyToFOKID(key)

	ckf.cki.Insert(&fokidWithKid, &eldestCki)
	return nil
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

// FindActiveEncryptionSubkey finds a subkey in our KeyFamily that is both a subkey
// and for encryption.  It doesn't check that it's still valid.
func (kf KeyFamily) FindActiveEncryptionSubkey(k KID) (key GenericKey, err error) {
	if subkey, ok := kf.Subkeys[k.String()]; ok && subkey.key != nil && CanEncrypt(subkey.key) {
		key = subkey.key
	}
	return
}

// Import takes all ServerKeyRecords in this KeyMap and imports the
// key bundle into a GenericKey object that can perform crypto ops. It
// also collects all PgpKeyBundles along the way.
func (km KeyMap) Import(pgps_i []*PgpKeyBundle) (pgps_o []*PgpKeyBundle, err error) {
	pgps_o = pgps_i
	var server_given_kid, computed_kid KID
	for k, v := range km {
		var pgp *PgpKeyBundle
		if pgp, err = v.Import(); err != nil {
			return
		}

		if server_given_kid, err = ImportKID(k); err != nil {
			return
		}

		computed_kid = v.key.GetKid()
		if !server_given_kid.Eq(computed_kid) {
			err = WrongKidError{server_given_kid, computed_kid}
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
	G.Log.Debug("+ KeyFamily.Import")
	defer func() {
		G.Log.Debug("- KeyFamily.Import -> %s", ErrToOk(err))
	}()
	if kf.pgps, err = kf.Sibkeys.Import(kf.pgps); err != nil {
		return
	}
	if kf.pgps, err = kf.Subkeys.Import(kf.pgps); err != nil {
		return
	}
	for _, p := range kf.pgps {
		fp := p.GetFingerprint().String()
		kid := p.GetKid()
		kf.pgp2kid[fp] = kid
		kf.kid2pgp[kid.String()] = fp
	}
	err = kf.findEldest()
	return
}

// setEldest sets this keyFamily's eldest KID to the given KID (specified in hex).
// It is strict that there can only be one eldest KID in the family.
func (kf *KeyFamily) setEldest(hx string) (err error) {
	G.Log.Debug("| KeyFamily.setEldest(%s)", hx)
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
	G.Log.Debug("| KeyFamily.findEldest w/ %d sibkeys", len(kf.Sibkeys))
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
		} else if len(key.PgpFingerprint) > 0 {
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
	obj.kid2pgp = make(map[string]string)

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

// FindKey finds any key in any list that matches the given KID.  No attention
// is paid to whether or not the key is active.
func (kf KeyFamily) FindKey(kid KID) (ret GenericKey) {
	kidStr := kid.String()
	if skr, found := kf.Sibkeys[kidStr]; found {
		ret = skr.key
	} else if skr, found = kf.Subkeys[kidStr]; found {
		ret = skr.key
	}
	return
}

func (ckf ComputedKeyFamily) getCkiIfActiveAtTime(s string, t time.Time) (ret *ComputedKeyInfo, err error) {
	unixTime := t.Unix()
	if ki := ckf.cki.Infos[s]; ki == nil {
		err = NoKeyError{fmt.Sprintf("The key '%s' wasn't found", s)}
	} else if ki.Status != KEY_UNCANCELLED {
		err = KeyRevokedError{fmt.Sprintf("The key '%s' is no longer active", s)}
	} else if unixTime < ki.CTime || (ki.ETime > 0 && unixTime > ki.ETime) {
		err = KeyExpiredError{fmt.Sprintf("The key '%s' expired at %s", s, time.Unix(ki.ETime, 0))}
	} else {
		ret = ki
	}
	return
}

func (ckf ComputedKeyFamily) getCkiIfActiveNow(s string) (ret *ComputedKeyInfo, err error) {
	return ckf.getCkiIfActiveAtTime(s, time.Now())
}

// FindActiveSibkey takes a given PGP Fingerprint OR KID (in the form of a
// FOKID) and finds the corresponding active sibkey in the current key family.
// If it cannot find the key, or if the key is no longer active (either by
// revocation, or by expiring), it will return an error saying why. Otherwise,
// it will return the key.  In this case either key is non-nil, or err is
// non-nil.
func (ckf ComputedKeyFamily) FindActiveSibkey(f FOKID) (key GenericKey, cki ComputedKeyInfo, err error) {
	return ckf.FindActiveSibkeyAtTime(f, time.Now())
}

// As FindActiveSibkey, but for a specific time. Note that going back in time
// only affects expiration, not revocation. Thus this function is mainly useful
// for validating the sigchain, when each delegation and revocation is getting
// replayed in order.
func (ckf ComputedKeyFamily) FindActiveSibkeyAtTime(f FOKID, t time.Time) (key GenericKey, cki ComputedKeyInfo, err error) {
	s := f.String()
	liveCki, err := ckf.getCkiIfActiveAtTime(s, t)
	if liveCki == nil || err != nil {
		// err gets returned.
	} else if !liveCki.Sibkey {
		err = BadKeyError{fmt.Sprintf("The key '%s' wasn't delegated as a sibkey", s)}
	} else {
		key, err = ckf.kf.FindActiveSibkey(f)
		cki = *liveCki
	}
	return
}

// FindActiveEncryptionSubkey takes a given PGP Fingerprint OR KID (in the form of a FOKID)
// and finds the corresponding active encryption subkey in the current key family.  If for any reason
// it cannot find the key, it will return an error saying why.  Otherwise, it will return
// the key.  In this case either key is non-nil, or err is non-nil.
func (ckf ComputedKeyFamily) FindActiveEncryptionSubkey(kid KID) (key GenericKey, err error) {
	s := kid.String()
	ki, err := ckf.getCkiIfActiveNow(s)
	if ki == nil || err != nil {
		// err gets returned.
	} else if ki.Sibkey {
		err = BadKeyError{fmt.Sprintf("The key '%s' was delegated as a sibkey", s)}
	} else {
		key, err = ckf.kf.FindActiveEncryptionSubkey(kid)
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
	kidStr := kid.String()
	sigid := tcl.GetSigId()
	tm := TclToKeybaseTime(tcl)
	fp := ckf.kf.kid2pgp[kidStr]

	err = ckf.cki.Delegate(kidStr, fp, tm, sigid, tcl.GetKid(), tcl.GetParentKid(), (tcl.GetRole() == DLG_SIBKEY), tcl.GetCTime(), tcl.GetETime())
	return
}

// Delegate marks the given ComputedKeyInfos object that the given kidStr is now
// delegated, as of time tm, in sigid, as signed by signingKid, etc.
func (cki *ComputedKeyInfos) Delegate(kidStr string, fingerprintStr string, tm *KeybaseTime, sigid SigId, signingKid KID, parentKid KID, isSibkey bool, ctime time.Time, etime time.Time) (err error) {
	info, found := cki.Infos[kidStr]
	if !found {
		newInfo := NewComputedKeyInfo(false, false, KEY_UNCANCELLED, ctime.Unix(), etime.Unix())
		newInfo.DelegatedAt = tm
		info = &newInfo
		cki.Infos[kidStr] = info
		if len(fingerprintStr) > 0 {
			cki.Infos[fingerprintStr] = info
		}
	} else {
		info.Status = KEY_UNCANCELLED
		info.CTime = ctime.Unix()
		info.ETime = etime.Unix()
	}
	info.Delegations[sigid.ToString(true)] = signingKid.String()
	info.Sibkey = isSibkey
	cki.Sigs[sigid.ToString(true)] = info

	// If it's a subkey, make a pointer from it to its parent,
	// and also from its parent to it.
	if parentKid != nil {
		s := parentKid.String()
		info.Parent = &s
		if parent, found := cki.Infos[s]; found {
			parent.Subkey = &kidStr
		}
	}

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
		} else if info.Status != KEY_UNCANCELLED || !info.Sibkey {
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
	kidStr := key.GetKid().String()
	skr := &ServerKeyRecord{key: key}
	if isSibkey {
		kf.Sibkeys[kidStr] = skr
	} else {
		kf.Subkeys[kidStr] = skr
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

// GetKeyRole returns the KeyRole (sibkey/subkey/none), taking into account
// whether the key has been cancelled.
func (ckf ComputedKeyFamily) GetKeyRole(kid KID) (ret KeyRole) {
	return ckf.getKeyRoleFromStr(kid.String())
}

// GetFOKIDRole returns the KeyRole (sibkey/subkey/none), taking into account
// whether the key has been cancelled.
func (ckf ComputedKeyFamily) GetFOKIDRole(f FOKID) (ret KeyRole) {
	return ckf.getKeyRoleFromStr(f.String())
}

func (ckf ComputedKeyFamily) getKeyRoleFromStr(s string) (ret KeyRole) {
	if info, err := ckf.getCkiIfActiveNow(s); err != nil {
		ret = DLG_NONE
	} else if info.Sibkey {
		ret = DLG_SIBKEY
	} else {
		ret = DLG_SUBKEY
	}
	return
}

// GetAllActiveSibkeys gets all active Sibkeys from given ComputedKeyFamily,
// sorted from oldest to newest.
func (ckf ComputedKeyFamily) GetAllActiveSibkeys() (ret []GenericKey) {
	for _, skr := range ckf.kf.Sibkeys {
		if ckf.getKeyRoleFromStr(skr.Kid) == DLG_SIBKEY && skr.key != nil {
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
		if ckf.getKeyRoleFromStr(k) == DLG_SIBKEY {
			return true
		}
	}
	return false
}

// HasActiveKey returns if the given ComputeKeyInfos has any active keys.
func (cki ComputedKeyInfos) HasActiveKey() bool {
	for _, v := range cki.Infos {
		if v.Status == KEY_UNCANCELLED {
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
			if (!sibkey || info.Sibkey) && info.Status == KEY_UNCANCELLED {
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

	G.Log.Debug("+ UpdateDevice")
	defer func() {
		G.Log.Debug("- UpdateDevice -> %s", ErrToOk(err))
	}()
	var dobj *Device
	if dobj = tcl.GetDevice(); dobj == nil {
		return
	}

	did := dobj.Id
	kid := dobj.Kid
	var prevKid *string

	G.Log.Debug("| Device ID=%s; KID=%s", did, kid)

	if existing, found := ckf.cki.Devices[did]; found {
		G.Log.Debug("| merge with existing")
		prevKid = existing.Kid
		existing.Merge(dobj)
		dobj = existing
	} else {
		G.Log.Debug("| New insert")
		ckf.cki.Devices[did] = dobj
	}

	// Clear out the old Key that this device used to refer to.
	// We might wind up just clobbering it with the same thing, but
	// that's fine for now.
	if prevKid != nil && len(*prevKid) > 0 {
		G.Log.Debug("| Clear out old key")
		delete(ckf.cki.KidToDeviceId, *prevKid)
	}

	if kid != nil && len(*kid) > 0 {
		ckf.cki.KidToDeviceId[*kid] = did
	}

	// Last-writer wins on the Web device
	if dobj != nil && dobj.IsWeb() {
		G.Log.Debug("| Set Web/DetKey Device")
		ckf.cki.WebDevice = dobj
	}

	return
}

func (ckf *ComputedKeyFamily) getSibkeyKidForDevice(did DeviceID) (kid KID, err error) {
	G.Log.Debug("+ getSibkeyKidForDevice(%v)", did)
	G.Log.Debug("| Devices map: %+v", ckf.cki.Devices)

	if device, found := ckf.cki.Devices[did.String()]; !found {
		G.Log.Debug("device %s not found in cki.Devices", did)
	} else if device.Kid == nil || len(*device.Kid) == 0 {
		G.Log.Debug("device found, but Kid empty")
	} else {
		G.Log.Debug("device found, kid: %s", *device.Kid)
		kid, err = ImportKID(*device.Kid)
	}
	G.Log.Debug("- Result -> (%v,%s)", kid, ErrToOk(err))
	return
}

// GetSibkeyForDevice gets the current per-device key for the given Device. Will
// return nil if one isn't found, and set err for a real error. The sibkey should
// be a signing key, not an encryption key of course.
func (ckf *ComputedKeyFamily) GetSibkeyForDevice(did DeviceID) (key GenericKey, err error) {
	var kid KID
	kid, err = ckf.getSibkeyKidForDevice(did)
	if kid != nil {
		key, _, err = ckf.FindActiveSibkey(FOKID{Kid: kid})
	}
	return
}

// GetActiveSibkeyKidForCurrentDevice looks up the current Device ID and, if found, tries to
// get the corresponding KID, and if that's found, we check that it's active.
func (ckf *ComputedKeyFamily) GetActiveSibkeyKidForCurrentDevice() (kid KID, err error) {
	if did := G.Env.GetDeviceID(); did == nil {
		err = NotProvisionedError{}
	} else if kid, err = ckf.getSibkeyKidForDevice(*did); err != nil {
	} else if ckf.GetKeyRole(kid) != DLG_SIBKEY {
		err = InactiveKeyError{kid}
		kid = nil
	}
	return kid, err
}

// GetEncryptionSubkeyForDevice gets the current encryption subkey for the given
// device.  Note that many devices might share an encryption public key but
// might have different secret keys.
func (ckf *ComputedKeyFamily) GetEncryptionSubkeyForDevice(did DeviceID) (key GenericKey, err error) {
	var kid KID
	if kid, err = ckf.getSibkeyKidForDevice(did); err != nil {
		return
	}
	if kid == nil {
		return
	}
	if cki, found := ckf.cki.Infos[kid.String()]; !found {
		return
	} else if cki.Subkey == nil {
		return
	} else if kid, err = ImportKID(*cki.Subkey); err != nil {
	} else {
		key, err = ckf.FindActiveEncryptionSubkey(kid)
	}
	return
}

// GetDeviceForKey gets the device that this key is bound to, if any.
func (ckf *ComputedKeyFamily) GetDeviceForKey(key GenericKey) (ret *Device, err error) {
	return ckf.getDeviceForHexKid(key.GetKid().String())
}

func (ckf *ComputedKeyFamily) getDeviceForHexKid(s string) (ret *Device, err error) {
	if didString, found := ckf.cki.KidToDeviceId[s]; found {
		ret = ckf.cki.Devices[didString]
	}
	return
}

// IsDetKey tells if the given Key represents a deterministically-generated
// Web key
func (ckf *ComputedKeyFamily) IsDetKey(key GenericKey) (ret bool, err error) {

	// First try to see if the key itself is a detkey
	kidStr := key.GetKid().String()
	if ret, err = ckf.isDetKeyHelper(kidStr); ret || err != nil {
		return
	}

	// Then see if the parent is a detkey and we're a subkey of it.
	if info, found := ckf.cki.Infos[kidStr]; found && info.Parent != nil && !info.Sibkey {
		ret, err = ckf.isDetKeyHelper(*info.Parent)
	}
	return
}

// isDetKeyHelper looks at the given KID (in hex) and sees if it is marked as a
// deterministic Key (if the IsWeb() flag is on).  It won't look up or down the
// key graph.
func (ckf *ComputedKeyFamily) isDetKeyHelper(hexKid string) (ret bool, err error) {
	var dev *Device
	if dev, err = ckf.getDeviceForHexKid(hexKid); err != nil {
		return
	}
	if dev == nil {
		return
	}
	ret = dev.IsWeb()
	return
}
