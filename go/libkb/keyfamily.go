// A KeyFamily is a group of sibling keys that have equal power for a user.
// A family can consist of 1 PGP keys, and arbitrarily many NaCl Sibkeys.
// There also can be some subkeys dangling off for ECDH.
package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
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

	// For subkeys, the KID of our parent (if valid)
	Parent keybase1.KID

	// For sibkeys, the KID of last-added subkey (if valid)
	Subkey keybase1.KID

	// Map of SigID -> KID
	Delegations map[keybase1.SigID]keybase1.KID
	DelegatedAt *KeybaseTime
	RevokedAt   *KeybaseTime

	Contextified
}

func (cki ComputedKeyInfo) GetCTime() time.Time {
	return time.Unix(cki.CTime, 0)
}

func (cki ComputedKeyInfo) GetETime() time.Time {
	return UnixToTimeMappingZero(cki.ETime)
}

// When we play a sigchain forward, it yields ComputedKeyInfos (CKIs). We're going to
// store CKIs separately from the keys, since the server can clobber the
// former.  We should rewrite CKIs every time we (re)check a user's SigChain
type ComputedKeyInfos struct {
	dirty bool // whether it needs to be written to disk or not

	// Map of KID to a computed info
	Infos map[keybase1.KID]*ComputedKeyInfo

	// Map of a SigID (in binary) to the ComputedKeyInfo describing when the key was
	// delegated.
	Sigs map[keybase1.SigID]*ComputedKeyInfo

	// Map of DeviceID to the most current device object
	Devices map[keybase1.DeviceID]*Device

	// Map of KID -> DeviceID
	KIDToDeviceID map[keybase1.KID]keybase1.DeviceID

	// The last-added Web device, to figure out where the DetKey is.
	WebDeviceID keybase1.DeviceID
}

// As returned by user/lookup.json
type RawKeyFamily struct {
	AllBundles []string `json:"all_bundles"`
}

// Once the client downloads a RawKeyFamily, it converts it into a KeyFamily,
// which has some additional information about Fingerprints and PGP keys
type KeyFamily struct {
	pgps []*PGPKeyBundle

	// These fields are computed on the client side, so they can be trusted.
	pgp2kid map[PGPFingerprint]keybase1.KID
	kid2pgp map[keybase1.KID]PGPFingerprint

	AllKeys map[keybase1.KID]GenericKey

	BundlesForTesting []string

	Contextified
}

// ComputedKeyFamily is a joining of two sets of data; the KeyFamily is
// what the server returned and is not to be trusted; the ComputedKeyInfos
// is what we compute as a result of playing the user's sigchain forward.
type ComputedKeyFamily struct {
	kf  *KeyFamily
	cki *ComputedKeyInfos
	Contextified
}

// Insert inserts the given ComputedKeyInfo object 1 or 2 times,
// depending on if a KID or PGPFingerprint or both are available.
func (cki *ComputedKeyInfos) Insert(k keybase1.KID, i *ComputedKeyInfo) {
	cki.Infos[k] = i
	cki.dirty = true
}

// PaperDevices returns a list of all the paperkey devices.
func (cki *ComputedKeyInfos) PaperDevices() []*Device {
	var d []*Device
	for _, v := range cki.Devices {
		if v.Status == nil {
			continue
		}
		if *v.Status != DeviceStatusActive {
			continue
		}
		if v.Type != DeviceTypePaper {
			continue
		}
		d = append(d, v)
	}
	return d
}

