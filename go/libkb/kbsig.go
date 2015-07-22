//
// Code used in populating JSON objects to generating Keybase-style
// signatures.
//
package libkb

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	triplesec "github.com/keybase/go-triplesec"
)

func clientInfo() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("version", jsonw.NewString(Version))
	ret.SetKey("name", jsonw.NewString(GoClientID))
	return ret
}

func merkleRootInfo() (ret *jsonw.Wrapper) {
	if mc := G.MerkleClient; mc != nil {
		ret, _ = mc.LastRootToSigJSON()
	}
	return ret
}

func (u *User) ToTrackingStatementKey(errp *error) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()

	if !u.HasActiveKey() {
		*errp = fmt.Errorf("User %s doesn't have an active key", u.GetName())
	} else {
		kid := u.GetEldestKID()
		ret.SetKey("kid", jsonw.NewString(kid.String()))
		ckf := u.GetComputedKeyFamily()
		if fingerprint, exists := ckf.kf.kid2pgp[kid]; exists {
			ret.SetKey("key_fingerprint", jsonw.NewString(fingerprint.String()))
		}
	}
	return ret
}

func (u *User) ToTrackingStatementPGPKeys(errp *error) *jsonw.Wrapper {
	keys := u.GetActivePGPKeys(true)
	if len(keys) == 0 {
		return nil
	}

	ret := jsonw.NewArray(len(keys))
	for i, k := range keys {
		kd := jsonw.NewDictionary()
		kid := k.GetKID()
		fp := k.GetFingerprintP()
		kd.SetKey("kid", jsonw.NewString(kid.String()))
		if fp != nil {
			kd.SetKey("key_fingerprint", jsonw.NewString(fp.String()))
		}
		ret.SetIndex(i, kd)
	}
	return ret
}

func (u *User) ToTrackingStatementBasics(errp *error) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("username", jsonw.NewString(u.name))
	if lastIDChange, err := u.basics.AtKey("last_id_change").GetInt(); err == nil {
		ret.SetKey("last_id_change", jsonw.NewInt(lastIDChange))
	}
	if idVersion, err := u.basics.AtKey("id_version").GetInt(); err == nil {
		ret.SetKey("id_version", jsonw.NewInt(idVersion))
	}
	return ret
}

func (u *User) ToTrackingStatementSeqTail() *jsonw.Wrapper {
	return u.sigs.AtKey("last")
}

func (u *User) ToTrackingStatement(w *jsonw.Wrapper, outcome *IdentifyOutcome) (err error) {

	track := jsonw.NewDictionary()
	track.SetKey("key", u.ToTrackingStatementKey(&err))
	if pgpkeys := u.ToTrackingStatementPGPKeys(&err); pgpkeys != nil {
		track.SetKey("pgp_keys", pgpkeys)
	}
	track.SetKey("seq_tail", u.ToTrackingStatementSeqTail())
	track.SetKey("basics", u.ToTrackingStatementBasics(&err))
	track.SetKey("id", UIDWrapper(u.id))
	track.SetKey("remote_proofs", outcome.TrackingStatement())

	if err != nil {
		return
	}

	w.SetKey("type", jsonw.NewString("track"))
	w.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	w.SetKey("track", track)
	return
}

func (u *User) ToUntrackingStatementBasics() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("username", jsonw.NewString(u.name))
	return ret
}

func (u *User) ToUntrackingStatement(w *jsonw.Wrapper) (err error) {
	untrack := jsonw.NewDictionary()
	untrack.SetKey("basics", u.ToUntrackingStatementBasics())
	untrack.SetKey("id", UIDWrapper(u.GetUID()))
	w.SetKey("type", jsonw.NewString("untrack"))
	w.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	w.SetKey("untrack", untrack)
	return
}

