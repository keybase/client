package main

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type PGPHandler struct {
	BaseHandler
}

func NewPGPHandler(xp *rpc2.Transport) *PGPHandler {
	return &PGPHandler{BaseHandler{xp: xp}}
}

func (h *PGPHandler) PgpSign(arg keybase_1.PgpSignArg) (err error) {
	cli := h.getStreamUICli()
	src := libkb.RemoteStream{Stream: arg.Source, Cli: cli}
	snk := libkb.RemoteStream{Stream: arg.Sink, Cli: cli}
	earg := engine.PGPSignArg{Sink: snk, Source: src, Opts: arg.Opts}
	ctx := engine.Context{SecretUI: h.getSecretUI(arg.SessionID)}
	eng := engine.NewPGPSignEngine(&earg)
	return engine.RunEngine(eng, &ctx)
}

func (h *PGPHandler) PgpPull(arg keybase_1.PgpPullArg) error {
	earg := engine.PGPPullEngineArg{
		UserAsserts: arg.UserAsserts,
	}
	ctx := engine.Context{
		LogUI: h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPPullEngine(&earg)
	return engine.RunEngine(eng, &ctx)
}

func (h *PGPHandler) PgpEncrypt(arg keybase_1.PgpEncryptArg) error {
	cli := h.getStreamUICli()
	src := libkb.RemoteStream{Stream: arg.Source, Cli: cli}
	snk := libkb.RemoteStream{Stream: arg.Sink, Cli: cli}
	earg := &engine.PGPEncryptArg{
		Recips:       arg.Opts.Recipients,
		Sink:         snk,
		Source:       src,
		NoSign:       arg.Opts.NoSign,
		NoSelf:       arg.Opts.NoSelf,
		BinaryOutput: arg.Opts.BinaryOut,
		KeyQuery:     arg.Opts.KeyQuery,
		TrackOptions: engine.TrackOptions{
			TrackLocalOnly: arg.Opts.LocalOnly,
			TrackApprove:   arg.Opts.ApproveRemote,
		},
	}
	ctx := &engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewPGPEncrypt(earg)
	return engine.RunEngine(eng, ctx)
}

func (h *PGPHandler) PgpDecrypt(arg keybase_1.PgpDecryptArg) (keybase_1.PgpSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.RemoteStream{Stream: arg.Source, Cli: cli}
	snk := libkb.RemoteStream{Stream: arg.Sink, Cli: cli}
	earg := &engine.PGPDecryptArg{
		Sink:         snk,
		Source:       src,
		AssertSigned: arg.Opts.AssertSigned,
		TrackOptions: engine.TrackOptions{
			TrackLocalOnly: arg.Opts.LocalOnly,
			TrackApprove:   arg.Opts.ApproveRemote,
		},
	}
	ctx := &engine.Context{
		SecretUI:   h.getSecretUI(arg.SessionID),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID),
		LogUI:      h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPDecrypt(earg)
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		return keybase_1.PgpSigVerification{}, err
	}

	return sigVer(eng.SignatureStatus(), eng.Owner()), nil
}

func (h *PGPHandler) PgpVerify(arg keybase_1.PgpVerifyArg) (keybase_1.PgpSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.RemoteStream{Stream: arg.Source, Cli: cli}
	earg := &engine.PGPVerifyArg{
		Source:    src,
		Signature: arg.Opts.Signature,
		TrackOptions: engine.TrackOptions{
			TrackLocalOnly: arg.Opts.LocalOnly,
			TrackApprove:   arg.Opts.ApproveRemote,
		},
	}
	ctx := &engine.Context{
		SecretUI:   h.getSecretUI(arg.SessionID),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID),
		LogUI:      h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPVerify(earg)
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		return keybase_1.PgpSigVerification{}, err
	}

	return sigVer(eng.SignatureStatus(), eng.Owner()), nil
}

func sigVer(ss *libkb.SignatureStatus, owner *libkb.User) keybase_1.PgpSigVerification {
	var res keybase_1.PgpSigVerification
	if ss.IsSigned {
		res.IsSigned = ss.IsSigned
		res.Verified = ss.Verified
		if owner != nil {
			signer := owner.Export()
			if signer != nil {
				res.Signer = *signer
			}
		}
		if ss.Entity != nil {
			bundle := (*libkb.PgpKeyBundle)(ss.Entity)
			res.SignKey = bundle.Export()
		}
	}
	return res
}

func (h *PGPHandler) PgpImport(arg keybase_1.PgpImportArg) error {
	ctx := &engine.Context{
		SecretUI: h.getSecretUI(arg.SessionID),
		LogUI:    h.getLogUI(arg.SessionID),
	}
	eng, err := engine.NewPGPKeyImportEngineFromBytes(arg.Key, arg.PushSecret)
	if err != nil {
		return err
	}
	err = engine.RunEngine(eng, ctx)
	return err
}

func (h *PGPHandler) PgpExport(arg keybase_1.PgpExportArg) (ret []keybase_1.FingerprintAndKey, err error) {
	ctx := &engine.Context{
		SecretUI: h.getSecretUI(arg.SessionID),
		LogUI:    h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPKeyExportEngine(arg)
	if err = engine.RunEngine(eng, ctx); err != nil {
		return
	}
	ret = eng.Results()
	return
}