// TODO: Figure out whether this needs to be a deep copy. See
// https://github.com/keybase/client/issues/414 .
func (cki ComputedKeyInfos) ShallowCopy() *ComputedKeyInfos {
	ret := &ComputedKeyInfos{
		dirty:         cki.dirty,
		Infos:         make(map[keybase1.KID]*ComputedKeyInfo, len(cki.Infos)),
		Sigs:          make(map[keybase1.SigID]*ComputedKeyInfo, len(cki.Sigs)),
		Devices:       make(map[keybase1.DeviceID]*Device, len(cki.Devices)),
		KIDToDeviceID: make(map[keybase1.KID]keybase1.DeviceID, len(cki.KIDToDeviceID)),
	}
	for k, v := range cki.Infos {
		ret.Infos[k] = v
	}

	for k, v := range cki.Sigs {
		ret.Sigs[k] = v
	}

	for k, v := range cki.Devices {
		ret.Devices[k] = v
	}

	for k, v := range cki.KIDToDeviceID {
		ret.KIDToDeviceID[k] = v
	}

	return ret
}

func NewComputedKeyInfos() *ComputedKeyInfos {
	return &ComputedKeyInfos{
		Infos:         make(map[keybase1.KID]*ComputedKeyInfo),
		Sigs:          make(map[keybase1.SigID]*ComputedKeyInfo),
		Devices:       make(map[keybase1.DeviceID]*Device),
		KIDToDeviceID: make(map[keybase1.KID]keybase1.DeviceID),
	}
}

func NewComputedKeyInfo(eldest, sibkey bool, status KeyStatus, ctime, etime int64) ComputedKeyInfo {
	return ComputedKeyInfo{
		Eldest:      eldest,
		Sibkey:      sibkey,
		Status:      status,
		CTime:       ctime,
		ETime:       etime,
		Delegations: make(map[keybase1.SigID]keybase1.KID),
	}
}

func (cki ComputedKeyInfos) InsertLocalEldestKey(kid keybase1.KID) {
	// CTime and ETime are both initialized to zero, meaning that (until we get
	// updates from the server) this key never expires.
	eldestCki := NewComputedKeyInfo(true, true, KeyUncancelled, 0, 0)
	cki.Insert(kid, &eldestCki)
}

// For use when there are no chain links at all, so all we can do is trust the
// eldest key that the server reported.
func (cki ComputedKeyInfos) InsertServerEldestKey(eldestKey GenericKey, un NormalizedUsername) error {
	kbid := KeybaseIdentity(un)
	if pgp, ok := eldestKey.(*PGPKeyBundle); ok {
		match, ctime, etime := pgp.CheckIdentity(kbid)
		if match {
			eldestCki := NewComputedKeyInfo(true, true, KeyUncancelled, ctime, etime)
			cki.Insert(eldestKey.GetKID(), &eldestCki)
			return nil
		}
		return KeyFamilyError{"InsertServerEldestKey found a non-matching eldest key."}
	}
	return KeyFamilyError{"InsertServerEldestKey found a non-PGP key."}
}

