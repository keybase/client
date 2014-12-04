package libkb

import (
	"github.com/keybase/go-jsonw"
)

type PostProofRes struct {
	Text     string
	Id       string
	Metadata *jsonw.Wrapper
}

func PostProof(sig string, id SigId, supersede bool) (*PostProofRes, error) {
	res, err := G.API.Post(ApiArg{
		Endpoint:    "sig/post",
		NeedSession: true,
		Args: HttpArgs{
			"sig_id_base":     S{id.ToString(false)},
			"sig_id":          S{id.ToShortId()},
			"sig":             S{sig},
			"is_remote_proof": B{true},
			"supersede":       B{supersede},
		},
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
