// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"runtime/debug"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type PostProofRes struct {
	Text     string
	ID       string
	Metadata *jsonw.Wrapper
}

type PostProofArg struct {
	UID               keybase1.UID
	Seqno             keybase1.Seqno
	Sig               string
	SigInner          []byte
	RemoteServiceType string
	SigID             keybase1.SigID
	LinkID            LinkID
	RemoteUsername    string
	ProofType         string
	Supersede         bool
	RemoteKey         string
	SigningKey        GenericKey
}

func PostProof(m MetaContext, arg PostProofArg) (*PostProofRes, error) {
	hargs := HTTPArgs{
		"sig_id_base":     S{arg.SigID.ToString(false)},
		"sig_id_short":    S{arg.SigID.ToShortID()},
		"sig":             S{arg.Sig},
		"is_remote_proof": B{true},
		"supersede":       B{arg.Supersede},
		"signing_kid":     S{arg.SigningKey.GetKID().String()},
		"type":            S{arg.ProofType},
	}
	if len(arg.SigInner) > 0 {
		hargs["sig_inner"] = S{string(arg.SigInner)}
	}

	if arg.ProofType == GenericSocialWebServiceBinding {
		hargs["remote_service"] = S{arg.RemoteServiceType}
	}

	hargs.Add(arg.RemoteKey, S{arg.RemoteUsername})

	apiRes, err := m.G().API.Post(m, APIArg{
		Endpoint:    "sig/post",
		SessionType: APISessionTypeREQUIRED,
		Args:        hargs,
	})
	if err != nil {
		return nil, err
	}

	err = MerkleCheckPostedUserSig(m, arg.UID, arg.Seqno, arg.LinkID)
	if err != nil {
		return nil, err
	}

	var res PostProofRes
	res.Text, err = apiRes.Body.AtKey("proof_text").GetString()
	if err != nil {
		return nil, err
	}
	res.ID, err = apiRes.Body.AtKey("proof_id").GetString()
	if err != nil {
		return nil, err
	}
	res.Metadata = apiRes.Body.AtKey("proof_metadata")
	return &res, nil
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

func PostAuthProof(m MetaContext, arg PostAuthProofArg) (*PostAuthProofRes, error) {
	hargs := HTTPArgs{
		"uid":         UIDArg(arg.uid),
		"sig":         S{arg.sig},
		"signing_kid": S{arg.key.GetKID().String()},
	}
	res, err := m.G().API.Post(m, APIArg{
		Endpoint:    "sig/post_auth",
		SessionType: APISessionTypeNONE,
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

func PostInviteRequest(m MetaContext, arg InviteRequestArg) (err error) {
	_, err = m.G().API.Post(m, APIArg{
		Endpoint: "invitation_request",
		Args: HTTPArgs{
			"email":     S{arg.Email},
			"full_name": S{arg.Fullname},
			"notes":     S{arg.Notes},
		},
	})
	return err
}

func DeletePrimary(m MetaContext) (err error) {
	_, err = m.G().API.Post(m, APIArg{
		Endpoint:    "key/revoke",
		SessionType: APISessionTypeREQUIRED,
		Args: HTTPArgs{
			"revoke_primary":  I{1},
			"revocation_type": I{RevSimpleDelete},
		},
	})
	return
}

func CheckPosted(mctx MetaContext, sigID keybase1.SigID) (found bool, status keybase1.ProofStatus, state keybase1.ProofState, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("CheckPosted(%v)", sigID), func() error { return err })()
	found, status, state, err = checkPostedAPICall(mctx, sigID)
	if err != nil {
		return found, status, state, err
	}
	// Bust proof cache if it disagrees about success.
	err = checkPostedMaybeBustProofCache(mctx, sigID, found, status, state)
	if err != nil {
		mctx.Debug("| CheckPosted error maybe busting proof cache: %v", err)
	}
	return found, status, state, nil
}

func checkPostedAPICall(mctx MetaContext, sigID keybase1.SigID) (found bool, status keybase1.ProofStatus, state keybase1.ProofState, err error) {
	res, e2 := mctx.G().API.Post(mctx, APIArg{
		Endpoint:    "sig/posted",
		SessionType: APISessionTypeREQUIRED,
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
		rstate  int
		rerr    error
	)
	res.Body.AtKey("proof_ok").GetBoolVoid(&rfound, &rerr)
	res.Body.AtPath("proof_res.status").GetIntVoid(&rstatus, &rerr)
	res.Body.AtPath("proof_res.state").GetIntVoid(&rstate, &rerr)
	return rfound, keybase1.ProofStatus(rstatus), keybase1.ProofState(rstate), rerr
}

func checkPostedMaybeBustProofCache(mctx MetaContext, sigID keybase1.SigID, found bool, status keybase1.ProofStatus, state keybase1.ProofState) error {
	pvlSource := mctx.G().GetPvlSource()
	if pvlSource == nil {
		return fmt.Errorf("no pvl source")
	}
	pvlU, err := pvlSource.GetLatestEntry(mctx)
	if err != nil {
		return fmt.Errorf("error getting pvl: %v", err)
	}
	checkResult := mctx.G().ProofCache.Get(sigID, pvlU.Hash)
	if checkResult == nil {
		return nil
	}
	serverOk := found && state == keybase1.ProofState_OK
	cacheOk := checkResult.Status == nil || checkResult.Status.GetProofStatus() == keybase1.ProofStatus_OK
	if serverOk != cacheOk {
		mctx.Debug("CheckPosted busting %v", sigID)
		return mctx.G().ProofCache.Delete(sigID)
	}
	return nil
}

func PostDeviceLKS(m MetaContext, deviceID keybase1.DeviceID, deviceType string, serverHalf LKSecServerHalf,
	ppGen PassphraseGeneration,
	clientHalfRecovery string, clientHalfRecoveryKID keybase1.KID) error {
	m.Debug("| PostDeviceLKS: %s", deviceID)
	if serverHalf.IsNil() {
		return fmt.Errorf("PostDeviceLKS: called with empty serverHalf")
	}
	if ppGen < 1 {
		m.Warning("PostDeviceLKS: ppGen < 1 (%d)", ppGen)
		debug.PrintStack()
	}
	arg := APIArg{
		Endpoint:    "device/update",
		SessionType: APISessionTypeREQUIRED,
		Args: HTTPArgs{
			"device_id":       S{Val: deviceID.String()},
			"type":            S{Val: deviceType},
			"lks_server_half": S{Val: serverHalf.EncodeToHex()},
			"ppgen":           I{Val: int(ppGen)},
			"lks_client_half": S{Val: clientHalfRecovery},
			"kid":             S{Val: clientHalfRecoveryKID.String()},
			"platform":        S{Val: GetPlatformString()},
		},
		RetryCount: 10,
	}
	_, err := m.G().API.Post(m, arg)
	if err != nil {
		m.Info("device/update(%+v) failed: %s", arg.Args, err)
	}
	return err
}

func CheckInvitationCode(m MetaContext, code string) error {
	arg := APIArg{
		Endpoint:    "invitation/check",
		SessionType: APISessionTypeNONE,
		Args: HTTPArgs{
			"invitation_id": S{Val: code},
		},
	}
	_, err := m.G().API.Get(m, arg)
	return err
}

func GetInvitationCode(m MetaContext) (string, error) {
	arg := APIArg{
		Endpoint:    "invitation_bypass_request",
		SessionType: APISessionTypeNONE,
	}
	res, err := m.G().API.Get(m, arg)
	var invitationID string
	if err == nil {
		invitationID, err = res.Body.AtKey("invitation_id").GetString()
	}
	return invitationID, err
}