func (u *User) ToKeyStanza(signingKid keybase1.KID, signingFingerprint *PGPFingerprint, eldest keybase1.KID) (ret *jsonw.Wrapper, err error) {
	ret = jsonw.NewDictionary()
	ret.SetKey("uid", UIDWrapper(u.id))
	ret.SetKey("username", jsonw.NewString(u.name))
	ret.SetKey("host", jsonw.NewString(CanonicalHost))

	if eldest.IsNil() {
		eldest = u.GetEldestKID()
	}

	if signingFingerprint != nil {
		ret.SetKey("fingerprint", jsonw.NewString(signingFingerprint.String()))
		ret.SetKey("key_id", jsonw.NewString(signingFingerprint.ToKeyID()))
	}

	ret.SetKey("kid", jsonw.NewString(signingKid.String()))
	if eldest.Exists() {
		ret.SetKey("eldest_kid", jsonw.NewString(eldest.String()))
	}

	return
}

func (s *SocialProofChainLink) ToTrackingStatement(state keybase1.ProofState) (*jsonw.Wrapper, error) {
	ret := s.BaseToTrackingStatement(state)
	err := remoteProofToTrackingStatement(s, ret)
	if err != nil {
		ret = nil
	}

	return ret, err
}

func (g *GenericChainLink) BaseToTrackingStatement(state keybase1.ProofState) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("curr", jsonw.NewString(g.id.String()))
	ret.SetKey("sig_id", jsonw.NewString(g.GetSigID().ToString(true)))

	rkp := jsonw.NewDictionary()
	ret.SetKey("remote_key_proof", rkp)
	rkp.SetKey("state", jsonw.NewInt(int(state)))

	prev := g.GetPrev()
	var prevVal *jsonw.Wrapper
	if prev == nil {
		prevVal = jsonw.NewNil()
	} else {
		prevVal = jsonw.NewString(prev.String())
	}

	ret.SetKey("prev", prevVal)
	ret.SetKey("ctime", jsonw.NewInt64(g.unpacked.ctime))
	ret.SetKey("etime", jsonw.NewInt64(g.unpacked.etime))
	return ret
}

func remoteProofToTrackingStatement(s RemoteProofChainLink, base *jsonw.Wrapper) error {
	typS := s.TableKey()
	i, found := RemoteServiceTypes[typS]
	if !found {
		return fmt.Errorf("No service type found for %q in proof %d", typS, s.GetSeqno())
	}

	base.AtKey("remote_key_proof").SetKey("proof_type", jsonw.NewInt(int(i)))
	base.AtKey("remote_key_proof").SetKey("check_data_json", s.CheckDataJSON())
	base.SetKey("sig_type", jsonw.NewInt(SigTypeRemoteProof))
	return nil
}

func (u *User) ProofMetadata(ei int, signingKey GenericKey, eldest keybase1.KID, ctime int64) (ret *jsonw.Wrapper, err error) {
	return u.ProofMetadataWithoutKey(ei, signingKey.GetKID(), signingKey.GetFingerprintP(), eldest, ctime)
}

func (u *User) ProofMetadataWithoutKey(ei int, signingKID keybase1.KID, signingFingerprint *PGPFingerprint, eldest keybase1.KID, ctime int64) (ret *jsonw.Wrapper, err error) {

	var seqno int
	var prevS string
	var key, prev *jsonw.Wrapper

	lastSeqno := u.sigChain().GetLastKnownSeqno()
	lastLink := u.sigChain().GetLastKnownID()
	if lastLink == nil {
		seqno = 1
		prev = jsonw.NewNil()
	} else {
		seqno = int(lastSeqno) + 1
		prevS = lastLink.String()
		prev = jsonw.NewString(prevS)
	}

	if ctime == 0 {
		ctime = time.Now().Unix()
	}

	if ei == 0 {
		ei = SigExpireIn
	}

	ret = jsonw.NewDictionary()
	ret.SetKey("tag", jsonw.NewString("signature"))
	ret.SetKey("ctime", jsonw.NewInt64(ctime))
	ret.SetKey("expire_in", jsonw.NewInt(ei))
	ret.SetKey("seqno", jsonw.NewInt(seqno))
	ret.SetKey("prev", prev)

	body := jsonw.NewDictionary()
	key, err = u.ToKeyStanza(signingKID, signingFingerprint, eldest)
	if err != nil {
		ret = nil
		return
	}
	body.SetKey("key", key)
	ret.SetKey("body", body)

	// Capture the most recent Merkle Root and also what kind of client
	// we're running.
	ret.SetKey("client", clientInfo())
	ret.SetKey("merkle_root", merkleRootInfo())

	return
}

