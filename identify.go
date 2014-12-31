package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteIdentifyUI struct {
	sessionId int
	rpccli    *rpc2.Client
	uicli     keybase_1.IdentifyUiClient
}

type IdentifyHandler struct {
	xp *rpc2.Transport
	cli  *rpc2.Client
}

func (h *IdentifyHandler) getRpcClient() (cli *rpc2.Client) {
	if h.cli == nil {
		h.cli = rpc2.NewClient(h.xp, libkb.UnwrapError)
	}
	return h.cli
}

func NewRemoteIdentifyUI(sessionId int, c *rpc2.Client) *RemoteIdentifyUI {
	return &RemoteIdentifyUI{
		sessionId: sessionId,
		rpccli:    c,
		uicli:     keybase_1.IdentifyUiClient{c},
	}
}

func (h *IdentifyHandler) newUi(sessionId int) libkb.IdentifyUI {
	return NewRemoteIdentifyUI(sessionId, h.getRpcClient())
}

func (u *RemoteIdentifyUI) FinishWebProofCheck(p keybase_1.RemoteProof, lcr keybase_1.LinkCheckResult) {
	u.uicli.FinishWebProofCheck(keybase_1.FinishWebProofCheckArg{
		SessionId: u.sessionId,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteIdentifyUI) FinishSocialProofCheck(p keybase_1.RemoteProof, lcr keybase_1.LinkCheckResult) {
	u.uicli.FinishSocialProofCheck(keybase_1.FinishSocialProofCheckArg{
		SessionId: u.sessionId,
		Rp:        p,
		Lcr:     lcr,
	})
	return
}

func (u *RemoteIdentifyUI) FinishAndPrompt(io *keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error) {
	return u.uicli.FinishAndPrompt(keybase_1.FinishAndPromptArg{SessionId: u.sessionId, Outcome: *io, })
}

func (u *RemoteIdentifyUI) DisplayCryptocurrency(c keybase_1.Cryptocurrency) {
	u.uicli.DisplayCryptocurrency(keybase_1.DisplayCryptocurrencyArg{SessionId: u.sessionId, C: c })
	return
}

func (u *RemoteIdentifyUI) DisplayKey(k keybase_1.FOKID, d *keybase_1.TrackDiff) {
	u.uicli.DisplayKey(keybase_1.DisplayKeyArg{SessionId: u.sessionId, Fokid: k, Diff: d})
	return
}

func (u *RemoteIdentifyUI) ReportLastTrack(t *keybase_1.TrackSummary) {
	u.uicli.ReportLastTrack(keybase_1.ReportLastTrackArg{SessionId: u.sessionId, Track: t})
	return
}

func (u *RemoteIdentifyUI) Start() {}

func (u *RemoteIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity) {
	u.uicli.LaunchNetworkChecks(keybase_1.LaunchNetworkChecksArg{
		SessionId: u.sessionId,
		Id:        *id,
	})
	return
}

func (h *IdentifyHandler) IdentifySelf(sessionId int) error {
	luarg := libkb.LoadUserArg{}
	u, err := libkb.LoadMe(luarg)
	if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else if _, not_selected := err.(libkb.NoSelectedKeyError); not_selected {
		_, err = u.IdentifySelf(h.newUi(sessionId))
	}
	return err
}
