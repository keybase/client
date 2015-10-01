package libkb

import (
	"encoding/hex"
	"fmt"
	"runtime/debug"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

type PostProofRes struct {
	Text     string
	ID       string
	Metadata *jsonw.Wrapper
}

type PostProofArg struct {
	Sig            string
	ID             keybase1.SigID
	RemoteUsername string
	ProofType      string
	Supersede      bool
	RemoteKey      string
	SigningKey     GenericKey
}

func PostProof(arg PostProofArg) (*PostProofRes, error) {
	hargs := HTTPArgs{
		"sig_id_base":     S{arg.ID.ToString(false)},
		"sig_id_short":    S{arg.ID.ToShortID()},
		"sig":             S{arg.Sig},
		"is_remote_proof": B{true},
		"supersede":       B{arg.Supersede},
		"signing_kid":     S{arg.SigningKey.GetKID().String()},
		"type":            S{arg.ProofType},
	}
	hargs.Add(arg.RemoteKey, S{arg.RemoteUsername})

	res, err := G.API.Post(APIArg{
		Endpoint:    "sig/post",
		NeedSession: true,
		Args:        hargs,
	})

	if err != nil {
		return nil, err
	}
	var tmp PostProofRes
	res.Body.AtKey("proof_text").GetStringVoid(&tmp.Text, &err)
	res.Body.AtKey("proof_id").GetStringVoid(&tmp.ID, &err)
	tmp.Metadata = res.Body.AtKey("proof_metadata")

	var ret *PostProofRes
	if err == nil {
		ret = &tmp
	}
	return ret, err
}

type PostAuthProofArg struct {
	uid keybase1.UID
	sig string
	key GenericKey
}

type PostAuthProofRes struct {
	SessionID string `json:"session"`
	AuthID    string `json:"auth_id"`
	CSRFToken string `json:"csrf_token"`
	UIDHex    string `json:"uid"`
	Username  string `json:"username"`
	PPGen     int    `json:"passphrase_generation"`
}

func PostAuthProof(arg PostAuthProofArg) (*PostAuthProofRes, error) {
	hargs := HTTPArgs{
		"uid":         UIDArg(arg.uid),
		"sig":         S{arg.sig},
		"signing_kid": S{arg.key.GetKID().String()},
	}
	res, err := G.API.Post(APIArg{
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
	_, err = G.API.Post(APIArg{
		Endpoint: "invitation_request",
		Args: HTTPArgs{
			"email":     S{arg.Email},
			"full_name": S{arg.Fullname},
			"notes":     S{arg.Notes},
		},
	})
	return err
}

func DeletePrimary() (err error) {
	_, err = G.API.Post(APIArg{
		Endpoint:    "key/revoke",
		NeedSession: true,
		Args: HTTPArgs{
			"revoke_primary":  I{1},
			"revocation_type": I{RevSimpleDelete},
		},
	})
	return
}

func CheckPosted(proofID string) (found bool, status keybase1.ProofStatus, err error) {
	res, e2 := G.API.Post(APIArg{
		Endpoint:    "sig/posted",
		NeedSession: true,
		Args: HTTPArgs{
			"proof_id": S{proofID},
		},
	})
	if e2 != nil {
		err = e2
		return
	}
	var (
		rfound  bool
		rstatus int
		rerr    error
	)
	res.Body.AtKey("proof_ok").GetBoolVoid(&rfound, &rerr)
	res.Body.AtPath("proof_res.status").GetIntVoid(&rstatus, &rerr)
	return rfound, keybase1.ProofStatus(rstatus), rerr
}

func CheckPostedViaSigID(sigID keybase1.SigID) (found bool, status keybase1.ProofStatus, err error) {
	res, e2 := G.API.Post(APIArg{
		Endpoint:    "sig/posted",
		NeedSession: true,
		Args: HTTPArgs{
			"sig_id": S{sigID.ToString(true)},
		},
	})
	if e2 != nil {
		err = e2
		return
	}

	var (
		rfound  bool
		rstatus int
		rerr    error
	)
	res.Body.AtKey("proof_ok").GetBoolVoid(&rfound, &rerr)
	res.Body.AtPath("proof_res.status").GetIntVoid(&rstatus, &rerr)
	return rfound, keybase1.ProofStatus(rstatus), rerr
}

func PostDeviceLKS(lctx LoginContext, deviceID keybase1.DeviceID, deviceType string, serverHalf []byte,
	ppGen PassphraseGeneration,
	clientHalfRecovery string, clientHalfRecoveryKID keybase1.KID) error {
	if len(serverHalf) == 0 {
		return fmt.Errorf("PostDeviceLKS: called with empty serverHalf")
	}
	if ppGen < 1 {
		G.Log.Warning("PostDeviceLKS: ppGen < 1 (%d)", ppGen)
		debug.PrintStack()
	}
	arg := APIArg{
		Endpoint:    "device/update",
		NeedSession: true,
		Args: HTTPArgs{
			"device_id":       S{Val: deviceID.String()},
			"type":            S{Val: deviceType},
			"lks_server_half": S{Val: hex.EncodeToString(serverHalf)},
			"ppgen":           I{Val: int(ppGen)},
			"lks_client_half": S{Val: clientHalfRecovery},
			"kid":             S{Val: clientHalfRecoveryKID.String()},
		},
	}
	if lctx != nil {
		arg.SessionR = lctx.LocalSession()
	}
	_, err := G.API.Post(arg)
	return err
}