func (u *User) TrackingProofFor(signingKey GenericKey, u2 *User, outcome *IdentifyOutcome) (ret *jsonw.Wrapper, err error) {
	ret, err = u.ProofMetadata(0, signingKey, "", 0)
	if err == nil {
		err = u2.ToTrackingStatement(ret.AtKey("body"), outcome)
	}
	return
}

func (u *User) UntrackingProofFor(signingKey GenericKey, u2 *User) (ret *jsonw.Wrapper, err error) {
	ret, err = u.ProofMetadata(0, signingKey, "", 0)
	if err == nil {
		err = u2.ToUntrackingStatement(ret.AtKey("body"))
	}
	return
}

func setDeviceOnBody(body *jsonw.Wrapper, key GenericKey, device Device) {
	device.Kid = key.GetKID()
	body.SetKey("device", device.Export())
}

func (u *User) KeyProof(arg Delegator) (ret *jsonw.Wrapper, pushType string, err error) {
	ekkid := arg.GetExistingKeyKID()
	if ekkid.IsNil() {
		newKID := arg.NewKey.GetKID()
		ret, err = u.eldestKeyProof(arg.NewKey, newKID, arg.Device)
		pushType = EldestType
	} else {
		if arg.Sibkey {
			pushType = SibkeyType
		} else {
			pushType = SubkeyType
		}
		ret, err = u.delegateKeyProof(arg, ekkid, pushType)
	}
	return
}

func (u *User) eldestKeyProof(signingKey GenericKey, eldest keybase1.KID, device *Device) (ret *jsonw.Wrapper, err error) {
	return u.selfProof(signingKey, eldest, device, EldestType)
}

