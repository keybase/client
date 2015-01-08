package main

import (
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteBaseIdentifyUI struct {
	sessionId int
	uicli     keybase_1.IdentifyUiClient
}

type RemoteSelfIdentifyUI struct {
	*RemoteBaseIdentifyUI
}

type IdentifyHandler struct {
	BaseHandler
}

func NewIdentifyHandler(xp *rpc2.Transport) *IdentifyHandler {
	return &IdentifyHandler{BaseHandler{xp: xp}}
}

var (
	__sessionId = 0
)

func nextSessionId() int {
	ret := __sessionId
	__sessionId++
	return ret
}

func NextRemoteSelfIdentifyUI(c *rpc2.Client) *RemoteSelfIdentifyUI {
	return &RemoteSelfIdentifyUI{NextRemoteBaseIdentifyUI(c)}
}

func NextRemoteBaseIdentifyUI(c *rpc2.Client) *RemoteBaseIdentifyUI {
	nxt := nextSessionId()
	return NewRemoteBaseIdentifyUI(nxt, c)
}

func NewRemoteBaseIdentifyUI(sessionId int, c *rpc2.Client) *RemoteBaseIdentifyUI {
	return &RemoteBaseIdentifyUI{
		sessionId: sessionId,
		uicli:     keybase_1.IdentifyUiClient{c},
	}
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

func (u *RemoteSelfIdentifyUI) Start() {
	return
}

func (u *RemoteBaseIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity) {
	u.uicli.LaunchNetworkChecks(keybase_1.LaunchNetworkChecksArg{
		SessionId: u.sessionId,
		Id:        *id,
	})
	return
}
