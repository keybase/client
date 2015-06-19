package libkb

import (
	"fmt"
	"io"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type User struct {
	// Raw JSON element read from the server or our local DB.
	basics     *jsonw.Wrapper
	publicKeys *jsonw.Wrapper
	sigs       *jsonw.Wrapper
	pictures   *jsonw.Wrapper

	// Processed fields
	id          keybase1.UID
	name        string
	sigChainMem *SigChain
	idTable     *IdentityTable
	sigHints    *SigHints
	Image       *keybase1.Image

	leaf MerkleUserLeaf

	// Loaded from publicKeys
	keyFamily *KeyFamily

	// Computed as a result of sigchain traversal
	cki *ComputedKeyInfos

	dirty bool
	Contextified
}

func NewUserThin(name string, uid keybase1.UID) *User {
	return &User{name: name, id: uid}
}

func NewUser(o *jsonw.Wrapper) (*User, error) {
	uid, err := GetUID(o.AtKey("id"))
	if err != nil {
		return nil, fmt.Errorf("user object lacks an ID: %s", err)
	}
	name, err := o.AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil, fmt.Errorf("user object for %s lacks a name", uid)
	}

	var imagePtr *keybase1.Image
	pictureBlob := o.AtKey("pictures").AtKey("primary")
	if !pictureBlob.IsNil() && pictureBlob.Error() == nil {
		var image keybase1.Image
		err = pictureBlob.UnmarshalAgain(&image)
		if err == nil {
			imagePtr = &image
		}
	}

	kf, err := ParseKeyFamily(o.AtKey("public_keys"))
	if err != nil {
		return nil, err
	}

	return &User{
		basics:     o.AtKey("basics"),
		publicKeys: o.AtKey("public_keys"),
		sigs:       o.AtKey("sigs"),
		pictures:   o.AtKey("pictures"),
		keyFamily:  kf,
		id:         uid,
		name:       name,
		dirty:      false,
		Image:      imagePtr,
	}, nil
}

func NewUserFromServer(o *jsonw.Wrapper) (*User, error) {
	u, e := NewUser(o)
	if e == nil {
		u.dirty = true
	}
	return u, e
}

func NewUserFromLocalStorage(o *jsonw.Wrapper) (*User, error) {
	u, err := NewUser(o)
	return u, err
}

func (u *User) GetName() string      { return u.name }
func (u *User) GetUID() keybase1.UID { return u.id }

func (u *User) GetIDVersion() (int64, error) {
	return u.basics.AtKey("id_version").GetInt64()
}

func (u *User) GetSeqno() Seqno {
	var ret int64 = -1
	var err error
	u.sigs.AtKey("last").AtKey("seqno").GetInt64Void(&ret, &err)
	return Seqno(ret)
}

func (u *User) GetKeyFamily() *KeyFamily {
	return u.keyFamily
}

func (u *User) GetComputedKeyFamily() (ret *ComputedKeyFamily) {
	if u.sigChain() != nil && u.keyFamily != nil {
		cki := u.sigChain().GetComputedKeyInfos()
		if cki == nil {
			return nil
		}
		ret = &ComputedKeyFamily{cki: cki, kf: u.keyFamily, Contextified: u.Contextified}
	}
	return
}

// GetActivePgpKeys looks into the user's ComputedKeyFamily and
// returns only the active PGP keys.  If you want only sibkeys, then
// specify sibkey=true.
func (u *User) GetActivePgpKeys(sibkey bool) (ret []*PgpKeyBundle) {
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		ret = ckf.GetActivePgpKeys(sibkey)
	}
	return
}

// FilterActivePgpKeys returns the active pgp keys that match
// query.
func (u *User) FilterActivePgpKeys(sibkey bool, query string) []*PgpKeyBundle {
	keys := u.GetActivePgpKeys(sibkey)
	var res []*PgpKeyBundle
	for _, k := range keys {
		if KeyMatchesQuery(k, query, false) {
			res = append(res, k)
		}
	}
	return res
}

