// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// A KeyFamily is a group of sibling keys that have equal power for a user.
// A family can consist of 1 PGP keys, and arbitrarily many NaCl Sibkeys.
// There also can be some subkeys dangling off for ECDH.
package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	Contextified

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

	RevokedAt *KeybaseTime
	RevokedBy keybase1.KID

	// For PGP keys, the active version of the key. If unspecified, use the
	// legacy behavior of combining every instance of this key that we got from
	// the server minus revocations.
	ActivePGPHash string
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
	Contextified

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

	// For each generation, the public KID that corresponds to the shared
	// DH key. We're not keeping these in ComputedKeyFamily for now. For generation=0,
	// we expect a nil KID
	SharedDHKeys map[keybase1.SharedDHKeyGeneration]keybase1.SharedDHKey
}

// As returned by user/lookup.json
type RawKeyFamily struct {
	AllBundles []string `json:"all_bundles"`
}

// PGPKeySet represents a collection of versions of a PGP key. It includes a
// merged version of the key without revocations, and each individual version
// of the key with revocations intact.
type PGPKeySet struct {
	Contextified
	PermissivelyMergedKey *PGPKeyBundle
	KeysByHash            map[string]*PGPKeyBundle
}

func (s *PGPKeySet) addKey(key *PGPKeyBundle) error {
	fullHash, err := key.FullHash()
	if err != nil {
		return err
	}

	// Only the KID (and sometimes the fingerprint) of PGP keys has
	// historically been signed into the sigchain. When validating a sigchain
	// and multiple versions of the PGP key are available (which may be
	// different in terms of subkeys, UIDs, and revocations) we chose to merge
	// every version and ignore revocations. This stops anyone from breaking
	// their sigchain by uploading a revoked version of their PGP key, but also
	// creates a vulnerability when Alice's key is compromised and she revokes
	// it PGP-style without revoking it sigchain-style: Keybase clients will
	// continue to accept the key, Mallory can now make sigchain links as
	// Alice.
	//
	// As a long term solution, we decided that PGP keys' full hashes over time
	// should be tracked in the sigchain so that the client can know which
	// version to use to validate each link. This is detailed in issue #544.
	//
	// PGPKeySet keeps both the individual versions of the key, indexed by
	// hash, and the permissively-merged version to support both the old
	// behavior (for sigchains or sections of sigchains with no specific PGP
	// key hash) and the new behavior.

	s.G().Log.Debug("adding PGP kid %s with full hash %s", key.GetKID().String(), fullHash)
	s.KeysByHash[fullHash] = key

	strippedKey := key.StripRevocations()
	if s.PermissivelyMergedKey == nil {
		s.PermissivelyMergedKey = strippedKey
	} else {
		s.PermissivelyMergedKey.MergeKey(strippedKey)
	}
	return nil
}

// Once the client downloads a RawKeyFamily, it converts it into a KeyFamily,
// which has some additional information about Fingerprints and PGP keys
type KeyFamily struct {
	// These fields are computed on the client side, so they can be trusted.
	pgp2kid map[PGPFingerprint]keybase1.KID
	kid2pgp map[keybase1.KID]PGPFingerprint

	AllKIDs map[keybase1.KID]bool

	// PGP keys have a permissively merged version and individual versions by
	// hash. See the comment in PGPKeySet.addKey, above, for details.
	PGPKeySets map[keybase1.KID]*PGPKeySet
	SingleKeys map[keybase1.KID]GenericKey // Currently just NaCl keys

	BundlesForTesting []string

	Contextified
}

// ComputedKeyFamily is a joining of two sets of data; the KeyFamily is
// what the server returned and is not to be trusted; the ComputedKeyInfos
// is what we compute as a result of playing the user's sigchain forward.
type ComputedKeyFamily struct {
	Contextified
	kf  *KeyFamily
	cki *ComputedKeyInfos
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
		SharedDHKeys:  make(map[keybase1.SharedDHKeyGeneration]keybase1.SharedDHKey),
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

	for k, v := range cki.SharedDHKeys {
		ret.SharedDHKeys[k] = v
	}

	return ret
}

