// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"regexp"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	stellar1 "github.com/keybase/client/go/protocol/stellar1"
	jsonw "github.com/keybase/go-jsonw"
)

type UserBasic interface {
	GetUID() keybase1.UID
	GetName() string
}

var _ UserBasic = keybase1.UserPlusKeys{}

type User struct {
	// Raw JSON element read from the server or our local DB.
	basics     *jsonw.Wrapper
	publicKeys *jsonw.Wrapper
	pictures   *jsonw.Wrapper

	// Processed fields
	id          keybase1.UID
	name        string
	sigChainMem *SigChain
	idTable     *IdentityTable
	sigHints    *SigHints
	status      keybase1.StatusCode

	leaf MerkleUserLeaf

	// Loaded from publicKeys
	keyFamily *KeyFamily

	// Available on partially-copied clones of the User object
	ckfShallowCopy *ComputedKeyFamily

	dirty bool
	Contextified
}

func NewUserThin(name string, uid keybase1.UID) *User {
	return &User{name: name, id: uid}
}

func newUser(g *GlobalContext, o *jsonw.Wrapper, fromStorage bool) (*User, error) {
	uid, err := GetUID(o.AtKey("id"))
	if err != nil {
		return nil, fmt.Errorf("user object lacks an ID: %s", err)
	}
	name, err := o.AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil, fmt.Errorf("user object for %s lacks a name", uid)
	}

	// This field was a late addition, so cached objects might not have it.
	// If we load from storage and it wasn't there, then it's safe to assume
	// it's a 0. All server replies should have this field though.
	status, err := o.AtPath("basics.status").GetInt()
	if err != nil {
		if fromStorage {
			status = SCOk
		} else {
			return nil, fmt.Errorf("user object for %s lacks a status field", uid)
		}
	}

	kf, err := ParseKeyFamily(g, o.AtKey("public_keys"))
	if err != nil {
		return nil, err
	}

	return &User{
		basics:       o.AtKey("basics"),
		publicKeys:   o.AtKey("public_keys"),
		pictures:     o.AtKey("pictures"),
		keyFamily:    kf,
		id:           uid,
		name:         name,
		status:       keybase1.StatusCode(status),
		dirty:        false,
		Contextified: NewContextified(g),
	}, nil
}

func NewUserFromServer(g *GlobalContext, o *jsonw.Wrapper) (*User, error) {
	u, e := newUser(g, o, false)
	if e == nil {
		u.dirty = true
	}
	return u, e
}

func NewUserFromLocalStorage(g *GlobalContext, o *jsonw.Wrapper) (*User, error) {
	u, err := newUser(g, o, true)
	return u, err
}

func (u *User) GetNormalizedName() NormalizedUsername { return NewNormalizedUsername(u.name) }
func (u *User) GetName() string                       { return u.name }
func (u *User) GetUID() keybase1.UID                  { return u.id }
func (u *User) GetStatus() keybase1.StatusCode        { return u.status }

func (u *User) GetSalt() (salt []byte, err error) {
	saltHex, err := u.basics.AtKey("salt").GetString()
	if err != nil {
		return nil, err
	}
	salt, err = hex.DecodeString(saltHex)
	if err != nil {
		return nil, err
	}
	return salt, nil
}

func (u *User) GetIDVersion() (int64, error) {
	return u.basics.AtKey("id_version").GetInt64()
}

func (u *User) GetSigChainLastKnownSeqno() keybase1.Seqno {
	if u.sigChain() == nil {
		return 0
	}
	return u.sigChain().GetLastKnownSeqno()
}

func (u *User) GetSigChainLastKnownID() LinkID {
	if u.sigChain() == nil {
		return nil
	}
	return u.sigChain().GetLastKnownID()
}

func (u *User) GetCurrentEldestSeqno() keybase1.Seqno {
	if u.sigChain() == nil {
		// Note that NameWithEldestSeqno will return an error if you call it with zero.
		return 0
	}
	return u.sigChain().currentSubchainStart
}

func (u *User) ToUserVersion() keybase1.UserVersion {
	return keybase1.UserVersion{
		Uid:         u.GetUID(),
		EldestSeqno: u.GetCurrentEldestSeqno(),
	}
}

