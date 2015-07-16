package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteBaseIdentifyUI struct {
	sessionID  int
	uicli      keybase1.IdentifyUiClient
	logUI      libkb.LogUI
	strict     bool
	skipPrompt bool
}

type RemoteSelfIdentifyUI struct {
	RemoteBaseIdentifyUI
}

type IdentifyHandler struct {
	*BaseHandler
}

func NewIdentifyHandler(xp *rpc2.Transport) *IdentifyHandler {
	return &IdentifyHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *IdentifyHandler) Identify(arg keybase1.IdentifyArg) (keybase1.IdentifyRes, error) {
	iarg := engine.ImportIDEngineArg(arg)
	res, err := h.identify(arg.SessionID, iarg, true)
	if err != nil {
		return keybase1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) IdentifyDefault(arg keybase1.IdentifyDefaultArg) (keybase1.IdentifyRes, error) {
	iarg := engine.IDEngineArg{UserAssertion: arg.UserAssertion, ForceRemoteCheck: arg.ForceRemoteCheck}
	res, err := h.identify(arg.SessionID, iarg, true)
	if err != nil {
		return keybase1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) identify(sessionID int, iarg engine.IDEngineArg, doInteractive bool) (res *engine.IDRes, err error) {
	logui := h.getLogUI(sessionID)
	if iarg.TrackStatement {
		logui = logger.NewNull()
	}
	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: h.NewRemoteIdentifyUI(sessionID),
	}
	eng := engine.NewIDEngine(&iarg, G)
	err = engine.RunEngine(eng, &ctx)
	res = eng.Result()
	return
}

func (u *RemoteBaseIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) {
	u.uicli.FinishWebProofCheck(keybase1.FinishWebProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) {
	u.uicli.FinishSocialProofCheck(keybase1.FinishSocialProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishAndPrompt(io *keybase1.IdentifyOutcome) (keybase1.FinishAndPromptRes, error) {
	if u.skipPrompt {
		G.Log.Debug("skipping FinishAndPrompt for %q", io.Username)
		return keybase1.FinishAndPromptRes{}, nil
	}
	return u.uicli.FinishAndPrompt(keybase1.FinishAndPromptArg{SessionID: u.sessionID, Outcome: *io})
}

func (u *RemoteBaseIdentifyUI) DisplayCryptocurrency(c keybase1.Cryptocurrency) {
	u.uicli.DisplayCryptocurrency(keybase1.DisplayCryptocurrencyArg{SessionID: u.sessionID, C: c})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayKey(key keybase1.IdentifyKey) {
	u.uicli.DisplayKey(keybase1.DisplayKeyArg{SessionID: u.sessionID, Key: key})
	return
}

func (u *RemoteBaseIdentifyUI) ReportLastTrack(t *keybase1.TrackSummary) {
	u.uicli.ReportLastTrack(keybase1.ReportLastTrackArg{SessionID: u.sessionID, Track: t})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayTrackStatement(s string) error {
	return u.uicli.DisplayTrackStatement(keybase1.DisplayTrackStatementArg{Stmt: s, SessionID: u.sessionID})
	// return
}

func (u *RemoteBaseIdentifyUI) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) {
	u.uicli.LaunchNetworkChecks(keybase1.LaunchNetworkChecksArg{
		SessionID: u.sessionID,
		Identity:  *id,
		User:      *user,
	})
	return
}

func (u *RemoteBaseIdentifyUI) Start(username string) {
	u.uicli.Start(keybase1.StartArg{SessionID: u.sessionID, Username: username})
}

func (u *RemoteBaseIdentifyUI) Finish() {
	u.uicli.Finish(u.sessionID)
}

func (u *RemoteBaseIdentifyUI) SetStrict(b bool) {
	u.strict = b
}

type RemoteIdentifyUI struct {
	RemoteBaseIdentifyUI
}