func (kf KeyFamily) ShallowCopy() *KeyFamily {
	ret := &KeyFamily{
		Contextified: NewContextified(kf.G()),
		pgp2kid:      make(map[PGPFingerprint]keybase1.KID),
		kid2pgp:      make(map[keybase1.KID]PGPFingerprint),
		AllKIDs:      make(map[keybase1.KID]bool),
		PGPKeySets:   make(map[keybase1.KID]*PGPKeySet),
		SingleKeys:   make(map[keybase1.KID]GenericKey),
	}

	for k, v := range kf.pgp2kid {
		ret.pgp2kid[k] = v
	}

	for k, v := range kf.kid2pgp {
		ret.kid2pgp[k] = v
	}

	for k, v := range kf.AllKIDs {
		ret.AllKIDs[k] = v
	}

	for k, v := range kf.PGPKeySets {
		ret.PGPKeySets[k] = v
	}

	for k, v := range kf.SingleKeys {
		ret.SingleKeys[k] = v
	}

	return ret
}

func (ckf ComputedKeyFamily) ShallowCopy() *ComputedKeyFamily {
	ret := &ComputedKeyFamily{
		Contextified: NewContextified(ckf.G()),
	}
	if ckf.kf != nil {
		ret.kf = ckf.kf.ShallowCopy()
	}
	if ckf.cki != nil {
		ret.cki = ckf.cki.ShallowCopy()
	}
	return ret
}

func NewComputedKeyInfos(g *GlobalContext) *ComputedKeyInfos {
	return &ComputedKeyInfos{
		Contextified:  NewContextified(g),
		Infos:         make(map[keybase1.KID]*ComputedKeyInfo),
		Sigs:          make(map[keybase1.SigID]*ComputedKeyInfo),
		Devices:       make(map[keybase1.DeviceID]*Device),
		KIDToDeviceID: make(map[keybase1.KID]keybase1.DeviceID),
		SharedDHKeys:  make(map[keybase1.SharedDHKeyGeneration]keybase1.SharedDHKey),
	}
}

func NewComputedKeyInfo(eldest, sibkey bool, status KeyStatus, ctime, etime int64, activePGPHash string) ComputedKeyInfo {
	return ComputedKeyInfo{
		Eldest:        eldest,
		Sibkey:        sibkey,
		Status:        status,
		CTime:         ctime,
		ETime:         etime,
		Delegations:   make(map[keybase1.SigID]keybase1.KID),
		ActivePGPHash: activePGPHash,
	}
}

func (cki ComputedKeyInfos) InsertLocalEldestKey(kid keybase1.KID) {
	// CTime and ETime are both initialized to zero, meaning that (until we get
	// updates from the server) this key never expires.
	eldestCki := NewComputedKeyInfo(true, true, KeyUncancelled, 0, 0, "" /* activePGPHash */)
	cki.Insert(kid, &eldestCki)
}

// For use when there are no chain links at all, so all we can do is trust the
// eldest key that the server reported.
func (cki ComputedKeyInfos) InsertServerEldestKey(eldestKey GenericKey, un NormalizedUsername) error {
	kbid := KeybaseIdentity(un)
	if pgp, ok := eldestKey.(*PGPKeyBundle); ok {

		// In the future, we might chose to ignore this etime, as we do in
		// InsertEldestLink below. When we do make that change, be certain
		// to update the comment in PGPKeyBundle#CheckIdentity to reflect it.
		// For now, we continue to honor the foo_user@keybase.io etime in the case
		// there's no sigchain link over the key to specify a different etime.
		match, ctime, etime := pgp.CheckIdentity(kbid)
		if match {
			eldestCki := NewComputedKeyInfo(true, true, KeyUncancelled, ctime, etime, "" /* activePGPHash */)
			cki.Insert(eldestKey.GetKID(), &eldestCki)
			return nil
		}
		return KeyFamilyError{"InsertServerEldestKey found a non-matching eldest key."}
	}
	return KeyFamilyError{"InsertServerEldestKey found a non-PGP key."}
}

