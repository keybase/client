package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteBaseIdentifyUI struct {
	sessionId int
	rpccli    *rpc2.Client
	uicli     keybase_1.IdentifyUiClient
}

type RemoteSelfIdentifyUI struct {
	*RemoteBaseIdentifyUI
}

type IdentifyHandler struct {
	xp  *rpc2.Transport
	cli *rpc2.Client
}

func (h *IdentifyHandler) getRpcClient() (cli *rpc2.Client) {
	if h.cli == nil {
		h.cli = rpc2.NewClient(h.xp, libkb.UnwrapError)
	}
	return h.cli
}

var (
	__sessionId = 0
)

func NextRemoteSelfIdentifyUI(c *rpc2.Client) *RemoteSelfIdentifyUI {
	return &RemoteSelfIdentifyUI{NextRemoteBaseIdentifyUI(c)}
}

func NextRemoteBaseIdentifyUI(c *rpc2.Client) *RemoteBaseIdentifyUI {
	nxt := __sessionId
	__sessionId++
	return NewRemoteBaseIdentifyUI(nxt, c)
}

func NewRemoteBaseIdentifyUI(sessionId int, c *rpc2.Client) *RemoteBaseIdentifyUI {
	return &RemoteBaseIdentifyUI{
		sessionId: sessionId,
		rpccli:    c,
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

func (u *RemoteBaseIdentifyUI) Warning(s string) {
	u.uicli.Warning(keybase_1.WarningArg{SessionId: u.sessionId, Msg: s})
	return
}

func (u *RemoteSelfIdentifyUI) Start() {
	msg := "Verifying your key fingerprint..."
	u.uicli.Warning(keybase_1.WarningArg{SessionId: u.sessionId, Msg: msg})
	return
}

func (u *RemoteBaseIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity) {
	u.uicli.LaunchNetworkChecks(keybase_1.LaunchNetworkChecksArg{
		SessionId: u.sessionId,
		Id:        *id,
	})
	return
}
