package libkb

import (
	"github.com/keybase/go-jsonw"
)

type PostProofRes struct {
	Text     string
	Id       string
	Metadata *jsonw.Wrapper
}

type PostProofArg struct {
	Sig            string
	Id             SigId
	RemoteUsername string
	ProofType      string
	Supersede      bool
	RemoteKey      string
}

type PostNewKeyArg struct {
	Sig  string
	Id   SigId
	Type string
}

func PostNewKey(arg PostNewKeyArg) error {
	hargs := HttpArgs{
		"sig_id_base":     S{arg.Id.ToString(false)},
		"sig_id_short":    S{arg.Id.ToShortId()},
		"sig":             S{arg.Sig},
		"is_remote_proof": B{false},
		"type":            S{arg.Type},
	}
	G.Log.Debug("Post NewKey: %v", hargs)
	_, err := G.API.Post(ApiArg{
		Endpoint:    "sig/post",
		NeedSession: true,
		Args:        hargs,
	})
	return err
}

func PostProof(arg PostProofArg) (*PostProofRes, error) {
	hargs := HttpArgs{
		"sig_id_base":     S{arg.Id.ToString(false)},
		"sig_id_short":    S{arg.Id.ToShortId()},
		"sig":             S{arg.Sig},
		"is_remote_proof": B{true},
		"supersede":       B{arg.Supersede},
		"type":            S{arg.ProofType},
	}
	hargs.Add(arg.RemoteKey, S{arg.RemoteUsername})

	res, err := G.API.Post(ApiArg{
		Endpoint:    "sig/post",
		NeedSession: true,
		Args:        hargs,
	})

	if err != nil {
		return nil, err
	}
	var tmp PostProofRes
	res.Body.AtKey("proof_text").GetStringVoid(&tmp.Text, &err)
	res.Body.AtKey("proof_id").GetStringVoid(&tmp.Id, &err)
	tmp.Metadata = res.Body.AtKey("proof_metadata")

	var ret *PostProofRes
	if err == nil {
		ret = &tmp
	}
	return ret, err
}

func CheckPosted(proofId string) (found bool, status int, err error) {
	res, e2 := G.API.Post(ApiArg{
		Endpoint:    "sig/posted",
		NeedSession: true,
		Args: HttpArgs{
			"proof_id": S{proofId},
		},
	})
	if e2 != nil {
		err = e2
		return
	}
	res.Body.AtKey("proof_ok").GetBoolVoid(&found, &err)
	res.Body.AtPath("proof_res.status").GetIntVoid(&status, &err)
	return
}
