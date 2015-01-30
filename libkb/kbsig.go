//
// Code used in populating JSON objects to generating Keybase-style
// signatures.
//
package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
	"time"
)

func ClientId() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("version", jsonw.NewString(CLIENT_VERSION))
	ret.SetKey("name", jsonw.NewString(GO_CLIENT_ID))
	return ret
}

func (u *User) ToTrackingStatementKey(errp *error) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()

	if !u.HasActiveKey() {
		*errp = fmt.Errorf("User %s doesn't have an active key")
	} else {
		fokid := u.GetEldestFOKID()
		ret.SetKey("kid", jsonw.NewString(fokid.Kid.String()))
		if fokid.Fp != nil {
			ret.SetKey("key_fingerprint", jsonw.NewString(fokid.Fp.String()))
		}
	}
	return ret
}

func (u *User) ToTrackingStatementBasics(errp *error) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("username", jsonw.NewString(u.name))
	if last_id_change, err := u.basics.AtKey("last_id_change").GetInt(); err == nil {
		ret.SetKey("last_id_change", jsonw.NewInt(last_id_change))
	}
	if id_version, err := u.basics.AtKey("id_version").GetInt(); err == nil {
		ret.SetKey("id_version", jsonw.NewInt(id_version))
	}
	return ret
}

func (u *User) ToTrackingStatementSeqTail() *jsonw.Wrapper {
	return u.sigs.AtKey("last")
}

func (u *User) ToTrackingStatement(w *jsonw.Wrapper) (err error) {

	track := jsonw.NewDictionary()
	track.SetKey("key", u.ToTrackingStatementKey(&err))
	track.SetKey("seq_tail", u.ToTrackingStatementSeqTail())
	track.SetKey("basics", u.ToTrackingStatementBasics(&err))
	track.SetKey("id", jsonw.NewString(u.id.String()))
	track.SetKey("remote_proofs", u.IdTable.ToTrackingStatement())

	if err != nil {
		return
	}

	w.SetKey("type", jsonw.NewString("track"))
	w.SetKey("version", jsonw.NewInt(KEYBASE_SIGNATURE_V1))
	w.SetKey("track", track)
	return
}

func (u *User) ToKeyStanza(sk GenericKey, eldest *FOKID) (ret *jsonw.Wrapper, err error) {
	ret = jsonw.NewDictionary()
	ret.SetKey("uid", jsonw.NewString(u.id.String()))
	ret.SetKey("username", jsonw.NewString(u.name))
	ret.SetKey("host", jsonw.NewString(CANONICAL_HOST))

	if eldest == nil {
		eldest = u.GetEldestFOKID()
	}

	var signingKid KID
	if sk != nil {
		signingKid = sk.GetKid()
	} else if signingKid = G.Env.GetPerDeviceKID(); signingKid == nil {
		err = NoSecretKeyError{}
		return
	}

	if sk != nil {
		if fp := sk.GetFingerprintP(); fp != nil {
			ret.SetKey("fingerprint", jsonw.NewString(fp.String()))
			ret.SetKey("key_id", jsonw.NewString(fp.ToKeyId()))
		}
	}

	ret.SetKey("kid", jsonw.NewString(signingKid.String()))
	if eldest != nil {
		ret.SetKey("eldest_kid", jsonw.NewString(eldest.Kid.String()))
	}

	return
}

func (s *SocialProofChainLink) ToTrackingStatement() (*jsonw.Wrapper, error) {
	ret := s.BaseToTrackingStatement()
	err := remoteProofToTrackingStatement(s, ret)
	if err != nil {
		ret = nil
	}
	return ret, err
}

func (idt *IdentityTable) ToTrackingStatement() *jsonw.Wrapper {
	v := idt.activeProofs
	tmp := make([]*jsonw.Wrapper, 0, len(v))
	for _, proof := range v {
		if d, err := proof.ToTrackingStatement(); err != nil {
			G.Log.Warning("Problem with a proof: %s", err.Error())
		} else if d != nil {
			tmp = append(tmp, d)
		}
	}
	ret := jsonw.NewArray(len(tmp))
	for i, d := range tmp {
		ret.SetIndex(i, d)
	}
	return ret
}

func (g *GenericChainLink) BaseToTrackingStatement() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("curr", jsonw.NewString(g.id.String()))
	ret.SetKey("sig_id", jsonw.NewString(g.GetSigId().ToString(true)))

	rkp := jsonw.NewDictionary()
	ret.SetKey("remote_key_proof", rkp)
	rkp.SetKey("state", jsonw.NewInt(g.GetProofState()))

	prev := g.GetPrev()
	var prev_val *jsonw.Wrapper
	if prev == nil {
		prev_val = jsonw.NewNil()
	} else {
		prev_val = jsonw.NewString(prev.String())
	}

	ret.SetKey("prev", prev_val)
	ret.SetKey("ctime", jsonw.NewInt64(g.unpacked.ctime))
	ret.SetKey("etime", jsonw.NewInt64(g.unpacked.etime))
	return ret
}