func (ckf ComputedKeyFamily) InsertEldestLink(tcl TypedChainLink, username NormalizedUsername) (err error) {
	kid := tcl.GetKID()
	_, err = ckf.FindKeyWithKIDUnsafe(kid)
	if err != nil {
		return
	}

	// We don't need to check the signature on the first link, because
	// verifySubchain will take care of that.
	ctime := tcl.GetCTime().Unix()
	etime := tcl.GetETime().Unix()

	eldestCki := NewComputedKeyInfo(true, true, KeyUncancelled, ctime, etime, tcl.GetPGPFullHash())

	ckf.cki.Insert(kid, &eldestCki)
	return nil
}

// ParseKeyFamily takes as input a dictionary from a JSON file and returns
// a parsed version for manipulation in the program.
func ParseKeyFamily(g *GlobalContext, jw *jsonw.Wrapper) (ret *KeyFamily, err error) {
	defer g.Trace("ParseKeyFamily", func() error { return err })()

	if jw == nil || jw.IsNil() {
		err = KeyFamilyError{"nil record from server"}
		return
	}

	kf := KeyFamily{
		Contextified: NewContextified(g),
		pgp2kid:      make(map[PGPFingerprint]keybase1.KID),
		kid2pgp:      make(map[keybase1.KID]PGPFingerprint),
	}

	// Fill in AllKeys. Somewhat wasteful but probably faster than
	// using Jsonw wrappers, and less error-prone.
	var rkf RawKeyFamily
	if err = jw.UnmarshalAgain(&rkf); err != nil {
		return
	}
	kf.BundlesForTesting = rkf.AllBundles

	// Parse the keys, and collect the PGP keys to map their fingerprints.
	kf.AllKIDs = make(map[keybase1.KID]bool)
	kf.PGPKeySets = make(map[keybase1.KID]*PGPKeySet)
	kf.SingleKeys = make(map[keybase1.KID]GenericKey)
	for i, bundle := range rkf.AllBundles {
		newKey, w, err := ParseGenericKey(bundle)

		// Some users have some historical bad keys, so no reason to crap
		// out if we can't parse them, especially if there are others than
		// can do just as well.
		if err != nil {
			g.Log.Notice("Failed to parse public key at position %d", i)
			g.Log.Debug("Key parsing error: %s", err)
			g.Log.Debug("Full key dump follows")
			g.Log.Debug(bundle)
			continue
		}
		w.Warn(g)

		kid := newKey.GetKID()

		if pgp, isPGP := newKey.(*PGPKeyBundle); isPGP {
			ks, ok := kf.PGPKeySets[kid]
			if !ok {
				ks = &PGPKeySet{NewContextified(g), nil, make(map[string]*PGPKeyBundle)}
				kf.PGPKeySets[kid] = ks

				fp := pgp.GetFingerprint()
				kf.pgp2kid[fp] = kid
				kf.kid2pgp[kid] = fp
			}
			ks.addKey(pgp)
		} else {
			kf.SingleKeys[kid] = newKey
		}
		kf.AllKIDs[kid] = true
	}

	ret = &kf
	return
}