// GetActivePgpFingerprints looks into the user's ComputedKeyFamily and
// returns only the fingerprint of the active PGP keys.
// If you want only sibkeys, then // specify sibkey=true.
func (u *User) GetActivePgpFingerprints(sibkey bool) (ret []PgpFingerprint) {
	for _, pgp := range u.GetActivePgpKeys(sibkey) {
		ret = append(ret, pgp.GetFingerprint())
	}
	return
}

func (u *User) GetActivePgpFOKIDs(sibkey bool) (ret []FOKID) {
	for _, pgp := range u.GetActivePgpKeys(sibkey) {
		ret = append(ret, GenericKeyToFOKID(pgp))
	}
	return
}

func (u *User) GetDeviceSubkey() (subkey GenericKey, err error) {
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		err = KeyFamilyError{"no key family available"}
		return
	}
	did := u.G().Env.GetDeviceID()
	if did == nil {
		err = NotProvisionedError{}
		return
	}
	return ckf.GetEncryptionSubkeyForDevice(*did)
}

func (u *User) GetServerSeqno() (i int, err error) {
	i = -1

	G.Log.Debug("+ Get server seqno for user: %s", u.name)
	res, err := G.API.Get(APIArg{
		Endpoint:    "user/lookup",
		NeedSession: false,
		Args: HTTPArgs{
			"username": S{u.name},
			"fields":   S{"sigs"},
		},
	})
	if err != nil {
		return
	}
	i, err = res.Body.AtKey("them").AtKey("sigs").AtKey("last").AtKey("seqno").GetInt()
	if err != nil {
		return
	}
	G.Log.Debug("- Server seqno: %s -> %d", u.name, i)
	return i, err
}

func (u *User) CheckBasicsFreshness(server int64) (current bool, err error) {
	var stored int64
	if stored, err = u.GetIDVersion(); err == nil {
		current = (stored >= server)
		if current {
			G.Log.Debug("| Local basics version is up-to-date @ version %d", stored)
		} else {
			G.Log.Debug("| Local basics version is out-of-date: %d < %d", stored, server)
		}
	}
	return
}

func (u *User) StoreSigChain() error {
	var err error
	if u.sigChain() != nil {
		err = u.sigChain().Store()
	}
	return err
}

func (u *User) LoadSigChains(allKeys bool, f *MerkleUserLeaf, self bool) (err error) {
	sc := u.sigChain()
	u.sigChainMem, err = LoadSigChain(u, allKeys, f, PublicChain, sc, self, u.G())

	// Eventually load the others, but for now, this one is good enough
	return err
}

func (u *User) Store() error {

	G.Log.Debug("+ Store user %s", u.name)

	// These might be dirty, in which case we can write it back
	// to local storage. Note, this can be dirty even if the user is clean.
	if err := u.sigHints.Store(); err != nil {
		return err
	}

	if !u.dirty {
		G.Log.Debug("- Store for %s skipped; user wasn't dirty", u.name)
		return nil
	}

	if err := u.StoreSigChain(); err != nil {
		return err
	}

	if err := u.StoreTopLevel(); err != nil {
		return err
	}

	u.dirty = false
	G.Log.Debug("- Store user %s -> OK", u.name)

	return nil
}

func (u *User) StoreTopLevel() error {
	G.Log.Debug("+ StoreTopLevel")

	jw := jsonw.NewDictionary()
	jw.SetKey("id", UIDWrapper(u.id))
	jw.SetKey("basics", u.basics)
	jw.SetKey("public_keys", u.publicKeys)
	jw.SetKey("sigs", u.sigs)
	jw.SetKey("pictures", u.pictures)

	err := G.LocalDb.Put(
		DbKeyUID(DBUser, u.id),
		[]DbKey{{Typ: DBLookupUsername, Key: u.name}},
		jw,
	)
	G.Log.Debug("- StoreTopLevel -> %s", ErrToOk(err))
	return err
}