func (u *User) selfProof(signingKey GenericKey, eldest keybase1.KID, device *Device, typ string) (ret *jsonw.Wrapper, err error) {
	ret, err = u.ProofMetadata(0, signingKey, eldest, 0)
	if err != nil {
		return
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	body.SetKey("type", jsonw.NewString(typ))

	if device != nil {
		setDeviceOnBody(body, signingKey, *device)
	}

	return
}

func (u *User) ServiceProof(signingKey GenericKey, typ ServiceType, remotename string) (ret *jsonw.Wrapper, err error) {
	ret, err = u.selfProof(signingKey, "", nil, "web_service_binding")
	if err != nil {
		return
	}
	ret.AtKey("body").SetKey("service", typ.ToServiceJSON(remotename))
	return
}

// SimpleSignJson marshals the given Json structure and then signs it.
func SignJSON(jw *jsonw.Wrapper, key GenericKey) (out string, id keybase1.SigID, lid LinkID, err error) {
	var tmp []byte
	if tmp, err = jw.Marshal(); err != nil {
		return
	}
	out, id, err = key.SignToString(tmp)
	lid = ComputeLinkID(tmp)
	return
}

// revSig is optional.  Added for kex scenario.
func keyToProofJSON(newkey GenericKey, typ string, signingKey keybase1.KID, revSig string, u *User) (ret *jsonw.Wrapper, err error) {
	ret = jsonw.NewDictionary()

	if typ == SibkeyType {
		val := jsonw.NewNil()
		if len(revSig) > 0 {
			val = jsonw.NewString(revSig)
		}
		ret.SetKey("reverse_sig", val)
	}

	// For subkeys let's say who our parent is.  In this case it's the signing key,
	// though that can change in the future.
	if typ == SubkeyType {
		ret.SetKey("parent_kid", signingKey.ToJsonw())
	}

	ret.SetKey("kid", jsonw.NewString(newkey.GetKID().String()))
	return
}

func (u *User) delegateKeyProof(arg Delegator, signingkey keybase1.KID, pushType string) (ret *jsonw.Wrapper, err error) {
	ret, err = u.ProofMetadataWithoutKey(arg.Expire, signingkey, nil, "", arg.Ctime)
	if err != nil {
		return
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	body.SetKey("type", jsonw.NewString(pushType))

	if arg.Device != nil {
		setDeviceOnBody(body, arg.NewKey, *arg.Device)
	}

	var kp *jsonw.Wrapper
	if kp, err = keyToProofJSON(arg.NewKey, pushType, signingkey, arg.RevSig, u); err != nil {
		return
	}

	// pushType can be 'subkey' or 'sibkey'
	body.SetKey(pushType, kp)
	return
}

// AuthenticationProof makes a JSON proof statement for the user that he can sign
// to prove a log-in to the system.  If successful, the server will return with
// a session token.
func (u *User) AuthenticationProof(key GenericKey, session string, ei int) (ret *jsonw.Wrapper, err error) {
	if ret, err = u.ProofMetadata(ei, key, "", 0); err != nil {
		return
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(1))
	body.SetKey("type", jsonw.NewString("auth"))
	var nonce [16]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		return
	}
	body.SetKey("nonce", jsonw.NewString(hex.EncodeToString(nonce[:])))
	body.SetKey("session", jsonw.NewString(session))
	return
}

func (u *User) RevokeKeysProof(key GenericKey, kidsToRevoke []keybase1.KID, deviceToDisable keybase1.DeviceID) (*jsonw.Wrapper, error) {
	ret, err := u.ProofMetadata(0 /* ei */, key, "", 0)
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	body.SetKey("type", jsonw.NewString("revoke"))
	revokeSection := jsonw.NewDictionary()
	revokeSection.SetKey("kids", jsonw.NewWrapper(kidsToRevoke))
	body.SetKey("revoke", revokeSection)
	if deviceToDisable.Exists() {
		device, err := u.GetDevice(deviceToDisable)
		if err != nil {
			return nil, err
		}
		deviceSection := jsonw.NewDictionary()
		deviceSection.SetKey("id", jsonw.NewString(deviceToDisable.String()))
		deviceSection.SetKey("type", jsonw.NewString(device.Type))
		deviceSection.SetKey("status", jsonw.NewInt(DeviceStatusDefunct))
		body.SetKey("device", deviceSection)
	}
	return ret, nil
}

func (u *User) RevokeSigsProof(key GenericKey, sigIDsToRevoke []keybase1.SigID) (*jsonw.Wrapper, error) {
	ret, err := u.ProofMetadata(0 /* ei */, key, "", 0)
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	body.SetKey("type", jsonw.NewString("revoke"))
	revokeSection := jsonw.NewDictionary()
	idsArray := jsonw.NewArray(len(sigIDsToRevoke))
	for i, id := range sigIDsToRevoke {
		idsArray.SetIndex(i, jsonw.NewString(id.ToString(true)))
	}
	revokeSection.SetKey("sig_ids", idsArray)
	body.SetKey("revoke", revokeSection)
	return ret, nil
}

func (u *User) CryptocurrencySig(key GenericKey, address string, sigToRevoke keybase1.SigID) (*jsonw.Wrapper, error) {
	ret, err := u.ProofMetadata(0 /* ei */, key, "", 0)
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	body.SetKey("type", jsonw.NewString("cryptocurrency"))
	currencySection := jsonw.NewDictionary()
	currencySection.SetKey("address", jsonw.NewString(address))
	currencySection.SetKey("type", jsonw.NewString("bitcoin"))
	body.SetKey("cryptocurrency", currencySection)
	if len(sigToRevoke) > 0 {
		revokeSection := jsonw.NewDictionary()
		revokeSection.SetKey("sig_id", jsonw.NewString(sigToRevoke.ToString(true /* suffix */)))
		body.SetKey("revoke", revokeSection)
	}
	return ret, nil
}

func (u *User) UpdatePassphraseProof(key GenericKey, pwh string, ppGen int) (*jsonw.Wrapper, error) {
	ret, err := u.ProofMetadata(0, key, "", 0)
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	body.SetKey("type", jsonw.NewString("update_passphrase_hash"))
	pp := jsonw.NewDictionary()
	pp.SetKey("hash", jsonw.NewString(pwh))
	pp.SetKey("version", jsonw.NewInt(int(triplesec.Version)))
	pp.SetKey("passphrase_generation", jsonw.NewInt(int(ppGen)))
	body.SetKey("update_passphrase_hash", pp)
	return ret, nil
}
