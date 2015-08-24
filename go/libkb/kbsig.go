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

type KeySection struct {
	Me             *User
	Key            GenericKey
	EldestKID      keybase1.KID
	ParentKID      keybase1.KID
	HasRevSig      bool
	RevSig         string
	SigningUser    *User
	IncludePGPHash bool
}

func (arg KeySection) ToJSON() (*jsonw.Wrapper, error) {
	ret := jsonw.NewDictionary()

	ret.SetKey("kid", jsonw.NewString(arg.Key.GetKID().String()))

	if arg.EldestKID != "" {
		ret.SetKey("eldest_kid", jsonw.NewString(arg.EldestKID.String()))
	}

	if arg.ParentKID != "" {
		ret.SetKey("parent_kid", jsonw.NewString(arg.ParentKID.String()))
	}

	if arg.HasRevSig {
		var revSig *jsonw.Wrapper
		if arg.RevSig != "" {
			revSig = jsonw.NewString(arg.RevSig)
		} else {
			revSig = jsonw.NewNil()
		}
		ret.SetKey("reverse_sig", revSig)
	}

	if arg.SigningUser != nil {
		ret.SetKey("host", jsonw.NewString(CanonicalHost))
		ret.SetKey("uid", UIDWrapper(arg.SigningUser.id))
		ret.SetKey("username", jsonw.NewString(arg.SigningUser.name))
	}

	if pgp, ok := arg.Key.(*PGPKeyBundle); ok {
		fingerprint := pgp.GetFingerprint()
		ret.SetKey("fingerprint", jsonw.NewString(fingerprint.String()))
		ret.SetKey("key_id", jsonw.NewString(fingerprint.ToKeyID()))
		if arg.IncludePGPHash {
			hash, err := pgp.FullHash()
			if err != nil {
				return nil, err
			}

			ret.SetKey("full_hash", jsonw.NewString(hash))
		}
	}

	return ret, nil
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
	w.SetKey("untrack", untrack)
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

type ProofMetadata struct {
	Me             *User
	LinkType       LinkType
	SigningKey     GenericKey
	Eldest         keybase1.KID
	CreationTime   int64
	ExpireIn       int
	IncludePGPHash bool
}

func (arg ProofMetadata) ToJSON() (ret *jsonw.Wrapper, err error) {

	var seqno int
	var prevS string
	var key, prev *jsonw.Wrapper

	lastSeqno := arg.Me.sigChain().GetLastKnownSeqno()
	lastLink := arg.Me.sigChain().GetLastKnownID()
	if lastLink == nil {
		seqno = 1
		prev = jsonw.NewNil()
	} else {
		seqno = int(lastSeqno) + 1
		prevS = lastLink.String()
		prev = jsonw.NewString(prevS)
	}

	ctime := arg.CreationTime
	if ctime == 0 {
		ctime = time.Now().Unix()
	}

	ei := arg.ExpireIn
	if ei == 0 {
		ei = SigExpireIn
	}

	ret = jsonw.NewDictionary()
	ret.SetKey("tag", jsonw.NewString("signature"))
	ret.SetKey("ctime", jsonw.NewInt64(ctime))
	ret.SetKey("expire_in", jsonw.NewInt(ei))
	ret.SetKey("seqno", jsonw.NewInt(seqno))
	ret.SetKey("prev", prev)

	eldest := arg.Eldest
	if eldest == "" {
		eldest = arg.Me.GetEldestKID()
	}

	body := jsonw.NewDictionary()

	body.SetKey("version", jsonw.NewInt(KeybaseSignatureV1))
	body.SetKey("type", jsonw.NewString(string(arg.LinkType)))

	key, err = KeySection{
		Me:             arg.Me,
		Key:            arg.SigningKey,
		EldestKID:      eldest,
		SigningUser:    arg.Me,
		IncludePGPHash: arg.IncludePGPHash,
	}.ToJSON()
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
	ret, err = ProofMetadata{
		Me:         u,
		LinkType:   TrackType,
		SigningKey: signingKey,
	}.ToJSON()
	if err == nil {
		err = u2.ToTrackingStatement(ret.AtKey("body"), outcome)
	}
	return
}

func (u *User) UntrackingProofFor(signingKey GenericKey, u2 *User) (ret *jsonw.Wrapper, err error) {
	ret, err = ProofMetadata{
		Me:         u,
		LinkType:   UntrackType,
		SigningKey: signingKey,
	}.ToJSON()
	if err == nil {
		err = u2.ToUntrackingStatement(ret.AtKey("body"))
	}
	return
}

func (u *User) KeyProof(arg Delegator) (ret *jsonw.Wrapper, linkType LinkType, err error) {
	var kp *jsonw.Wrapper
	existingKey := arg.ExistingKey
	includePGPHash := false

	if existingKey == nil {
		linkType = EldestType
		existingKey = arg.NewKey
		includePGPHash = true
	} else {
		keySection := KeySection{
			Key: arg.NewKey,
		}
		if arg.Sibkey {
			linkType = SibkeyType
			keySection.HasRevSig = true
			keySection.RevSig = arg.RevSig
			keySection.IncludePGPHash = true
		} else {
			linkType = SubkeyType
			keySection.ParentKID = existingKey.GetKID()
		}

		if kp, err = keySection.ToJSON(); err != nil {
			return
		}
	}

	ret, err = ProofMetadata{
		Me:             u,
		LinkType:       linkType,
		ExpireIn:       arg.Expire,
		SigningKey:     existingKey,
		Eldest:         arg.EldestKID,
		CreationTime:   arg.Ctime,
		IncludePGPHash: includePGPHash,
	}.ToJSON()
	if err != nil {
		return
	}

	body := ret.AtKey("body")

	if arg.Device != nil {
		device := *arg.Device
		device.Kid = arg.NewKey.GetKID()
		body.SetKey("device", device.Export())
	}

	if kp != nil {
		body.SetKey(string(linkType), kp)
	}

	return
}

func (u *User) ServiceProof(signingKey GenericKey, typ ServiceType, remotename string) (ret *jsonw.Wrapper, err error) {
	ret, err = ProofMetadata{
		Me:         u,
		LinkType:   WebServiceBindingType,
		SigningKey: signingKey,
	}.ToJSON()
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

// AuthenticationProof makes a JSON proof statement for the user that he can sign
// to prove a log-in to the system.  If successful, the server will return with
// a session token.
func (u *User) AuthenticationProof(key GenericKey, session string, ei int) (ret *jsonw.Wrapper, err error) {
	if ret, err = (ProofMetadata{
		Me:         u,
		LinkType:   AuthenticationType,
		ExpireIn:   ei,
		SigningKey: key,
	}.ToJSON()); err != nil {
		return
	}
	body := ret.AtKey("body")
	var nonce [16]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		return
	}
	auth := jsonw.NewDictionary()
	auth.SetKey("nonce", jsonw.NewString(hex.EncodeToString(nonce[:])))
	auth.SetKey("session", jsonw.NewString(session))

	body.SetKey("auth", auth)
	return
}

func (u *User) RevokeKeysProof(key GenericKey, kidsToRevoke []keybase1.KID, deviceToDisable keybase1.DeviceID) (*jsonw.Wrapper, error) {
	ret, err := ProofMetadata{
		Me:         u,
		LinkType:   RevokeType,
		SigningKey: key,
	}.ToJSON()
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
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
	ret, err := ProofMetadata{
		Me:         u,
		LinkType:   RevokeType,
		SigningKey: key,
	}.ToJSON()
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
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
	ret, err := ProofMetadata{
		Me:         u,
		LinkType:   CryptocurrencyType,
		SigningKey: key,
	}.ToJSON()
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
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
	ret, err := ProofMetadata{
		Me:         u,
		LinkType:   UpdatePassphraseType,
		SigningKey: key,
	}.ToJSON()
	if err != nil {
		return nil, err
	}
	body := ret.AtKey("body")
	pp := jsonw.NewDictionary()
	pp.SetKey("hash", jsonw.NewString(pwh))
	pp.SetKey("version", jsonw.NewInt(int(triplesec.Version)))
	pp.SetKey("passphrase_generation", jsonw.NewInt(int(ppGen)))
	body.SetKey("update_passphrase_hash", pp)
	return ret, nil
}