func (u *User) IsNewerThan(v *User) (bool, error) {
	var idvU, idvV int64
	var err error
	idvU, err = u.GetIDVersion()
	if err != nil {
		return false, err
	}
	idvV, err = v.GetIDVersion()
	if err != nil {
		return false, err
	}
	return ((idvU > idvV && u.GetSigChainLastKnownSeqno() >= v.GetSigChainLastKnownSeqno()) ||
		(idvU >= idvV && u.GetSigChainLastKnownSeqno() > v.GetSigChainLastKnownSeqno())), nil
}

func (u *User) GetKeyFamily() *KeyFamily {
	return u.keyFamily
}

func (u *User) GetComputedKeyInfos() *ComputedKeyInfos {
	if u.sigChain() == nil {
		return nil
	}
	return u.sigChain().GetComputedKeyInfos()
}

func (u *User) GetSigHintsVersion() int {
	if u.sigHints == nil {
		return 0
	}
	return u.sigHints.version
}

func (u *User) GetComputedKeyFamily() (ret *ComputedKeyFamily) {
	if u.sigChain() != nil && u.keyFamily != nil {
		cki := u.sigChain().GetComputedKeyInfos()
		if cki == nil {
			return nil
		}
		ret = &ComputedKeyFamily{cki: cki, kf: u.keyFamily, Contextified: u.Contextified}
	} else if u.ckfShallowCopy != nil {
		ret = u.ckfShallowCopy
	}
	return ret
}

// GetActivePGPKeys looks into the user's ComputedKeyFamily and
// returns only the active PGP keys.  If you want only sibkeys, then
// specify sibkey=true.
func (u *User) GetActivePGPKeys(sibkey bool) (ret []*PGPKeyBundle) {
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		ret = ckf.GetActivePGPKeys(sibkey)
	}
	return
}

// FilterActivePGPKeys returns the active pgp keys that match
// query.
func (u *User) FilterActivePGPKeys(sibkey bool, query string) []*PGPKeyBundle {
	keys := u.GetActivePGPKeys(sibkey)
	var res []*PGPKeyBundle
	for _, k := range keys {
		if KeyMatchesQuery(k, query, false) {
			res = append(res, k)
		}
	}
	return res
}

// GetActivePGPFingerprints looks into the user's ComputedKeyFamily and
// returns only the fingerprint of the active PGP keys.
// If you want only sibkeys, then // specify sibkey=true.
func (u *User) GetActivePGPFingerprints(sibkey bool) (ret []PGPFingerprint) {
	for _, pgp := range u.GetActivePGPKeys(sibkey) {
		ret = append(ret, pgp.GetFingerprint())
	}
	return
}

func (u *User) GetActivePGPKIDs(sibkey bool) (ret []keybase1.KID) {
	for _, pgp := range u.GetActivePGPKeys(sibkey) {
		ret = append(ret, pgp.GetKID())
	}
	return
}

func (u *User) GetDeviceSibkey() (GenericKey, error) {
	did := u.G().Env.GetDeviceIDForUsername(u.GetNormalizedName())
	if did.IsNil() {
		return nil, NotProvisionedError{}
	}
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		return nil, KeyFamilyError{"no key family available"}
	}
	return ckf.GetSibkeyForDevice(did)
}

func (u *User) GetDeviceSubkey() (subkey GenericKey, err error) {
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		err = KeyFamilyError{"no key family available"}
		return
	}
	did := u.G().Env.GetDeviceIDForUsername(u.GetNormalizedName())
	if did.IsNil() {
		err = NotProvisionedError{}
		return
	}
	return ckf.GetEncryptionSubkeyForDevice(did)
}

func (u *User) HasEncryptionSubkey() bool {
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		return ckf.HasActiveEncryptionSubkey()
	}
	return false
}

func (u *User) CheckBasicsFreshness(server int64) (current bool, err error) {
	var stored int64
	if stored, err = u.GetIDVersion(); err == nil {
		current = (stored >= server)
		if current {
			u.G().Log.Debug("| Local basics version is up-to-date @ version %d", stored)
		} else {
			u.G().Log.Debug("| Local basics version is out-of-date: %d < %d", stored, server)
		}
	}
	return
}

func (u *User) StoreSigChain(m MetaContext) error {
	var err error
	if u.sigChain() != nil {
		err = u.sigChain().Store(m)
	}
	return err
}

func (u *User) LoadSigChains(m MetaContext, f *MerkleUserLeaf, self bool) (err error) {
	defer TimeLog(fmt.Sprintf("LoadSigChains: %s", u.name), u.G().Clock().Now(), u.G().Log.Debug)

	loader := SigChainLoader{
		user:             u,
		self:             self,
		leaf:             f,
		chainType:        PublicChain,
		preload:          u.sigChain(),
		MetaContextified: NewMetaContextified(m),
	}

	u.sigChainMem, err = loader.Load()

	// Eventually load the others, but for now, this one is good enough
	return err
}

