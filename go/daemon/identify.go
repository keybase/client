package main

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteBaseIdentifyUI struct {
	sessionId int
	uicli     keybase_1.IdentifyUiClient
	logUI     libkb.LogUI
	strict    bool
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

func (h *IdentifyHandler) Identify(arg keybase_1.IdentifyArg) (keybase_1.IdentifyRes, error) {
	iarg := engine.ImportIdEngineArg(arg)
	res, err := h.identify(arg.SessionID, iarg, true)
	if err != nil {
		return keybase_1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) IdentifyDefault(arg keybase_1.IdentifyDefaultArg) (keybase_1.IdentifyRes, error) {
	iarg := engine.IdEngineArg{UserAssertion: arg.UserAssertion}
	res, err := h.identify(arg.SessionID, iarg, true)
	if err != nil {
		return keybase_1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) identify(sessionId int, iarg engine.IdEngineArg, doInteractive bool) (res *engine.IdRes, err error) {
	logui := h.getLogUI(sessionId)
	if iarg.TrackStatement {
		logui = libkb.NewNullLogger()
	}
	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: h.NewRemoteIdentifyUI(sessionId),
	}
	eng := engine.NewIdEngine(&iarg)
	err = engine.RunEngine(eng, &ctx)
	res = eng.Result()
	return
}

func (u *RemoteBaseIdentifyUI) FinishWebProofCheck(p keybase_1.RemoteProof, lcr keybase_1.LinkCheckResult) {
	u.uicli.FinishWebProofCheck(keybase_1.FinishWebProofCheckArg{
		SessionID: u.sessionId,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishSocialProofCheck(p keybase_1.RemoteProof, lcr keybase_1.LinkCheckResult) {
	u.uicli.FinishSocialProofCheck(keybase_1.FinishSocialProofCheckArg{
		SessionID: u.sessionId,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishAndPrompt(io *keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error) {
	return u.uicli.FinishAndPrompt(keybase_1.FinishAndPromptArg{SessionID: u.sessionId, Outcome: *io})
}

func (u *RemoteBaseIdentifyUI) DisplayCryptocurrency(c keybase_1.Cryptocurrency) {
	u.uicli.DisplayCryptocurrency(keybase_1.DisplayCryptocurrencyArg{SessionID: u.sessionId, C: c})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayKey(k keybase_1.FOKID, d *keybase_1.TrackDiff) {
	u.uicli.DisplayKey(keybase_1.DisplayKeyArg{SessionID: u.sessionId, Fokid: k, Diff: d})
	return
}

func (u *RemoteBaseIdentifyUI) ReportLastTrack(t *keybase_1.TrackSummary) {
	u.uicli.ReportLastTrack(keybase_1.ReportLastTrackArg{SessionID: u.sessionId, Track: t})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayTrackStatement(s string) error {
	return u.uicli.DisplayTrackStatement(keybase_1.DisplayTrackStatementArg{Stmt: s, SessionID: u.sessionId})
	// return
}

func (u *RemoteBaseIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity, user *keybase_1.User) {
	u.uicli.LaunchNetworkChecks(keybase_1.LaunchNetworkChecksArg{
		SessionID: u.sessionId,
		Id:        *id,
		User:      *user,
	})
	return
}

func (u *RemoteBaseIdentifyUI) Start(username string) {
	u.uicli.Start(keybase_1.StartArg{SessionID: u.sessionId, Username: username})
	return
}

func (u *RemoteBaseIdentifyUI) SetStrict(b bool) {
	u.strict = b
}

type RemoteIdentifyUI struct {
	RemoteBaseIdentifyUI
}