func (u *User) SyncedSecretKey(lctx LoginContext) (ret *SKB, err error) {
	if lctx != nil {
		return u.GetSyncedSecretKeyLogin(lctx)
	}
	return u.GetSyncedSecretKey()
}

func (u *User) GetSyncedSecretKeyLogin(lctx LoginContext) (ret *SKB, err error) {
	G.Log.Debug("+ User.GetSyncedSecretKeyLogin()")
	defer func() {
		G.Log.Debug("- User.GetSyncedSecretKeyLogin() -> %s", ErrToOk(err))
	}()

	if err = lctx.RunSecretSyncer(u.id); err != nil {
		return
	}
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		G.Log.Debug("| short-circuit; no Computed key family")
		return
	}

	return lctx.SecretSyncer().FindActiveKey(ckf)
}

func (u *User) GetSyncedSecretKey() (ret *SKB, err error) {
	G.Log.Debug("+ User.GetSyncedSecretKey()")
	defer func() {
		G.Log.Debug("- User.GetSyncedSecretKey() -> %s", ErrToOk(err))
	}()

	if err = u.SyncSecrets(); err != nil {
		return
	}

	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		G.Log.Debug("| short-circuit; no Computed key family")
		return
	}

	aerr := G.LoginState().SecretSyncer(func(s *SecretSyncer) {
		ret, err = s.FindActiveKey(ckf)
	}, "User - FindActiveKey")
	if aerr != nil {
		return nil, aerr
	}

	return
}

func (u *User) SyncSecrets() error {
	return G.LoginState().RunSecretSyncer(u.id)
}

func (u *User) GetEldestFOKID() (ret *FOKID) {
	if u.leaf.eldest == nil {
		return nil
	}
	var fp *PgpFingerprint
	if fingerprint, ok := u.keyFamily.kid2pgp[u.leaf.eldest.ToMapKey()]; ok {
		fp = &fingerprint
	}
	return &FOKID{Kid: *u.leaf.eldest, Fp: fp}
}

func (u *User) IDTable() *IdentityTable {
	return u.idTable
}

func (u *User) sigChain() *SigChain {
	return u.sigChainMem
}

func (u *User) MakeIDTable() error {
	fokid := u.GetEldestFOKID()
	if fokid == nil {
		return NoKeyError{"Expected a key but didn't find one"}
	}
	idt, err := NewIdentityTable(*fokid, u.sigChain(), u.sigHints)
	if err != nil {
		return err
	}
	u.idTable = idt
	return nil
}

func (u *User) VerifySelfSig() error {

	G.Log.Debug("+ VerifySelfSig for user %s", u.name)

	if u.IDTable().VerifySelfSig(u.name, u.id) {
		G.Log.Debug("- VerifySelfSig via SigChain")
		return nil
	}

	if u.VerifySelfSigByKey() {
		G.Log.Debug("- VerifySelfSig via Key")
		return nil
	}

	G.Log.Debug("- VerifySelfSig failed")
	return fmt.Errorf("Failed to find a self-signature for %s", u.name)
}

func (u *User) VerifySelfSigByKey() (ret bool) {
	name := u.GetName()
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		ret = ckf.FindKeybaseName(name)
	}
	return
}

func (u *User) HasActiveKey() bool {
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		return ckf.HasActiveKey()
	}
	return false
}

func (u *User) Equal(other *User) bool {
	return u.id == other.id
}

func (u *User) GetTrackingStatementFor(s string, i keybase1.UID) (*TrackChainLink, error) {
	G.Log.Debug("+ GetTrackingStatement for %s", i)
	defer G.Log.Debug("- GetTrackingStatement for %s", i)

	remote, e1 := u.GetRemoteTrackingStatementFor(s, i)
	local, e2 := GetLocalTrack(u.id, i)

	G.Log.Debug("| Load remote -> %v", (remote != nil))
	G.Log.Debug("| Load local -> %v", (local != nil))

	if e1 != nil && e2 != nil {
		return nil, e1
	}

	if local == nil && remote == nil {
		return nil, nil
	}

	if local == nil && remote != nil {
		return remote, nil
	}

	if remote == nil && local != nil {
		return local, nil
	}

	if remote.GetCTime().After(local.GetCTime()) {
		return remote, nil
	}

	return local, nil
}