func (u *User) Store(m MetaContext) error {

	m.CDebugf("+ Store user %s", u.name)

	// These might be dirty, in which case we can write it back
	// to local storage. Note, this can be dirty even if the user is clean.
	if err := u.sigHints.Store(m); err != nil {
		return err
	}

	if !u.dirty {
		m.CDebugf("- Store for %s skipped; user wasn't dirty", u.name)
		return nil
	}

	if err := u.StoreSigChain(m); err != nil {
		return err
	}

	if err := u.StoreTopLevel(m); err != nil {
		return err
	}

	u.dirty = false
	m.CDebugf("- Store user %s -> OK", u.name)

	return nil
}

func (u *User) StoreTopLevel(m MetaContext) error {
	m.CDebugf("+ StoreTopLevel")

	jw := jsonw.NewDictionary()
	jw.SetKey("id", UIDWrapper(u.id))
	jw.SetKey("basics", u.basics)
	jw.SetKey("public_keys", u.publicKeys)
	jw.SetKey("pictures", u.pictures)

	err := u.G().LocalDb.Put(
		DbKeyUID(DBUser, u.id),
		[]DbKey{{Typ: DBLookupUsername, Key: u.name}},
		jw,
	)
	m.CDebugf("- StoreTopLevel -> %s", ErrToOk(err))
	return err
}

func (u *User) SyncedSecretKey(m MetaContext) (ret *SKB, err error) {
	if lctx := m.LoginContext(); lctx != nil {
		return u.getSyncedSecretKeyLogin(m, lctx)
	}
	return u.GetSyncedSecretKey(m)
}

func (u *User) getSyncedSecretKeyLogin(m MetaContext, lctx LoginContext) (ret *SKB, err error) {
	defer m.CTrace("User#getSyncedSecretKeyLogin", func() error { return err })()

	if err = lctx.RunSecretSyncer(m, u.id); err != nil {
		return
	}
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		m.CDebugf("| short-circuit; no Computed key family")
		return
	}

	ret, err = lctx.SecretSyncer().FindActiveKey(ckf)
	return
}

func (u *User) GetSyncedSecretKey(m MetaContext) (ret *SKB, err error) {
	defer m.CTrace("User#GetSyncedSecretKey", func() error { return err })()

	if err = u.SyncSecrets(m); err != nil {
		return
	}

	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		m.CDebugf("| short-circuit; no Computed key family")
		return
	}

	syncer, err := m.SyncSecrets()
	if err != nil {
		return nil, err
	}

	ret, err = syncer.FindActiveKey(ckf)
	return ret, err
}

// AllSyncedSecretKeys returns all the PGP key blocks that were
// synced to API server.  LoginContext can be nil if this isn't
// used while logging in, signing up.
func (u *User) AllSyncedSecretKeys(m MetaContext) (keys []*SKB, err error) {
	defer m.CTrace("User#AllSyncedSecretKeys", func() error { return err })()
	m.Dump()

	ss, err := m.SyncSecretsForUID(u.GetUID())
	if err != nil {
		return nil, err
	}

	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		m.CDebugf("| short-circuit; no Computed key family")
		return nil, nil
	}

	keys = ss.AllActiveKeys(ckf)
	return keys, nil
}

func (u *User) SyncSecrets(m MetaContext) error {
	_, err := m.SyncSecretsForUID(u.GetUID())
	return err
}

// May return an empty KID
func (u *User) GetEldestKID() (ret keybase1.KID) {
	return u.leaf.eldest
}

func (u *User) GetPublicChainTail() *MerkleTriple {
	if u.sigChainMem == nil {
		return nil
	}
	return u.sigChain().GetCurrentTailTriple()
}

func (u *User) IDTable() *IdentityTable {
	return u.idTable
}

// Return the active stellar public address for a user.
// Returns nil if there is none or it has not been loaded.
func (u *User) StellarAccountID() *stellar1.AccountID {
	if u.idTable == nil {
		return nil
	}
	return u.idTable.StellarAccountID()
}

func (u *User) sigChain() *SigChain {
	return u.sigChainMem
}

