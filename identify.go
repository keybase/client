package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	fmprpc "github.com/maxtaco/go-framed-msgpack-rpc"
	"github.com/ugorji/go/codec"
	"net"
	"net/rpc"
)

type RemoteIdentifyUI struct {
	sessionId int
	rpccli    *rpc.Client
	uicli     keybase_1.IdentifyUiClient
}

type IdentifyHandler struct {
	conn net.Conn
	cli  *rpc.Client
}

func (h *IdentifyHandler) GetRpcClient() (cli *rpc.Client) {
	if cli = h.cli; cli == nil {
		var mh codec.MsgpackHandle
		cdc := fmprpc.MsgpackSpecRpc.ClientCodec(h.conn, &mh, true)
		cli = rpc.NewClientWithCodec(cdc)
		h.cli = cli
	}
	return
}

func NewRemoteIdentifyUI(sessionId int, c *rpc.Client) *RemoteIdentifyUI {
	return &RemoteIdentifyUI{
		sessionId: sessionId,
		rpccli:    c,
		uicli:     keybase_1.IdentifyUiClient{c},
	}
}

func (h *IdentifyHandler) NewUi(sessionId int) libkb.IdentifyUI {
	return NewRemoteIdentifyUI(sessionId, h.GetRpcClient())
}

func (u *RemoteIdentifyUI) FinishWebProofCheck(p keybase_1.RemoteProof, lcr libkb.LinkCheckResult) {
	var status keybase_1.Status
	u.uicli.FinishWebProofCheck(keybase_1.FinishWebProofCheckArg{
		SessionId: u.sessionId,
		Rp:        p,
		Lcr:       lcr.Export(),
	}, &status)
	return
}

func (u *RemoteIdentifyUI) FinishSocialProofCheck(p keybase_1.RemoteProof, lcr libkb.LinkCheckResult) {
	var status keybase_1.Status
	u.uicli.FinishSocialProofCheck(keybase_1.FinishSocialProofCheckArg{
		SessionId: u.sessionId,
		Rp:        p,
		Lcr:     lcr.Export(),
	}, &status)
	return
}

func (u *RemoteIdentifyUI) FinishAndPrompt(res *libkb.IdentifyRes) (ti libkb.TrackInstructions, err error) {
	var fpr keybase_1.FinishAndPromptRes
	err = u.uicli.FinishAndPrompt(keybase_1.FinishAndPromptArg{
		SessionId: u.sessionId,
		Outcome:   res.ExportToIdentifyOutcome(),
	}, &fpr)
	if err == nil {
		err = libkb.ImportStatusAsError(fpr.Status)
		ti.Local = fpr.TrackLocal
		ti.Remote = fpr.TrackRemote
	}
	return
}

func (u *RemoteIdentifyUI) DisplayCryptocurrency(l *libkb.CryptocurrencyChainLink) {
	var status keybase_1.Status
	u.uicli.DisplayCryptocurrency(keybase_1.DisplayCryptocurrencyArg{
		SessionId: u.sessionId,
		Address:   l.ToDisplayString(),
	}, &status)
	return
}

func (u *RemoteIdentifyUI) DisplayKey(fp *libkb.PgpFingerprint, d libkb.TrackDiff) {
	var status keybase_1.Status
	u.uicli.DisplayKey(keybase_1.DisplayKeyArg{
		SessionId: u.sessionId,
		Fokid:     libkb.ExportAsFOKID(fp, nil),
		Diff:      libkb.ExportTrackDiff(d),
	}, &status)
	return
}

func (u *RemoteIdentifyUI) ReportLastTrack(tl *libkb.TrackLookup) {
	var status keybase_1.Status
	t := 0
	if tl != nil {
		t = int(tl.GetCTime().Unix())
	}
	u.uicli.ReportLastTrack(keybase_1.ReportLastTrackArg{
		SessionId: u.sessionId,
		Time:      t,
	}, &status)
	return
}

func (u *RemoteIdentifyUI) Start() {}

func (u *RemoteIdentifyUI) LaunchNetworkChecks(res *libkb.IdentifyRes) {
	var status keybase_1.Status
	u.uicli.LaunchNetworkChecks(keybase_1.LaunchNetworkChecksArg{
		SessionId: u.sessionId,
		Id:        res.ExportToUncheckedIdentity(),
	}, &status)
	return
}

func (h *IdentifyHandler) IdentifySelf(sessionId *int, res *keybase_1.Status) error {
	luarg := libkb.LoadUserArg{}
	u, err := libkb.LoadMe(luarg)
	if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else if _, not_selected := err.(libkb.NoSelectedKeyError); not_selected {
		_, err = u.IdentifySelf(h.NewUi(*sessionId))
	}
	status := libkb.ExportErrorAsStatus(err)
	res = &status
	return nil
}
