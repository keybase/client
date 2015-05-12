package libkb

import (
	"encoding/hex"
	"fmt"

	jsonw "github.com/keybase/go-jsonw"
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
	SigningKey     GenericKey
}

func PostProof(arg PostProofArg) (*PostProofRes, error) {
	hargs := HttpArgs{
		"sig_id_base":     S{arg.Id.ToString(false)},
		"sig_id_short":    S{arg.Id.ToShortId()},
		"sig":             S{arg.Sig},
		"is_remote_proof": B{true},
		"supersede":       B{arg.Supersede},
		"signing_kid":     S{arg.SigningKey.GetKid().String()},
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

type PostAuthProofArg struct {
	uid UID
	sig string
	key GenericKey
}

type PostAuthProofRes struct {
	SessionId string `json:"session"`
	AuthId    string `json:"auth_id"`
	CsrfToken string `json:"csrf_token"`
	UidHex    string `json:"uid"`
	Username  string `json:"username"`
}

func PostAuthProof(arg PostAuthProofArg) (*PostAuthProofRes, error) {
	hargs := HttpArgs{
		"uid":         S{arg.uid.String()},
		"sig":         S{arg.sig},
		"signing_kid": S{arg.key.GetKid().String()},
	}
	res, err := G.API.Post(ApiArg{
		Endpoint:    "sig/post_auth",
		NeedSession: false,
		Args:        hargs,
	})
	if err != nil {
		return nil, err
	}
	var ret *PostAuthProofRes
	var tmp PostAuthProofRes
	if err = res.Body.UnmarshalAgain(&tmp); err == nil {
		ret = &tmp
	}
	return ret, err
}

type InviteRequestArg struct {
	Email    string
	Fullname string
	Notes    string
}

func PostInviteRequest(arg InviteRequestArg) (err error) {
	_, err = G.API.Post(ApiArg{
		Endpoint: "invitation_request",
		Args: HttpArgs{
			"email":     S{arg.Email},
			"full_name": S{arg.Fullname},
			"notes":     S{arg.Notes},
		},
	})
	return err
}

func DeletePrimary() (err error) {
	_, err = G.API.Post(ApiArg{
		Endpoint:    "key/revoke",
		NeedSession: true,
		Args: HttpArgs{
			"revoke_primary":  I{1},
			"revocation_type": I{REV_SIMPLE_DELETE},
		},
	})
	return
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

func PostDeviceLKS(lctx LoginContext, deviceID, deviceType string, serverHalf []byte) error {
	if len(serverHalf) == 0 {
		return fmt.Errorf("PostDeviceLKS: called with empty serverHalf")
	}
	arg := ApiArg{
		Endpoint:    "device/update",
		NeedSession: true,
		Args: HttpArgs{
			"device_id":       S{Val: deviceID},
			"type":            S{Val: deviceType},
			"lks_server_half": S{Val: hex.EncodeToString(serverHalf)},
		},
	}
	if lctx != nil {
		arg.SessionR = lctx.LocalSession()
	}
	_, err := G.API.Post(arg)
	return err
}