func (u *User) MakeIDTable() error {
	kid := u.GetEldestKID()
	if kid.IsNil() {
		return NoKeyError{"Expected a key but didn't find one"}
	}
	idt, err := NewIdentityTable(u.G(), kid, u.sigChain(), u.sigHints)
	if err != nil {
		return err
	}
	u.idTable = idt
	return nil
}

func (u *User) VerifySelfSig() error {

	u.G().Log.Debug("+ VerifySelfSig for user %s", u.name)

	if u.IDTable().VerifySelfSig(u.GetNormalizedName(), u.id) {
		u.G().Log.Debug("- VerifySelfSig via SigChain")
		return nil
	}

	if u.VerifySelfSigByKey() {
		u.G().Log.Debug("- VerifySelfSig via Key")
		return nil
	}

	u.G().Log.Debug("- VerifySelfSig failed")
	return fmt.Errorf("Failed to find a self-signature for %s", u.name)
}

func (u *User) VerifySelfSigByKey() (ret bool) {
	name := u.GetName()
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		ret = ckf.FindKeybaseName(name)
	}
	return
}

func (u *User) HasActiveKey() (ret bool) {
	u.G().Log.Debug("+ HasActiveKey")
	defer func() {
		u.G().Log.Debug("- HasActiveKey -> %v", ret)
	}()
	if u.GetEldestKID().IsNil() {
		u.G().Log.Debug("| no eldest KID; must have reset or be new")
		ret = false
		return
	}
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		u.G().Log.Debug("| Checking user's ComputedKeyFamily")
		ret = ckf.HasActiveKey()
		return
	}

	if u.sigChain() == nil {
		u.G().Log.Debug("User HasActiveKey: sig chain is nil")
	} else if u.sigChain().GetComputedKeyInfos() == nil {
		u.G().Log.Debug("User HasActiveKey: comp key infos is nil")
	}
	if u.keyFamily == nil {
		u.G().Log.Debug("User HasActiveKey: keyFamily is nil")
	}

	return false
}

func (u *User) Equal(other *User) bool {
	return u.id == other.id
}

func (u *User) TmpTrackChainLinkFor(username string, uid keybase1.UID) (tcl *TrackChainLink, err error) {
	return TmpTrackChainLinkFor(u.id, uid, u.G())
}

func TmpTrackChainLinkFor(me keybase1.UID, them keybase1.UID, g *GlobalContext) (tcl *TrackChainLink, err error) {
	g.Log.Debug("+ TmpTrackChainLinkFor for %s", them)
	tcl, err = LocalTmpTrackChainLinkFor(me, them, g)
	g.Log.Debug("- TmpTrackChainLinkFor for %s -> %v, %v", them, (tcl != nil), err)
	return tcl, err
}

func (u *User) TrackChainLinkFor(username NormalizedUsername, uid keybase1.UID) (*TrackChainLink, error) {
	u.G().Log.Debug("+ TrackChainLinkFor for %s", uid)
	defer u.G().Log.Debug("- TrackChainLinkFor for %s", uid)
	remote, e1 := u.remoteTrackChainLinkFor(username, uid)
	return TrackChainLinkFor(u.id, uid, remote, e1, u.G())
}

func TrackChainLinkFor(me keybase1.UID, them keybase1.UID, remote *TrackChainLink, remoteErr error, g *GlobalContext) (*TrackChainLink, error) {

	local, e2 := LocalTrackChainLinkFor(me, them, g)

	g.Log.Debug("| Load remote -> %v", (remote != nil))
	g.Log.Debug("| Load local -> %v", (local != nil))

	if remoteErr != nil && e2 != nil {
		return nil, remoteErr
	}

	if local == nil && remote == nil {
		return nil, nil
	}

	if local == nil && remote != nil {
		return remote, nil
	}

	if remote == nil && local != nil {
		g.Log.Debug("local expire %v: %s", local.tmpExpireTime.IsZero(), local.tmpExpireTime)
		return local, nil
	}

	if remote.GetCTime().After(local.GetCTime()) {
		g.Log.Debug("| Returning newer remote")
		return remote, nil
	}

	return local, nil
}

func (u *User) remoteTrackChainLinkFor(username NormalizedUsername, uid keybase1.UID) (*TrackChainLink, error) {
	if u.IDTable() == nil {
		return nil, nil
	}

	return u.IDTable().TrackChainLinkFor(username, uid)
}

