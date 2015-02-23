package main

import (
	"github.com/keybase/go/engine"
	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteBaseIdentifyUI struct {
	sessionId int
	username  string
	uicli     keybase_1.IdentifyUiClient
	logUI     libkb.LogUI
}

type RemoteSelfIdentifyUI struct {
	RemoteBaseIdentifyUI
}

type IdentifyHandler struct {
	BaseHandler
}

func NewIdentifyHandler(xp *rpc2.Transport) *IdentifyHandler {
	return &IdentifyHandler{BaseHandler{xp: xp}}
}

func (h *IdentifyHandler) Identify(arg keybase_1.IdentifyArg) (keybase_1.IdentifyRes, error) {
	iarg := engine.ImportIdentifyArg(arg)
	res, err := h.identify(iarg, true)
	if err != nil {
		return keybase_1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) IdentifyDefault(username string) (keybase_1.IdentifyRes, error) {
	arg := engine.IdentifyArg{User: username}
	res, err := h.identify(arg, true)
	if err != nil {
		return keybase_1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) identify(iarg engine.IdentifyArg, doInteractive bool) (*engine.IdentifyRes, error) {
	sessionId := nextSessionId()
	iarg.LogUI = h.getLogUI(sessionId)

	eng := engine.NewIdentifyEng(&iarg, h.NewRemoteIdentifyUI(sessionId, iarg.User))
	return eng.Run()
}

var (
	__sessionId = 0
)

func nextSessionId() int {
	ret := __sessionId
	__sessionId++
	return ret
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

func (u *RemoteBaseIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity) {
	u.uicli.LaunchNetworkChecks(keybase_1.LaunchNetworkChecksArg{
		SessionID: u.sessionId,
		Id:        *id,
	})
	return
}

type RemoteIdentifyUI struct {
	RemoteBaseIdentifyUI
}

func (u *RemoteBaseIdentifyUI) Start() {
	u.logUI.Info("Identifying " + u.username)
	return
}

func (u *RemoteBaseIdentifyUI) SetUsername(username string) {
	u.username = username
}
