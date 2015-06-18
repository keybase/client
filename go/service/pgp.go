package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type PGPHandler struct {
	*BaseHandler
}

func NewPGPHandler(xp *rpc2.Transport) *PGPHandler {
	return &PGPHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *PGPHandler) PgpSign(arg keybase1.PgpSignArg) (err error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := engine.PGPSignArg{Sink: snk, Source: src, Opts: arg.Opts}
	ctx := engine.Context{SecretUI: h.getSecretUI(arg.SessionID)}
	eng := engine.NewPGPSignEngine(&earg, G)
	return engine.RunEngine(eng, &ctx)
}

func (h *PGPHandler) PgpPull(arg keybase1.PgpPullArg) error {
	earg := engine.PGPPullEngineArg{
		UserAsserts: arg.UserAsserts,
	}
	ctx := engine.Context{
		LogUI: h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPPullEngine(&earg, G)
	return engine.RunEngine(eng, &ctx)
}

func (h *PGPHandler) PgpEncrypt(arg keybase1.PgpEncryptArg) error {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
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
	eng := engine.NewPGPEncrypt(earg, G)
	return engine.RunEngine(eng, ctx)
}

func (h *PGPHandler) PgpDecrypt(arg keybase1.PgpDecryptArg) (keybase1.PgpSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.PGPDecryptArg{
		Sink:         snk,
		Source:       src,
		AssertSigned: arg.Opts.AssertSigned,
		SignedBy:     arg.Opts.SignedBy,
		TrackOptions: engine.TrackOptions{
			TrackLocalOnly: arg.Opts.LocalOnly,
			TrackApprove:   arg.Opts.ApproveRemote,
		},
	}
	ctx := &engine.Context{
		SecretUI:   h.getSecretUI(arg.SessionID),
		IdentifyUI: h.NewRemoteSkipPromptIdentifyUI(arg.SessionID),
		LogUI:      h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPDecrypt(earg, G)
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		return keybase1.PgpSigVerification{}, err
	}

	return sigVer(eng.SignatureStatus(), eng.Owner()), nil
}

func (h *PGPHandler) PgpVerify(arg keybase1.PgpVerifyArg) (keybase1.PgpSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	earg := &engine.PGPVerifyArg{
		Source:    src,
		Signature: arg.Opts.Signature,
		SignedBy:  arg.Opts.SignedBy,
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
	eng := engine.NewPGPVerify(earg, G)
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		return keybase1.PgpSigVerification{}, err
	}

	return sigVer(eng.SignatureStatus(), eng.Owner()), nil
}

func sigVer(ss *libkb.SignatureStatus, owner *libkb.User) keybase1.PgpSigVerification {
	var res keybase1.PgpSigVerification
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

func (h *PGPHandler) PgpImport(arg keybase1.PgpImportArg) error {
	ctx := &engine.Context{
		SecretUI: h.getSecretUI(arg.SessionID),
		LogUI:    h.getLogUI(arg.SessionID),
	}
	eng, err := engine.NewPGPKeyImportEngineFromBytes(arg.Key, arg.PushSecret, nil)
	if err != nil {
		return err
	}
	err = engine.RunEngine(eng, ctx)
	return err
}

type exporter interface {
	engine.Engine
	Results() []keybase1.KeyInfo
}

func (h *PGPHandler) export(sessionID int, ex exporter) ([]keybase1.KeyInfo, error) {
	ctx := &engine.Context{
		SecretUI: h.getSecretUI(sessionID),
		LogUI:    h.getLogUI(sessionID),
	}
	if err := engine.RunEngine(ex, ctx); err != nil {
		return nil, err
	}
	return ex.Results(), nil
}

func (h *PGPHandler) PgpExport(arg keybase1.PgpExportArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(arg.SessionID, engine.NewPGPKeyExportEngine(arg, G))
}

func (h *PGPHandler) PgpExportByKID(arg keybase1.PgpExportByKIDArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(arg.SessionID, engine.NewPGPKeyExportByKIDEngine(arg, G))
}

func (h *PGPHandler) PgpExportByFingerprint(arg keybase1.PgpExportByFingerprintArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(arg.SessionID, engine.NewPGPKeyExportByFingerprintEngine(arg, G))
}

func (h *PGPHandler) PgpKeyGen(arg keybase1.PgpKeyGenArg) (err error) {
	earg := engine.ImportPGPKeyImportEngineArg(arg)
	return h.keygen(arg.SessionID, earg, true)
}

func (h *PGPHandler) keygen(sessionID int, earg engine.PGPKeyImportEngineArg, doInteractive bool) (err error) {
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID), SecretUI: h.getSecretUI(sessionID)}
	earg.Gen.AddDefaultUID()
	eng := engine.NewPGPKeyImportEngine(earg)
	err = engine.RunEngine(eng, ctx)
	return err
}

func (h *PGPHandler) PgpKeyGenDefault(arg keybase1.PgpKeyGenDefaultArg) (err error) {
	earg := engine.PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			Ids:         libkb.ImportPgpIdentities(arg.CreateUids.Ids),
			NoDefPGPUid: !arg.CreateUids.UseDefault,
		},
	}
	return h.keygen(arg.SessionID, earg, false)
}

func (h *PGPHandler) PgpDeletePrimary(sessionID int) (err error) {
	return libkb.DeletePrimary()
}

func (h *PGPHandler) PgpSelect(sarg keybase1.PgpSelectArg) error {
	arg := engine.GPGImportKeyArg{Query: sarg.FingerprintQuery, AllowMulti: sarg.AllowMulti, SkipImport: sarg.SkipImport}
	gpg := engine.NewGPGImportKeyEngine(&arg, G)
	ctx := &engine.Context{
		GPGUI:    h.getGPGUI(sarg.SessionID),
		SecretUI: h.getSecretUI(sarg.SessionID),
		LogUI:    h.getLogUI(sarg.SessionID),
		LoginUI:  h.getLoginUI(sarg.SessionID),
	}
	return engine.RunEngine(gpg, ctx)
}

func (h *PGPHandler) PgpUpdate(arg keybase1.PgpUpdateArg) error {
	ctx := engine.Context{
		LogUI: h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPUpdateEngine(arg.Fingerprints, arg.All, G)
	return engine.RunEngine(eng, &ctx)
}