// BaseProofSet creates a basic proof set for a user with their
// keybase and uid proofs and any pgp fingerprint proofs.
func (u *User) BaseProofSet() *ProofSet {
	proofs := []Proof{
		{Key: "keybase", Value: u.name},
		{Key: "uid", Value: u.id.String()},
	}
	for _, fp := range u.GetActivePGPFingerprints(true) {
		proofs = append(proofs, Proof{Key: PGPAssertionKey, Value: fp.String()})
	}

	return NewProofSet(proofs)
}

// localDelegateKey takes the given GenericKey and provisions it locally so that
// we can use the key without needing a refresh from the server.  The eventual
// refresh we do get from the server will clobber our work here.
func (u *User) localDelegateKey(key GenericKey, sigID keybase1.SigID, kid keybase1.KID, isSibkey bool, isEldest bool, merkleHashMeta keybase1.HashMeta, firstAppearedUnverified keybase1.Seqno) (err error) {
	if err = u.keyFamily.LocalDelegate(key); err != nil {
		return
	}
	if u.sigChain() == nil {
		err = NoSigChainError{}
		return
	}
	err = u.sigChain().LocalDelegate(u.keyFamily, key, sigID, kid, isSibkey, merkleHashMeta, firstAppearedUnverified)
	if isEldest {
		eldestKID := key.GetKID()
		u.leaf.eldest = eldestKID
	}
	return
}

func (u *User) localDelegatePerUserKey(perUserKey keybase1.PerUserKey) error {

	// Don't update the u.keyFamily. It doesn't manage per-user-keys.

	// Update sigchain which will update ckf/cki
	err := u.sigChain().LocalDelegatePerUserKey(perUserKey)
	if err != nil {
		return err
	}

	u.G().Log.Debug("User LocalDelegatePerUserKey gen:%v seqno:%v sig:%v enc:%v",
		perUserKey.Gen, perUserKey.Seqno, perUserKey.SigKID.String(), perUserKey.EncKID.String())
	return nil
}

func (u *User) SigChainBump(linkID LinkID, sigID keybase1.SigID) {
	u.SigChainBumpMT(MerkleTriple{LinkID: linkID, SigID: sigID})
}

func (u *User) SigChainBumpMT(mt MerkleTriple) {
	u.sigChain().Bump(mt)
}

func (u *User) GetDevice(id keybase1.DeviceID) (*Device, error) {
	if u.GetComputedKeyFamily() == nil {
		return nil, fmt.Errorf("no computed key family")
	}
	device, exists := u.GetComputedKeyFamily().cki.Devices[id]
	if !exists {
		return nil, fmt.Errorf("device %s doesn't exist", id)
	}
	return device, nil
}

func (u *User) DeviceNames() ([]string, error) {
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		return nil, fmt.Errorf("no computed key family")
	}
	if ckf.cki == nil {
		return nil, fmt.Errorf("no computed key infos")
	}

	var names []string
	for _, device := range ckf.cki.Devices {
		if device.Description == nil {
			continue
		}
		names = append(names, *device.Description)
	}
	return names, nil
}

// Returns whether or not the current install has an active device
// sibkey.
func (u *User) HasDeviceInCurrentInstall(did keybase1.DeviceID) bool {
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		return false
	}

	_, err := ckf.GetSibkeyForDevice(did)
	if err != nil {
		return false
	}
	return true
}

func (u *User) HasCurrentDeviceInCurrentInstall() bool {
	did := u.G().Env.GetDeviceIDForUsername(u.GetNormalizedName())
	if did.IsNil() {
		return false
	}
	return u.HasDeviceInCurrentInstall(did)
}

func (u *User) SigningKeyPub() (GenericKey, error) {
	// Get our key that we're going to sign with.
	arg := SecretKeyArg{
		Me:      u,
		KeyType: DeviceSigningKeyType,
	}
	key := u.G().ActiveDevice.SigningKeyForUID(u.GetUID())
	if key != nil {
		return key, nil
	}

	lockedKey, err := u.G().Keyrings.GetSecretKeyLocked(NewMetaContextTODO(u.G()), arg)
	if err != nil {
		return nil, err
	}
	pubKey, err := lockedKey.GetPubKey()
	if err != nil {
		return nil, err
	}
	return pubKey, nil
}

func (u *User) GetSigIDFromSeqno(seqno keybase1.Seqno) keybase1.SigID {
	if u.sigChain() == nil {
		return ""
	}
	link := u.sigChain().GetLinkFromSeqno(seqno)
	if link == nil {
		return ""
	}
	return link.GetSigID()
}

