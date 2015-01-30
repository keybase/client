package main

import (
	"fmt"
	"github.com/keybase/go/libkb/engine"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteBaseIdentifyUI struct {
	sessionId int
	username  string
	uicli     keybase_1.IdentifyUiClient
	logcli    keybase_1.LogUiClient
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
	arg := engine.IdentifyArgPrime{User: username}
	res, err := h.identify(arg, true)
	if err != nil {
		return keybase_1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) identify(iarg engine.IdentifyArgPrime, doInteractive bool) (*engine.IdentifyRes, error) {
	sessionId := nextSessionId()
	iarg.LogUI = h.getLogUI(sessionId)

	eng := engine.NewIdentifyEng(&iarg, NewRemoteIdentifyUI(sessionId, iarg.User, h.cli))
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

func NewRemoteSelfIdentifyUI(sessionId int, username string, c *rpc2.Client) *RemoteSelfIdentifyUI {
	fmt.Printf("************** NewRemoteSelfIdentifyUI\n")
	return &RemoteSelfIdentifyUI{RemoteBaseIdentifyUI{
		sessionId: sessionId,
		username:  username,
		uicli:     keybase_1.IdentifyUiClient{c},
	}}
}

func (u *RemoteBaseIdentifyUI) FinishWebProofCheck(p keybase_1.RemoteProof, lcr keybase_1.LinkCheckResult) {
	u.uicli.FinishWebProofCheck(keybase_1.FinishWebProofCheckArg{
		SessionId: u.sessionId,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishSocialProofCheck(p keybase_1.RemoteProof, lcr keybase_1.LinkCheckResult) {
	u.uicli.FinishSocialProofCheck(keybase_1.FinishSocialProofCheckArg{
		SessionId: u.sessionId,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteBaseIdentifyUI) FinishAndPrompt(io *keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error) {
	return u.uicli.FinishAndPrompt(keybase_1.FinishAndPromptArg{SessionId: u.sessionId, Outcome: *io})
}

func (u *RemoteBaseIdentifyUI) DisplayCryptocurrency(c keybase_1.Cryptocurrency) {
	u.uicli.DisplayCryptocurrency(keybase_1.DisplayCryptocurrencyArg{SessionId: u.sessionId, C: c})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayKey(k keybase_1.FOKID, d *keybase_1.TrackDiff) {
	u.uicli.DisplayKey(keybase_1.DisplayKeyArg{SessionId: u.sessionId, Fokid: k, Diff: d})
	return
}

func (u *RemoteBaseIdentifyUI) ReportLastTrack(t *keybase_1.TrackSummary) {
	u.uicli.ReportLastTrack(keybase_1.ReportLastTrackArg{SessionId: u.sessionId, Track: t})
	return
}

func (u *RemoteBaseIdentifyUI) DisplayTrackStatement(s string) error {
	return u.uicli.DisplayTrackStatement(keybase_1.DisplayTrackStatementArg{Stmt: s, SessionId: u.sessionId})
	// return
}

func (u *RemoteBaseIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity) {
	u.uicli.LaunchNetworkChecks(keybase_1.LaunchNetworkChecksArg{
		SessionId: u.sessionId,
		Id:        *id,
	})
	return
}

type RemoteIdentifyUI struct {
	RemoteBaseIdentifyUI
}

func NewRemoteIdentifyUI(sessionId int, username string, c *rpc2.Client) *RemoteIdentifyUI {
	return &RemoteIdentifyUI{RemoteBaseIdentifyUI{
		sessionId: sessionId,
		username:  username,
		uicli:     keybase_1.IdentifyUiClient{c},
		logcli:    keybase_1.LogUiClient{c},
	}}
}

func (u *RemoteBaseIdentifyUI) Start() {
	u.logcli.Log(keybase_1.LogArg{SessionId: u.sessionId, Level: keybase_1.LogLevel_INFO, Text: keybase_1.Text{Data: "Identifying " + u.username}})
	return
}

func (u *RemoteBaseIdentifyUI) SetUsername(username string) {
	u.username = username
}
