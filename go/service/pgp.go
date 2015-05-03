package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type PGPHandler struct {
	*BaseHandler
}

func NewPGPHandler(xp *rpc2.Transport) *PGPHandler {
	return &PGPHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *PGPHandler) PgpSign(arg keybase_1.PgpSignArg) (err error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli)
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
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli)
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
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli)
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
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli)
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
	eng, err := engine.NewPGPKeyImportEngineFromBytes(arg.Key, arg.PushSecret, nil)
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

func (h *PGPHandler) PgpKeyGen(arg keybase_1.PgpKeyGenArg) (err error) {
	earg := engine.ImportPGPKeyImportEngineArg(arg)
	return h.keygen(earg, true)
}

func (h *PGPHandler) keygen(earg engine.PGPKeyImportEngineArg, doInteractive bool) (err error) {
	sessionID := nextSessionID()
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID), SecretUI: h.getSecretUI(sessionID)}
	earg.Gen.AddDefaultUid()
	eng := engine.NewPGPKeyImportEngine(earg)
	err = engine.RunEngine(eng, ctx)
	return err
}

func (h *PGPHandler) PgpKeyGenDefault(arg keybase_1.PgpCreateUids) (err error) {
	earg := engine.PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			Ids:         libkb.ImportPgpIdentities(arg.Ids),
			NoDefPGPUid: !arg.UseDefault,
		},
	}
	return h.keygen(earg, false)
}

func (h *PGPHandler) PgpDeletePrimary() (err error) {
	return libkb.DeletePrimary()
}

func (h *PGPHandler) PgpSelect(sarg keybase_1.PgpSelectArg) error {
	sessionID := nextSessionID()
	gpgui := NewRemoteGPGUI(sessionID, h.getRpcClient())
	secretui := h.getSecretUI(sessionID)
	arg := engine.GPGImportKeyArg{Query: sarg.Query, AllowMulti: sarg.AllowMulti, SkipImport: sarg.SkipImport}
	gpg := engine.NewGPGImportKeyEngine(&arg)
	ctx := &engine.Context{
		GPGUI:    gpgui,
		SecretUI: secretui,
		LogUI:    h.getLogUI(sessionID),
		LoginUI:  h.getLoginUI(sessionID),
	}
	return engine.RunEngine(gpg, ctx)
}

func (h *PGPHandler) PgpUpdate(arg keybase_1.PgpUpdateArg) error {
	ctx := engine.Context{
		LogUI: h.getLogUI(arg.SessionID),
	}
	eng := engine.NewPGPUpdateEngine(arg.Fingerprints, arg.All)
	return engine.RunEngine(eng, &ctx)
}