func (u *User) IsSigIDActive(sigID keybase1.SigID) (bool, error) {
	if u.sigChain() == nil {
		return false, fmt.Errorf("User's sig chain is nil.")
	}

	link := u.sigChain().GetLinkFromSigID(sigID)
	if link == nil {
		return false, fmt.Errorf("Signature with ID '%s' does not exist.", sigID)
	}
	if link.revoked {
		return false, fmt.Errorf("Signature ID '%s' is already revoked.", sigID)
	}
	return true, nil
}

func (u *User) SigIDSearch(query string) (keybase1.SigID, error) {
	if u.sigChain() == nil {
		return "", fmt.Errorf("User's sig chain is nil.")
	}

	link := u.sigChain().GetLinkFromSigIDQuery(query)
	if link == nil {
		return "", fmt.Errorf("Signature matching query %q does not exist.", query)
	}
	if link.revoked {
		return "", fmt.Errorf("Signature ID '%s' is already revoked.", link.GetSigID())
	}
	return link.GetSigID(), nil
}

func (u *User) LinkFromSigID(sigID keybase1.SigID) *ChainLink {
	return u.sigChain().GetLinkFromSigID(sigID)
}

func (u *User) SigChainDump(w io.Writer) {
	u.sigChain().Dump(w)
}

func (u *User) IsCachedIdentifyFresh(upk *keybase1.UserPlusKeys) bool {
	idv, _ := u.GetIDVersion()
	if upk.Uvv.Id == 0 || idv != upk.Uvv.Id {
		return false
	}
	shv := u.GetSigHintsVersion()
	if upk.Uvv.SigHints == 0 || shv != upk.Uvv.SigHints {
		return false
	}
	scv := u.GetSigChainLastKnownSeqno()
	if upk.Uvv.SigChain == 0 || int64(scv) != upk.Uvv.SigChain {
		return false
	}
	return true
}

// PartialCopy copies some fields of the User object, but not all.
// For instance, it doesn't copy the SigChain or IDTable, and it only
// makes a shallow copy of the ComputedKeyFamily.
func (u User) PartialCopy() *User {
	ret := &User{
		Contextified: NewContextified(u.G()),
		id:           u.id,
		name:         u.name,
		leaf:         u.leaf,
		dirty:        false,
	}
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		ret.ckfShallowCopy = ckf.ShallowCopy()
		ret.keyFamily = ckf.kf
	} else if u.keyFamily != nil {
		ret.keyFamily = u.keyFamily.ShallowCopy()
	}
	return ret
}

func ValidateNormalizedUsername(username string) (NormalizedUsername, error) {
	res := NormalizedUsername(username)
	if len(username) < 2 {
		return res, errors.New("username too short")
	}
	if len(username) > 16 {
		return res, errors.New("username too long")
	}
	// underscores allowed, just not first or doubled
	re := regexp.MustCompile(`^([a-z0-9][a-z0-9_]?)+$`)
	if !re.MatchString(username) {
		return res, errors.New("invalid username")
	}
	return res, nil
}

type UserForSignatures struct {
	uid         keybase1.UID
	name        NormalizedUsername
	eldestKID   keybase1.KID
	eldestSeqno keybase1.Seqno
	latestPUK   *keybase1.PerUserKey
}

func (u UserForSignatures) GetUID() keybase1.UID                  { return u.uid }
func (u UserForSignatures) GetName() string                       { return u.name.String() }
func (u UserForSignatures) GetEldestKID() keybase1.KID            { return u.eldestKID }
func (u UserForSignatures) GetNormalizedName() NormalizedUsername { return u.name }
func (u UserForSignatures) ToUserVersion() keybase1.UserVersion {
	return keybase1.UserVersion{Uid: u.uid, EldestSeqno: u.eldestSeqno}
}
func (u UserForSignatures) GetLatestPerUserKey() *keybase1.PerUserKey { return u.latestPUK }

func (u *User) ToUserForSignatures() (ret UserForSignatures) {
	if u == nil {
		return ret
	}
	ret.uid = u.GetUID()
	ret.name = u.GetNormalizedName()
	ret.eldestKID = u.GetEldestKID()
	ret.eldestSeqno = u.GetCurrentEldestSeqno()
	ret.latestPUK = u.GetComputedKeyFamily().GetLatestPerUserKey()
	return ret
}

var _ UserBasic = UserForSignatures{}