func (ckf ComputedKeyFamily) InsertEldestLink(tcl TypedChainLink, username NormalizedUsername) (err error) {
	kid := tcl.GetKID()
	key, err := ckf.kf.FindKeyWithKIDUnsafe(kid)
	if err != nil {
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
	var ctimePGP, etimePGP int64 = -1, -1
	if pgp, ok := key.(*PGPKeyBundle); ok {
		kbid := KeybaseIdentity(username)
		var foundPGP bool
		foundPGP, ctimePGP, etimePGP = pgp.CheckIdentity(kbid)
		found = found || foundPGP
		if !found {
			return KeyFamilyError{"First link signed by key that doesn't match Keybase user id."}
		}
	} else if !found {
		return KeyFamilyError{"First link not self-signing and not pgp-signed."}
	}

	var ctime int64
	if ctimePGP >= 0 {
		ctime = ctimePGP
	} else {
		ctime = ctimeKb
	}

	var etime int64
	if etimePGP >= 0 {
		etime = etimePGP
	} else {
		etime = etimeKb
	}

	eldestCki := NewComputedKeyInfo(true, true, KeyUncancelled, ctime, etime)

	ckf.cki.Insert(kid, &eldestCki)
	return nil
}

// ParseKeyFamily takes as input a dictionary from a JSON file and returns
// a parsed version for manipulation in the program.
func ParseKeyFamily(jw *jsonw.Wrapper) (ret *KeyFamily, err error) {
	G.Log.Debug("+ ParseKeyFamily")
	defer func() {
		G.Log.Debug("- ParseKeyFamily -> %s", ErrToOk(err))
	}()

	if jw == nil || jw.IsNil() {
		err = KeyFamilyError{"nil record from server"}
		return
	}

	kf := KeyFamily{
		pgp2kid:      make(map[PGPFingerprint]keybase1.KID),
		kid2pgp:      make(map[keybase1.KID]PGPFingerprint),
		Contextified: NewContextified(G),
	}

	// Fill in AllKeys. Somewhat wasteful but probably faster than
	// using Jsonw wrappers, and less error-prone.
	var rkf RawKeyFamily
	if err = jw.UnmarshalAgain(&rkf); err != nil {
		return
	}
	kf.BundlesForTesting = rkf.AllBundles

	// Parse the keys, and collect the PGP keys to map their fingerprints.
	kf.AllKeys = make(map[keybase1.KID]GenericKey)
	for _, bundle := range rkf.AllBundles {
		newKey, err := ParseGenericKey(bundle)
		if err != nil {
			return nil, err
		}

		kid := newKey.GetKID()

		if pgp, isPGP := newKey.(*PGPKeyBundle); isPGP {
			// For now, we've decided to merge each version of a PGP key and
			// ignore revocations when validating a sigchain. This stops anyone
			// from breaking their sigchain by uploading a revoked version of
			// their PGP key. Unfortunately it also creates a vulnerability
			// when Alice's key is compromised and she revokes it PGP-style
			// without revoking it sigchain-style: Keybase clients will
			// continue to accept the key as legit, Mallory can now make
			// sigchain links as Alice.
			//
			// A long-term solution is for us to track PGP keys' history in the
			// sigchain and use one at a time. This is detailed in issue #544.
			pgp.StripRevocations()

			if oldKey, ok := kf.AllKeys[kid]; ok {
				oldKey.(*PGPKeyBundle).MergeKey(pgp)
			} else {
				kf.AllKeys[kid] = pgp
			}
		} else {
			kf.AllKeys[kid] = newKey
		}
	}

	// Collect the PGP keys. (Do this with the AllKeys map instead of the
	// AllBundles response, because the latter can contain duplicates.)
	for _, key := range kf.AllKeys {
		pgp, isPGP := key.(*PGPKeyBundle)
		if isPGP {
			kf.pgps = append(kf.pgps, pgp)
		}
	}

	// Map the PGP fingerprints.
	for _, p := range kf.pgps {
		fp := p.GetFingerprint()
		kid := p.GetKID()
		kf.pgp2kid[fp] = kid
		kf.kid2pgp[kid] = fp
	}

	ret = &kf
	return
}

// This function doesn't validate anything about the key it returns -- that key
// could be expired or revoked. Most callers should prefer the FindActive*
// methods on the ComputedKeyFamily.
func (kf KeyFamily) FindKeyWithKIDUnsafe(kid keybase1.KID) (GenericKey, error) {
	key, ok := kf.AllKeys[kid]
	if !ok {
		return nil, KeyFamilyError{fmt.Sprintf("No key found for %s", kid)}
	}
	return key, nil
}

func (ckf ComputedKeyFamily) getCkiIfActiveAtTime(kid keybase1.KID, t time.Time) (ret *ComputedKeyInfo, err error) {
	unixTime := t.Unix()
	if ki := ckf.cki.Infos[kid]; ki == nil {
		err = NoKeyError{fmt.Sprintf("The key '%s' wasn't found", kid)}
	} else if ki.Status != KeyUncancelled {
		err = KeyRevokedError{fmt.Sprintf("The key '%s' is no longer active", kid)}
	} else if unixTime < ki.CTime || (ki.ETime > 0 && unixTime > ki.ETime) {
		err = KeyExpiredError{fmt.Sprintf("The key '%s' expired at %s", kid, time.Unix(ki.ETime, 0))}
	} else {
		ret = ki
	}
	return
}

func (ckf ComputedKeyFamily) getCkiIfActiveNow(kid keybase1.KID) (ret *ComputedKeyInfo, err error) {
	return ckf.getCkiIfActiveAtTime(kid, time.Now())
}

// FindActiveSibkey takes a given KID and finds the corresponding active sibkey
// in the current key family. If it cannot find the key, or if the key is no
// longer active (either by revocation, or by expiring), it will return an
// error saying why. Otherwise, it will return the key.  In this case either
// key is non-nil, or err is non-nil.
func (ckf ComputedKeyFamily) FindActiveSibkey(kid keybase1.KID) (key GenericKey, cki ComputedKeyInfo, err error) {
	return ckf.FindActiveSibkeyAtTime(kid, time.Now())
}

// As FindActiveSibkey, but for a specific time. Note that going back in time
// only affects expiration, not revocation. Thus this function is mainly useful
// for validating the sigchain, when each delegation and revocation is getting
// replayed in order.
func (ckf ComputedKeyFamily) FindActiveSibkeyAtTime(kid keybase1.KID, t time.Time) (key GenericKey, cki ComputedKeyInfo, err error) {
	liveCki, err := ckf.getCkiIfActiveAtTime(kid, t)
	if liveCki == nil || err != nil {
		// err gets returned.
	} else if !liveCki.Sibkey {
		err = BadKeyError{fmt.Sprintf("The key '%s' wasn't delegated as a sibkey", kid)}
	} else {
		key, err = ckf.kf.FindKeyWithKIDUnsafe(kid)
		cki = *liveCki
	}
	return
}

// FindActiveEncryptionSubkey takes a given KID and finds the corresponding
// active encryption subkey in the current key family.  If for any reason it
// cannot find the key, it will return an error saying why.  Otherwise, it will
// return the key.  In this case either key is non-nil, or err is non-nil.
func (ckf ComputedKeyFamily) FindActiveEncryptionSubkey(kid keybase1.KID) (GenericKey, error) {
	ki, err := ckf.getCkiIfActiveNow(kid)
	if err != nil {
		return nil, err
	}
	if ki.Sibkey {
		return nil, BadKeyError{fmt.Sprintf("The key '%s' was delegated as a sibkey", kid.String())}
	}
	key, err := ckf.kf.FindKeyWithKIDUnsafe(kid)
	if err != nil {
		return nil, err
	}
	if !CanEncrypt(key) {
		return nil, BadKeyError{fmt.Sprintf("The key '%s' cannot encrypt", kid.String())}
	}
	return key, nil
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
	sigid := tcl.GetSigID()
	tm := TclToKeybaseTime(tcl)

	if _, ok := ckf.kf.AllKeys[kid]; !ok {
		return KeyFamilyError{fmt.Sprintf("Delegated KID %s is not in the key family", kid.String())}
	}

	err = ckf.cki.Delegate(kid, tm, sigid, tcl.GetKID(), tcl.GetParentKid(), (tcl.GetRole() == DLGSibkey), tcl.GetCTime(), tcl.GetETime())
	return
}

// Delegate marks the given ComputedKeyInfos object that the given kid is now
// delegated, as of time tm, in sigid, as signed by signingKid, etc.
func (cki *ComputedKeyInfos) Delegate(kid keybase1.KID, tm *KeybaseTime, sigid keybase1.SigID, signingKid, parentKID keybase1.KID, isSibkey bool, ctime, etime time.Time) (err error) {
	G.Log.Debug("ComputeKeyInfos::Delegate To %s with %s at sig %s", kid.String(), signingKid, sigid.ToDisplayString(true))
	info, found := cki.Infos[kid]
	if !found {
		newInfo := NewComputedKeyInfo(false, false, KeyUncancelled, ctime.Unix(), etime.Unix())
		newInfo.DelegatedAt = tm
		info = &newInfo
		cki.Infos[kid] = info
	} else {
		info.Status = KeyUncancelled
		info.CTime = ctime.Unix()
		info.ETime = etime.Unix()
	}
	info.Delegations[sigid] = signingKid
	info.Sibkey = isSibkey
	cki.Sigs[sigid] = info

	// If it's a subkey, make a pointer from it to its parent,
	// and also from its parent to it.
	if parentKID.Exists() {
		info.Parent = parentKID
		if parent, found := cki.Infos[parentKID]; found {
			parent.Subkey = kid
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
func (ckf *ComputedKeyFamily) revokeSigs(sigs []keybase1.SigID, tcl TypedChainLink) error {
	for _, s := range sigs {
		if len(s) == 0 {
			continue
		}
		if err := ckf.RevokeSig(s, tcl); err != nil {
			return err
		}
	}
	return nil
}

// revokeKids operates on the per-kid revocations in the given
// TypedChainLink and applies them accordingly.
func (ckf *ComputedKeyFamily) revokeKids(kids []keybase1.KID, tcl TypedChainLink) (err error) {
	for _, k := range kids {
		if k.Exists() {
			if err = ckf.RevokeKid(k, tcl); err != nil {
				return
			}
		}
	}
	return
}

func (ckf *ComputedKeyFamily) RevokeSig(sig keybase1.SigID, tcl TypedChainLink) (err error) {
	if info, found := ckf.cki.Sigs[sig]; !found {
	} else if _, found = info.Delegations[sig]; !found {
		err = BadRevocationError{fmt.Sprintf("Can't find sigID %s in delegation list", sig)}
	} else {
		info.Status = KeyRevoked
		info.RevokedAt = TclToKeybaseTime(tcl)
	}
	return
}

func (ckf *ComputedKeyFamily) RevokeKid(kid keybase1.KID, tcl TypedChainLink) (err error) {
	if info, found := ckf.cki.Infos[kid]; found {
		info.Status = KeyRevoked
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
		kid := pgp.GetKID()
		if info, found := ckf.cki.Infos[kid]; !found {
			continue
		} else if info.Status != KeyUncancelled || !info.Sibkey {
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
// We'll need to do this when a key is locally generated.
func (kf *KeyFamily) LocalDelegate(key GenericKey) (err error) {
	if pgp, ok := key.(*PGPKeyBundle); ok {
		kf.pgp2kid[pgp.GetFingerprint()] = pgp.GetKID()
		kf.pgps = append(kf.pgps, pgp)
	}
	kf.AllKeys[key.GetKID()] = key
	return
}

// GetKeyRoleAtTime returns the KeyRole (sibkey/subkey/none), taking into
// account whether the key has been cancelled at time t.
func (ckf ComputedKeyFamily) GetKeyRoleAtTime(kid keybase1.KID, t time.Time) (ret KeyRole) {
	if info, err := ckf.getCkiIfActiveAtTime(kid, t); err != nil {
		ret = DLGNone
	} else if info.Sibkey {
		ret = DLGSibkey
	} else {
		ret = DLGSubkey
	}
	return
}

// GetKeyRole returns the KeyRole (sibkey/subkey/none), taking into account
// whether the key has been cancelled.
func (ckf ComputedKeyFamily) GetKeyRole(kid keybase1.KID) (ret KeyRole) {
	return ckf.GetKeyRoleAtTime(kid, time.Now())
}

// GetAllActiveSibkeys gets all active Sibkeys from given ComputedKeyFamily.
func (ckf ComputedKeyFamily) GetAllActiveSibkeysAtTime(t time.Time) (ret []GenericKey) {
	for kid, key := range ckf.kf.AllKeys {
		if ckf.GetKeyRoleAtTime(kid, t) == DLGSibkey && key != nil {
			ret = append(ret, key)
		}
	}
	return
}

// GetAllActiveSibkeys gets all active Sibkeys from given ComputedKeyFamily.
func (ckf ComputedKeyFamily) GetAllActiveSibkeys() (ret []GenericKey) {
	return ckf.GetAllActiveSibkeysAtTime(time.Now())
}

func (ckf ComputedKeyFamily) GetAllActiveSubkeysAtTime(t time.Time) (ret []GenericKey) {
	for kid, key := range ckf.kf.AllKeys {
		if ckf.GetKeyRoleAtTime(kid, t) == DLGSubkey && key != nil {
			ret = append(ret, key)
		}
	}
	return
}

func (ckf ComputedKeyFamily) GetAllActiveSubkeys() (ret []GenericKey) {
	return ckf.GetAllActiveSubkeysAtTime(time.Now())
}

func (ckf ComputedKeyFamily) GetAllActiveKeysForDevice(deviceID keybase1.DeviceID) ([]keybase1.KID, error) {
	_, deviceExists := ckf.cki.Devices[deviceID]
	if !deviceExists {
		return nil, fmt.Errorf("Device %s does not exist.", deviceID)
	}
	var ret []keybase1.KID
	// Find the sibkey(s) that belong to this device.
	for _, sibkey := range ckf.GetAllActiveSibkeys() {
		sibkeyKID := sibkey.GetKID()
		if ckf.cki.KIDToDeviceID[sibkeyKID] == deviceID {
			ret = append(ret, sibkeyKID)
			// For each sibkey we find, get all its subkeys too.
			for _, subkey := range ckf.GetAllActiveSubkeys() {
				subkeyKID := subkey.GetKID()
				if ckf.cki.Infos[subkeyKID].Parent.Equal(sibkeyKID) {
					ret = append(ret, subkeyKID)
				}
			}
		}
	}
	return ret, nil
}

// HasActiveKey returns if the given ComputeKeyFamily has any active keys.
// The key has to be in the server-given KeyFamily and also in our ComputedKeyFamily.
// The former check is so that we can handle the case nuked sigchains.
func (ckf ComputedKeyFamily) HasActiveKey() bool {
	for kid := range ckf.kf.AllKeys {
		if ckf.GetKeyRole(kid) == DLGSibkey {
			return true
		}
	}
	return false
}

// GetActivePGPKeys gets the active PGP keys from the ComputedKeyFamily.
// If sibkey is False it will return all active PGP keys. Otherwise, it
// will return only the Sibkeys. Note the keys need to be non-canceled,
// and non-expired.
func (ckf ComputedKeyFamily) GetActivePGPKeys(sibkey bool) (ret []*PGPKeyBundle) {
	for _, pgp := range ckf.kf.pgps {
		role := ckf.GetKeyRole(pgp.GetKID())
		if (sibkey && role == DLGSibkey) || role != DLGNone {
			ret = append(ret, pgp)
		}
	}
	return
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

	did := dobj.ID
	kid := dobj.Kid

	G.Log.Debug("| Device ID=%s; KID=%s", did, kid.String())

	var prevKid keybase1.KID
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
	if prevKid.IsValid() {
		G.Log.Debug("| Clear out old key")
		delete(ckf.cki.KIDToDeviceID, prevKid)
	}

	if kid.IsValid() {
		ckf.cki.KIDToDeviceID[kid] = did
	}

	// Last-writer wins on the Web device
	if dobj != nil && dobj.IsWeb() {
		G.Log.Debug("| Set Web/DetKey Device")
		ckf.cki.WebDeviceID = dobj.ID
	}

	return
}

func (ckf *ComputedKeyFamily) getSibkeyKidForDevice(did keybase1.DeviceID) (keybase1.KID, error) {
	G.Log.Debug("+ getSibkeyKidForDevice(%v)", did)
	G.Log.Debug("| Devices map: %+v", ckf.cki.Devices)

	var kid keybase1.KID
	device, found := ckf.cki.Devices[did]
	if !found {
		G.Log.Debug("device %s not found in cki.Devices", did)
		return kid, ErrNoDevice
	}
	if !device.Kid.IsValid() {
		G.Log.Debug("device found, but Kid invalid")
		return kid, fmt.Errorf("invalid kid for device %s", did)
	}

	G.Log.Debug("device found, kid: %s", device.Kid.String())
	return device.Kid, nil
}

// GetSibkeyForDevice gets the current per-device key for the given Device. Will
// return nil if one isn't found, and set err for a real error. The sibkey should
// be a signing key, not an encryption key of course.
func (ckf *ComputedKeyFamily) GetSibkeyForDevice(did keybase1.DeviceID) (key GenericKey, err error) {
	var kid keybase1.KID
	kid, err = ckf.getSibkeyKidForDevice(did)
	if kid.Exists() {
		key, _, err = ckf.FindActiveSibkey(kid)
	}
	return
}

// GetCurrentDevice returns the current device.
func (ckf *ComputedKeyFamily) GetCurrentDevice(g *GlobalContext) (*Device, error) {
	if g == nil {
		g = G
	}
	did := g.Env.GetDeviceID()
	if did.IsNil() {
		return nil, NotProvisionedError{}
	}

	dev, ok := ckf.cki.Devices[did]
	if !ok {
		return nil, NotFoundError{}
	}

	return dev, nil
}

// GetEncryptionSubkeyForDevice gets the current encryption subkey for the given
// device.  Note that many devices might share an encryption public key but
// might have different secret keys.
func (ckf *ComputedKeyFamily) GetEncryptionSubkeyForDevice(did keybase1.DeviceID) (key GenericKey, err error) {
	var kid keybase1.KID
	if kid, err = ckf.getSibkeyKidForDevice(did); err != nil {
		return
	}
	if kid.IsNil() {
		return
	}
	if cki, found := ckf.cki.Infos[kid]; !found {
		return
	} else if !cki.Subkey.IsValid() {
		return
	} else {
		key, err = ckf.FindActiveEncryptionSubkey(cki.Subkey)
	}
	return
}

// GetDeviceForKey gets the device that this key is bound to, if any.
func (ckf *ComputedKeyFamily) GetDeviceForKey(key GenericKey) (ret *Device, err error) {
	return ckf.getDeviceForKid(key.GetKID())
}

func (ckf *ComputedKeyFamily) getDeviceForKid(kid keybase1.KID) (ret *Device, err error) {
	if didString, found := ckf.cki.KIDToDeviceID[kid]; found {
		ret = ckf.cki.Devices[didString]
	}
	return
}

// IsDetKey tells if the given Key represents a deterministically-generated
// Web key
func (ckf *ComputedKeyFamily) IsDetKey(key GenericKey) (ret bool, err error) {

	// First try to see if the key itself is a detkey
	if ret, err = ckf.isDetKeyHelper(key.GetKID()); ret || err != nil {
		return
	}

	// Then see if the parent is a detkey and we're a subkey of it.
	if info, found := ckf.cki.Infos[key.GetKID()]; found && info.Parent.IsValid() && !info.Sibkey {
		ret, err = ckf.isDetKeyHelper(info.Parent)
	}
	return
}

// isDetKeyHelper looks at the given KID (in hex) and sees if it is marked as a
// deterministic Key (if the IsWeb() flag is on).  It won't look up or down the
// key graph.
func (ckf *ComputedKeyFamily) isDetKeyHelper(kid keybase1.KID) (ret bool, err error) {
	var dev *Device
	if dev, err = ckf.getDeviceForKid(kid); err != nil {
		return
	}
	if dev == nil {
		return
	}
	ret = dev.IsWeb()
	return
}

func (ckf *ComputedKeyFamily) GetAllDevices() []*Device {
	devices := []*Device{}
	for _, device := range ckf.cki.Devices {
		devices = append(devices, device)
	}
	return devices
}