func (u *User) GetRemoteTrackingStatementFor(s string, i keybase1.UID) (*TrackChainLink, error) {
	if u.IDTable() == nil {
		return nil, nil
	}

	return u.IDTable().GetTrackingStatementFor(s, i)
}

// BaseProofSet creates a basic proof set for a user with their
// keybase and uid proofs and any pgp fingerpring proofs.
func (u *User) BaseProofSet() *ProofSet {
	proofs := []Proof{
		{Key: "keybase", Value: u.name},
		{Key: "uid", Value: u.id.String()},
	}
	for _, fp := range u.GetActivePgpFingerprints(true) {
		proofs = append(proofs, Proof{Key: "fingerprint", Value: fp.String()})
	}

	return NewProofSet(proofs)
}

// localDelegateKey takes the given GenericKey and provisions it locally so that
// we can use the key without needing a refresh from the server.  The eventual
// refresh we do get from the server will clobber our work here.
func (u *User) localDelegateKey(key GenericKey, sigID keybase1.SigID, kid KID, isSibkey bool, isEldest bool) (err error) {
	if err = u.keyFamily.LocalDelegate(key); err != nil {
		return
	}
	if u.sigChain() == nil {
		err = NoSigChainError{}
		return
	}
	err = u.sigChain().LocalDelegate(u.keyFamily, key, sigID, kid, isSibkey)
	if isEldest {
		eldestKID := key.GetKid()
		u.leaf.eldest = &eldestKID
	}
	return
}

func (u *User) SigChainBump(linkID LinkID, sigID keybase1.SigID) {
	u.SigChainBumpMT(MerkleTriple{LinkID: linkID, SigID: sigID})
}

func (u *User) SigChainBumpMT(mt MerkleTriple) {
	u.sigChain().Bump(mt)
}

func (u *User) GetDevice(id string) (*Device, error) {
	if u.GetComputedKeyFamily() == nil {
		return nil, fmt.Errorf("no computed key family")
	}
	device, exists := u.GetComputedKeyFamily().cki.Devices[id]
	if !exists {
		return nil, fmt.Errorf("device %s doesn't exist", id)
	}
	return device, nil
}

// Returns whether or not the current install has an active device
// sibkey.
func (u *User) HasDeviceInCurrentInstall() bool {
	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		return false
	}
	did := u.G().Env.GetDeviceID()
	if did == nil {
		return false
	}
	_, err := ckf.GetSibkeyForDevice(*did)
	if err != nil {
		return false
	}
	return true
}

func (u *User) SigningKeyPub() (GenericKey, error) {
	// Get our key that we're going to sign with.
	arg := SecretKeyArg{
		Me:      u,
		KeyType: DeviceSigningKeyType,
	}
	lockedKey, _, err := G.Keyrings.GetSecretKeyLocked(nil, arg)
	if err != nil {
		return nil, err
	}
	pubKey, err := lockedKey.GetPubKey()
	if err != nil {
		return nil, err
	}
	return pubKey, nil
}

func (u *User) TrackStatementJSON(them *User, outcome *IdentifyOutcome) (string, error) {
	key, err := u.SigningKeyPub()
	if err != nil {
		return "", err
	}

	stmt, err := u.TrackingProofFor(key, them, outcome)
	if err != nil {
		return "", err
	}
	json, err := stmt.Marshal()
	if err != nil {
		return "", err
	}
	return string(json), nil
}

func (u *User) GetSigIDFromSeqno(seqno int) keybase1.SigID {
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

func (u *User) LinkFromSigID(sigID keybase1.SigID) *ChainLink {
	return u.sigChain().GetLinkFromSigID(sigID)
}

func (u *User) SigChainDump(w io.Writer) {
	u.sigChain().Dump(w)
}
