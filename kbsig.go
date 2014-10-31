//
// Code used in populating JSON objects to generating Keybase-style
// signatures.
//
package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
)

func ClientId() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("version", jsonw.NewString(CLIENT_VERSION))
	ret.SetKey("name", jsonw.NewString(GO_CLIENT_ID))
	return ret
}

func (u *User) ToTrackingStatementKey(errp *error) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	if key, err := u.GetActiveKey(); err != nil {
		*errp = fmt.Errorf("User %s doesn't have an active key: %s",
			u.name, err.Error())
	} else if fp, err := u.GetActivePgpFingerprint(); err != nil {
		*errp = fmt.Errorf("User %s doesn't have an active fingerprint: %s",
			u.name, err.Error())
	} else {
		ret.SetKey("kid", jsonw.NewString(key.GetKid().ToString()))
		ret.SetKey("key_fingerprint", jsonw.NewString(fp.ToString()))
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

func (u *User) ToTrackingStatement() (*jsonw.Wrapper, error) {
	var err error
	ret := jsonw.NewDictionary()
	ret.SetKey("key", u.ToTrackingStatementKey(&err))
	ret.SetKey("seq_tail", u.ToTrackingStatementSeqTail())
	ret.SetKey("basics", u.ToTrackingStatementBasics(&err))
	ret.SetKey("id", jsonw.NewString(string(u.id)))
	ret.SetKey("remote_key_proofs", u.IdTable.ToTrackingStatement())
	if err != nil {
		ret = nil
	}
	return ret, err
}

func (u *User) ToKeyStanza() (*jsonw.Wrapper, error) {
	ret := jsonw.NewDictionary()
	ret.SetKey("uid", jsonw.NewString(string(u.id)))
	ret.SetKey("username", jsonw.NewString(u.name))
	ret.SetKey("host", jsonw.NewString(CANONICAL_HOST))
	if fp, err := u.GetActivePgpFingerprint(); err != nil {
		return nil, err
	} else {
		ret.SetKey("fingerprint", jsonw.NewString(fp.ToString()))
		ret.SetKey("key_id", jsonw.NewString(fp.ToKeyId()))
	}
	return ret, nil
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
	ret.SetKey("curr", jsonw.NewString(g.id.ToString()))
	ret.SetKey("sig_id", jsonw.NewString(g.GetSigId().ToString(true)))

	rkp := jsonw.NewDictionary()
	ret.SetKey("remote_key_proof", rkp)
	rkp.SetKey("state", jsonw.NewInt(g.GetProofState()))

	prev := g.GetPrev()
	var prev_val *jsonw.Wrapper
	if prev == nil {
		prev_val = jsonw.NewNil()
	} else {
		prev_val = jsonw.NewString(prev.ToString())
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