// FindKeyWithKIDUnsafe returns a key given a KID. It doesn't check if the key
// is expired or revoked, so most callers should use the FindActive* methods.
func (ckf ComputedKeyFamily) FindKeyWithKIDUnsafe(kid keybase1.KID) (GenericKey, error) {
	if key, ok := ckf.kf.SingleKeys[kid]; ok {
		return key, nil
	}
	if ks, ok := ckf.kf.PGPKeySets[kid]; ok {
		if ckf.cki != nil {
			if cki, found := ckf.cki.Infos[kid]; found && cki.ActivePGPHash != "" {
				if key, ok := ks.KeysByHash[cki.ActivePGPHash]; ok {
					return key, nil
				}
				return nil, NoKeyError{fmt.Sprintf("Sigchain specified that KID %s is a PGP key with hash %s but no version of the key with that hash was found", kid, cki.ActivePGPHash)}
			}
		}
		return ks.PermissivelyMergedKey, nil
	}
	return nil, KeyFamilyError{fmt.Sprintf("No key found for %s", kid)}
}

func (ckf ComputedKeyFamily) getCkiIfActiveAtTime(kid keybase1.KID, t time.Time) (ret *ComputedKeyInfo, err error) {
	unixTime := t.Unix()
	if ki := ckf.cki.Infos[kid]; ki == nil {
		err = NoKeyError{fmt.Sprintf("The key '%s' wasn't found", kid)}
	} else if ki.Status != KeyUncancelled {
		err = KeyRevokedError{fmt.Sprintf("The key '%s' is no longer active", kid)}
	} else if ki.ETime > 0 && unixTime > ki.ETime {
		formatStr := "Mon Jan 2 15:04:05 -0700 MST 2006"
		ckf.G().Log.Warning("Checking status of key %s\n    with respect to time [%s],\n    found it had expired at [%s].",
			kid, t.Format(formatStr), time.Unix(ki.ETime, 0).Format(formatStr))
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
		key, err = ckf.FindKeyWithKIDUnsafe(kid)
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
	key, err := ckf.FindKeyWithKIDUnsafe(kid)
	if err != nil {
		return nil, err
	}
	if !CanEncrypt(key) {
		return nil, BadKeyError{fmt.Sprintf("The key '%s' cannot encrypt", kid.String())}
	}
	return key, nil
}

func (ckf ComputedKeyFamily) FindKIDFromFingerprint(fp PGPFingerprint) (kid keybase1.KID, err error) {
	kid, ok := ckf.kf.pgp2kid[fp]
	if !ok {
		return kid, NoKeyError{fmt.Sprintf("No key found in key family for %q", fp)}
	}
	return kid, nil
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

	if sdhk, ok := tcl.(*SharedDHKeyChainLink); ok {
		return ckf.cki.DelegateSharedDHKey(sdhk)
	}

	kid := tcl.GetDelegatedKid()
	sigid := tcl.GetSigID()
	tm := TclToKeybaseTime(tcl)

	if _, err := ckf.FindKeyWithKIDUnsafe(kid); err != nil {
		return KeyFamilyError{fmt.Sprintf("Delegated KID %s is not in the key family", kid.String())}
	}

	err = ckf.cki.Delegate(kid, tm, sigid, tcl.GetKID(), tcl.GetParentKid(), tcl.GetPGPFullHash(), (tcl.GetRole() == DLGSibkey), tcl.GetCTime(), tcl.GetETime())
	return
}

// Delegate marks the given ComputedKeyInfos object that the given kid is now
// delegated, as of time tm, in sigid, as signed by signingKid, etc.
func (cki *ComputedKeyInfos) Delegate(kid keybase1.KID, tm *KeybaseTime, sigid keybase1.SigID, signingKid, parentKID keybase1.KID, pgpHash string, isSibkey bool, ctime, etime time.Time) (err error) {
	cki.G().Log.Debug("ComputeKeyInfos::Delegate To %s with %s at sig %s", kid.String(), signingKid, sigid.ToDisplayString(true))
	info, found := cki.Infos[kid]
	if !found {
		newInfo := NewComputedKeyInfo(false, false, KeyUncancelled, ctime.Unix(), etime.Unix(), pgpHash)
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

// DelegateSharedDHKey inserts the new shared DH public key into the
// list of known generations of DH public keys.
func (cki *ComputedKeyInfos) DelegateSharedDHKey(s *SharedDHKeyChainLink) (err error) {
	cki.SharedDHKeys[s.generation] = keybase1.SharedDHKey{
		Gen:   int(s.generation),
		Kid:   s.GetDelegatedKid(),
		Seqno: int(s.GetSeqno()),
	}
	return nil
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

// SetPGPHash sets the authoritative version (by hash) of a PGP key
func (ckf *ComputedKeyFamily) SetActivePGPHash(kid keybase1.KID, hash string) {
	found := false
	if ks, ok := ckf.kf.PGPKeySets[kid]; ok && ks != nil && ks.KeysByHash[hash] != nil {
		found = true
	}
	if !found {
		// We've noted this case in the wild (see CORE-4771). It occured
		// because the server accepted a new Cv25519 key, but an old client
		// failed to parse it in ParseKeyFamily above. So just warn here.
		// We expect, though, that if you get this Warning there is trouble ahead,
		// and FindKeyWithKIDUnsafe will return nil.
		ckf.G().Log.Warning("Didn't have a PGP key for %s with hash %s", kid, hash)
	}
	if _, ok := ckf.cki.Infos[kid]; ok {
		ckf.cki.Infos[kid].ActivePGPHash = hash
	} else {
		ckf.G().Log.Debug("| Skipped setting active hash, since key was never delegated")
	}
}

// ClearActivePGPHash clears authoritative hash of PGP key, after a revoke.
func (ckf *ComputedKeyFamily) ClearActivePGPHash(kid keybase1.KID) {
	if _, ok := ckf.cki.Infos[kid]; ok {
		ckf.cki.Infos[kid].ActivePGPHash = ""
	} else {
		ckf.G().Log.Debug("| Skipped clearing active hash, since key was never delegated")
	}
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
	} else if kid, found := info.Delegations[sig]; found {
		info.Status = KeyRevoked
		info.RevokedAt = TclToKeybaseTime(tcl)
		info.RevokedBy = tcl.GetKID()

		if KIDIsPGP(kid) {
			ckf.ClearActivePGPHash(kid)
		}
	} else {
		err = BadRevocationError{fmt.Sprintf("Can't find sigID %s in delegation list", sig)}
	}
	return
}

func (ckf *ComputedKeyFamily) RevokeKid(kid keybase1.KID, tcl TypedChainLink) (err error) {
	if info, found := ckf.cki.Infos[kid]; found {
		info.Status = KeyRevoked
		info.RevokedAt = TclToKeybaseTime(tcl)
		info.RevokedBy = tcl.GetKID()

		if KIDIsPGP(kid) {
			ckf.ClearActivePGPHash(kid)
		}
	}
	return
}

// FindKeybaseName looks at all PGP keys in this key family that are active
// sibkeys to find a key with a signed identity of <name@keybase.io>. IF
// found return true, and otherwise false.
func (ckf ComputedKeyFamily) FindKeybaseName(s string) bool {
	kem := KeybaseEmailAddress(s)
	for kid := range ckf.kf.PGPKeySets {
		if info, found := ckf.cki.Infos[kid]; !found {
			continue
		} else if info.Status != KeyUncancelled || !info.Sibkey {
			continue
		}
		pgp := ckf.kf.PGPKeySets[kid].PermissivelyMergedKey
		if pgp.FindEmail(kem) {
			ckf.G().Log.Debug("| Found self-sig for %s in key ID: %s", s, kid)
			return true
		}
	}
	return false
}

// LocalDelegate performs a local key delegation, without the server's permissions.
// We'll need to do this when a key is locally generated.
func (kf *KeyFamily) LocalDelegate(key GenericKey) (err error) {
	if pgp, ok := key.(*PGPKeyBundle); ok {
		kid := pgp.GetKID()
		kf.pgp2kid[pgp.GetFingerprint()] = kid
	}
	kf.SingleKeys[key.GetKID()] = key
	return
}

// GetKeyRoleAtTime returns the KeyRole (sibkey/subkey/none), taking into
// account whether the key has been cancelled at time t.
func (ckf ComputedKeyFamily) GetKeyRoleAtTime(kid keybase1.KID, t time.Time) (ret KeyRole) {
	if info, err := ckf.getCkiIfActiveAtTime(kid, t); err != nil {
		ckf.G().Log.Debug("GetKeyRoleAtTime %s, %s => err %s", kid, t, err)
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
func (ckf ComputedKeyFamily) GetAllActiveKeysWithRoleAtTime(role KeyRole, t time.Time) (ret []GenericKey) {
	for kid := range ckf.kf.AllKIDs {
		if ckf.GetKeyRoleAtTime(kid, t) == role {
			key, err := ckf.FindKeyWithKIDUnsafe(kid)
			if err != nil {
				ckf.G().Log.Warning("GetAllActiveKeysWithRoleAtTime: Error in getting KID %s: %s", kid, err)
			}
			if key == nil {
				ckf.G().Log.Warning("GetAllActiveKeysWithRoleAtTime: Null key for KID %s", kid)
			} else {
				ret = append(ret, key)
			}
		}
	}
	return
}

// GetAllActiveSibkeys gets all active Sibkeys from given ComputedKeyFamily.
func (ckf ComputedKeyFamily) GetAllActiveSibkeysAtTime(t time.Time) []GenericKey {
	return ckf.GetAllActiveKeysWithRoleAtTime(DLGSibkey, t)
}

// GetAllActiveSibkeys gets all active Sibkeys from given ComputedKeyFamily.
func (ckf ComputedKeyFamily) GetAllActiveSibkeys() []GenericKey {
	return ckf.GetAllActiveSibkeysAtTime(time.Now())
}

func (ckf ComputedKeyFamily) GetAllActiveSubkeysAtTime(t time.Time) (ret []GenericKey) {
	return ckf.GetAllActiveKeysWithRoleAtTime(DLGSubkey, t)
}

func (ckf ComputedKeyFamily) GetAllActiveSubkeys() []GenericKey {
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
	for kid := range ckf.kf.AllKIDs {
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
	for kid := range ckf.kf.PGPKeySets {
		role := ckf.GetKeyRole(kid)
		if (sibkey && role == DLGSibkey) || role != DLGNone {
			if key, err := ckf.FindKeyWithKIDUnsafe(kid); err == nil {
				ret = append(ret, key.(*PGPKeyBundle))
			} else {
				ckf.G().Log.Errorf("KID %s was in a KeyFamily's list of PGP keys, but the key doesn't exist: %s", kid, err)
			}
		}
	}
	return
}

type RevokedKey struct {
	Key       GenericKey
	RevokedAt *KeybaseTime
	RevokedBy keybase1.KID
}

func (ckf ComputedKeyFamily) GetRevokedKeys() []RevokedKey {
	ckf.G().Log.Debug("+ GetRevokedKeys")
	defer ckf.G().Log.Debug("- GetRevokedKeys")

	var revokedKeys []RevokedKey
	for kid := range ckf.kf.AllKIDs {
		ki, ok := ckf.cki.Infos[kid]
		if !ok || ki == nil {
			ckf.G().Log.Debug("KID %s not in cki.Infos (likely belongs to a previous subchain). Skipping.", kid)
			continue
		}
		if ki.Status != KeyRevoked {
			continue
		}
		if ki.RevokedAt == nil {
			ckf.G().Log.Errorf("KID %s: status is KeyRevoked, but RevokedAt is nil", kid)
			continue
		}
		if ki.RevokedBy.IsNil() {
			ckf.G().Log.Debug("KID %s: RevokedAt is non-nil, but RevokedBy is nil, probably just old", kid)
		}

		key, err := ckf.FindKeyWithKIDUnsafe(kid)
		if err != nil {
			ckf.G().Log.Errorf("No key found for %s in ckf", kid)
			continue
		}

		revokedKeys = append(revokedKeys, RevokedKey{Key: key, RevokedAt: ki.RevokedAt, RevokedBy: ki.RevokedBy})
	}

	return revokedKeys
}

func (ckf ComputedKeyFamily) GetDeletedKeys() []GenericKey {
	ckf.G().Log.Debug("+ GetDeletedKeys")
	defer ckf.G().Log.Debug("- GetDeletedKeys")

	var keys []GenericKey
	for kid := range ckf.kf.AllKIDs {
		_, ok := ckf.cki.Infos[kid]
		if ok {
			// key in cki.Infos, so it is in the current subchain, skip it.
			continue
		}
		key, err := ckf.FindKeyWithKIDUnsafe(kid)
		if err != nil {
			ckf.G().Log.Errorf("No key found for %s in ckf", kid)
			continue
		}
		keys = append(keys, key)
	}
	return keys
}

// UpdateDevices takes the Device object from the given ChainLink
// and updates keys to reflects any device changes encoded therein.
func (ckf *ComputedKeyFamily) UpdateDevices(tcl TypedChainLink) (err error) {

	var dobj *Device
	if dobj = tcl.GetDevice(); dobj == nil {
		ckf.G().VDL.Log(VLog1, "Short-circuit of UpdateDevices(); not a device link")
		return
	}

	defer ckf.G().Trace("UpdateDevice", func() error { return err })()

	did := dobj.ID
	kid := dobj.Kid

	ckf.G().Log.Debug("| Device ID=%s; KID=%s", did, kid.String())

	var prevKid keybase1.KID
	if existing, found := ckf.cki.Devices[did]; found {
		ckf.G().Log.Debug("| merge with existing")
		prevKid = existing.Kid
		existing.Merge(dobj)
		dobj = existing
	} else {
		ckf.G().Log.Debug("| New insert")
		ckf.cki.Devices[did] = dobj
	}

	// If a KID is specified, we should clear out any previous KID from the
	// KID->Device map. But if not, leave the map as it is. Later "device"
	// blobs in the sigchain aren't required to repeat the KID every time.
	if kid.IsValid() {
		if prevKid.IsValid() {
			ckf.G().Log.Debug("| Clear out old key")
			delete(ckf.cki.KIDToDeviceID, prevKid)
		}
		ckf.cki.KIDToDeviceID[kid] = did
	}

	return
}

func (ckf *ComputedKeyFamily) getSibkeyKidForDevice(did keybase1.DeviceID) (keybase1.KID, error) {
	ckf.G().Log.Debug("+ getSibkeyKidForDevice(%v)", did)
	ckf.G().Log.Debug("| Devices map: %+v", ckf.cki.Devices)

	var kid keybase1.KID
	device, found := ckf.cki.Devices[did]
	if !found {
		ckf.G().Log.Debug("device %s not found in cki.Devices", did)
		return kid, NoDeviceError{Reason: fmt.Sprintf("for device ID %s", did)}
	}
	if !device.Kid.IsValid() {
		ckf.G().Log.Debug("device found, but Kid invalid")
		return kid, fmt.Errorf("invalid kid for device %s", did)
	}

	ckf.G().Log.Debug("device found, kid: %s", device.Kid.String())
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

// GetEncryptionSubkeyForDevice gets the current encryption subkey for the given device.
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

func (ckf *ComputedKeyFamily) HasActiveEncryptionSubkey() bool {
	for kid := range ckf.cki.Infos {
		if !kid.IsValid() {
			continue
		}
		if key, err := ckf.FindActiveEncryptionSubkey(kid); key != nil && err == nil {
			return true
		}
	}
	return false
}

// GetDeviceForKey gets the device that this key is bound to, if any.
func (ckf *ComputedKeyFamily) GetDeviceForKey(key GenericKey) (*Device, error) {
	return ckf.GetDeviceForKID(key.GetKID())
}

func (ckf *ComputedKeyFamily) GetDeviceForKID(kid keybase1.KID) (*Device, error) {
	dev, err := ckf.getDeviceForKidHelper(kid)
	if err == nil && dev != nil {
		return dev, nil
	}

	// this could be a subkey, so try to find device for the parent
	cki, found := ckf.cki.Infos[kid]
	if !found {
		return nil, NoDeviceError{Reason: fmt.Sprintf("for key ID %s", kid)}
	}
	parent := cki.Parent
	if parent.IsNil() {
		return nil, NoDeviceError{Reason: fmt.Sprintf("for key ID %s", kid)}
	}

	return ckf.getDeviceForKidHelper(parent)

}

func (ckf *ComputedKeyFamily) getDeviceForKidHelper(kid keybase1.KID) (ret *Device, err error) {
	if didString, found := ckf.cki.KIDToDeviceID[kid]; found {
		ret = ckf.cki.Devices[didString]
	}
	return
}

func (ckf *ComputedKeyFamily) GetAllDevices() []*Device {
	devices := []*Device{}
	for _, device := range ckf.cki.Devices {
		devices = append(devices, device)
	}
	return devices
}

func (ckf *ComputedKeyFamily) GetAllActiveDevices() []*Device {
	devices := []*Device{}
	for _, device := range ckf.cki.Devices {
		if device.IsActive() {
			devices = append(devices, device)
		}
	}
	return devices
}

func (ckf *ComputedKeyFamily) HasActiveDevice() bool {
	for _, device := range ckf.cki.Devices {
		if device.IsActive() {
			return true
		}
	}
	return false
}

// Returns (&senderType, err). A non-nil error indicates some unexpected
// condition (like the key doesn't exist at all), which should be propagated.
// If the sender type is nil, the key is active, and the caller should proceed
// with an identify. Otherwise the key is no longer active, and the sender type
// indicates why.
func (ckf ComputedKeyFamily) GetSaltpackSenderTypeIfInactive(kid keybase1.KID) (*keybase1.SaltpackSenderType, error) {
	info := ckf.cki.Infos[kid]
	if info == nil {
		// This shouldn't happen without a server bug/attack or a very unlikely
		// race condition (e.g. a user account reset between the API server
		// telling us they own a key, and the loaduser confirming it.)
		return nil, fmt.Errorf("Key %s not found in key infos", kid.String())
	}
	if info.Status == KeyRevoked {
		ret := keybase1.SaltpackSenderType_REVOKED
		return &ret, nil
	}
	if info.Status == KeyUncancelled {
		// TODO: Get rid of the whole concept of expiration?
		if info.GetETime().Before(time.Now()) && !info.GetETime().IsZero() {
			ret := keybase1.SaltpackSenderType_EXPIRED
			return &ret, nil
		}
		// An active key. The caller needs to do an identify to determine the
		// final sender type (UNTRACKED, TRACKING_BROKE, etc.).
		return nil, nil
	}
	// This also shouldn't happen without a server bug or a very unlikely race
	// condition.
	return nil, fmt.Errorf("Key %s neither active nor revoked (%d)", kid.String(), info.Status)
}

// If there aren't any shared DH keys in the current generation, return nil.
func (ckf *ComputedKeyFamily) GetLatestSharedDHKey() *keybase1.SharedDHKey {
	var currentGeneration keybase1.SharedDHKeyGeneration
	var ret *keybase1.SharedDHKey
	for generation, key := range ckf.cki.SharedDHKeys {
		if generation > currentGeneration {
			currentGeneration = generation
			// Avoid taking references to the loop variable.
			currentKey := key
			ret = &currentKey
		}
	}
	return ret
}