func remoteProofToTrackingStatement(s RemoteProofChainLink, base *jsonw.Wrapper) error {
	typ_s := s.TableKey()
	if i, found := REMOTE_SERVICE_TYPES[typ_s]; !found {
		return fmt.Errorf("No service type found for '%s' in proof %d",
			typ_s, s.GetSeqno())
	} else {
		base.AtKey("remote_key_proof").SetKey("proof_type", jsonw.NewInt(i))
	}
	base.AtKey("remote_key_proof").SetKey("check_data_json", s.CheckDataJson())
	base.SetKey("sig_type", jsonw.NewInt(SIG_TYPE_REMOTE_PROOF))
	return nil
}

func (u *User) ProofMetadata(ei int, signingKey GenericKey, eldest *FOKID) (ret *jsonw.Wrapper, err error) {

	var seqno int
	var prev_s string
	var key, prev *jsonw.Wrapper

	last_seqno := u.sigChain.GetLastKnownSeqno()
	last_link := u.sigChain.GetLastKnownId()
	if last_link == nil {
		seqno = 1
		prev = jsonw.NewNil()
	} else {
		seqno = int(last_seqno) + 1
		prev_s = last_link.String()
		prev = jsonw.NewString(prev_s)
	}

	if ei == 0 {
		ei = SIG_EXPIRE_IN
	}

	ret = jsonw.NewDictionary()
	ret.SetKey("tag", jsonw.NewString("signature"))
	ret.SetKey("ctime", jsonw.NewInt64(time.Now().Unix()))
	ret.SetKey("expire_in", jsonw.NewInt(ei))
	ret.SetKey("seqno", jsonw.NewInt(seqno))
	ret.SetKey("prev", prev)

	body := jsonw.NewDictionary()
	key, err = u.ToKeyStanza(signingKey, eldest)
	if err != nil {
		ret = nil
		return
	}
	body.SetKey("key", key)
	ret.SetKey("body", body)

	return
}

func (u1 *User) TrackingProofFor(signingKey GenericKey, u2 *User) (ret *jsonw.Wrapper, err error) {
	ret, err = u1.ProofMetadata(0, signingKey, nil)
	if err == nil {
		err = u2.ToTrackingStatement(ret.AtKey("body"))
	}
	return
}

func (u *User) SelfProof(signingKey GenericKey, eldest *FOKID) (ret *jsonw.Wrapper, err error) {
	ret, err = u.ProofMetadata(0, signingKey, eldest)
	if err == nil {
		body := ret.AtKey("body")
		body.SetKey("version", jsonw.NewInt(KEYBASE_SIGNATURE_V1))
		body.SetKey("type", jsonw.NewString("web_service_binding"))
	}
	return
}

func (u *User) ServiceProof(signingKey GenericKey, typ ServiceType, remotename string) (ret *jsonw.Wrapper, err error) {
	ret, err = u.SelfProof(signingKey, nil)
	if err != nil {
		return
	}
	ret.AtKey("body").SetKey("service", typ.ToServiceJson(remotename))
	return
}

// SimpleSignJson marshals the given Json structure and then signs it.
func SignJson(jw *jsonw.Wrapper, key GenericKey) (out string, id *SigId, lid LinkId, err error) {
	var tmp []byte
	if tmp, err = jw.Marshal(); err != nil {
		return
	}
	out, id, err = key.SignToString(tmp)
	lid = ComputeLinkId(tmp)
	return
}

func KeyToProofJson(key GenericKey) *jsonw.Wrapper {
	d := jsonw.NewDictionary()
	d.SetKey("kid", jsonw.NewString(key.GetKid().String()))
	return d
}

func (u *User) KeyProof(newkey GenericKey, signingkey GenericKey, typ string, ei int, device *Device) (ret *jsonw.Wrapper, err error) {
	ret, err = u.ProofMetadata(ei, signingkey, nil)
	if err != nil {
		return
	}
	body := ret.AtKey("body")
	body.SetKey("version", jsonw.NewInt(KEYBASE_SIGNATURE_V1))
	body.SetKey("type", jsonw.NewString(typ))

	if device != nil {
		kid := newkey.GetKid().String()
		device.Kid = &kid
		body.SetKey("device", device.Export())
	}

	kp := KeyToProofJson(newkey)
	if typ == "sibkey" && newkey.CanSign() {
		rsig_json := jsonw.NewDictionary()
		rsig_json.SetKey("reverse_key_sig", jsonw.NewString(signingkey.GetKid().String()))
		var rsig string
		if rsig, _, _, err = SignJson(rsig_json, newkey); err != nil {
			return
		}
		rsig_dict := jsonw.NewDictionary()
		rsig_dict.SetKey("sig", jsonw.NewString(rsig))
		rsig_dict.SetKey("type", jsonw.NewString("kb"))
		kp.SetKey("reverse_sig", rsig_dict)
	}
	// 'typ' can be 'subkey' or 'sibkey'
	body.SetKey(typ, kp)
	return
}
