package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteBaseIdentifyUI struct {
	sessionId int
	uicli     keybase1.IdentifyUiClient
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

func (h *IdentifyHandler) Identify(arg keybase1.IdentifyArg) (keybase1.IdentifyRes, error) {
	iarg := engine.ImportIdEngineArg(arg)
	res, err := h.identify(arg.SessionID, iarg, true)
	if err != nil {
		return keybase1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) IdentifyDefault(arg keybase1.IdentifyDefaultArg) (keybase1.IdentifyRes, error) {
	iarg := engine.IdEngineArg{UserAssertion: arg.UserAssertion}
	res, err := h.identify(arg.SessionID, iarg, true)
	if err != nil {
		return keybase1.IdentifyRes{}, err
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

func (u *RemoteBaseIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) {
	u.uicli.FinishWebProofCheck(keybase1.FinishWebProofCheckArg{
		SessionID: u.sessionId,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) {
	u.uicli.FinishSocialProofCheck(keybase1.FinishSocialProofCheckArg{
		SessionID: u.sessionId,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishAndPrompt(io *keybase1.IdentifyOutcome) (keybase1.FinishAndPromptRes, error) {
	return u.uicli.FinishAndPrompt(keybase1.FinishAndPromptArg{SessionID: u.sessionId, Outcome: *io})
}

func (u *RemoteBaseIdentifyUI) DisplayCryptocurrency(c keybase1.Cryptocurrency) {
	u.uicli.DisplayCryptocurrency(keybase1.DisplayCryptocurrencyArg{SessionID: u.sessionId, C: c})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayKey(k keybase1.FOKID, d *keybase1.TrackDiff) {
	u.uicli.DisplayKey(keybase1.DisplayKeyArg{SessionID: u.sessionId, Fokid: k, Diff: d})
	return
}

func (u *RemoteBaseIdentifyUI) ReportLastTrack(t *keybase1.TrackSummary) {
	u.uicli.ReportLastTrack(keybase1.ReportLastTrackArg{SessionID: u.sessionId, Track: t})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayTrackStatement(s string) error {
	return u.uicli.DisplayTrackStatement(keybase1.DisplayTrackStatementArg{Stmt: s, SessionID: u.sessionId})
	// return
}

func (u *RemoteBaseIdentifyUI) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) {
	u.uicli.LaunchNetworkChecks(keybase1.LaunchNetworkChecksArg{
		SessionID: u.sessionId,
		Id:        *id,
		User:      *user,
	})
	return
}

func (u *RemoteBaseIdentifyUI) Start(username string) {
	u.uicli.Start(keybase1.StartArg{SessionID: u.sessionId, Username: username})
}

func (u *RemoteBaseIdentifyUI) Finish() {
	u.uicli.Finish(u.sessionId)
}

func (u *RemoteBaseIdentifyUI) SetStrict(b bool) {
	u.strict = b
}

type RemoteIdentifyUI struct {
	RemoteBaseIdentifyUI
}
