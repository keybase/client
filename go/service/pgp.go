// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type RemotePgpUI struct {
	sessionID int
	cli       keybase1.PGPUiClient
}

func NewRemotePgpUI(sessionID int, c *rpc.Client) *RemotePgpUI {
	return &RemotePgpUI{
		sessionID: sessionID,
		cli:       keybase1.PGPUiClient{Cli: c},
	}
}

func (u *RemotePgpUI) OutputSignatureSuccess(ctx context.Context, arg keybase1.OutputSignatureSuccessArg) error {
	return u.cli.OutputSignatureSuccess(ctx, arg)
}

func (u *RemotePgpUI) OutputSignatureSuccessNonKeybase(ctx context.Context, arg keybase1.OutputSignatureSuccessNonKeybaseArg) error {
	return u.cli.OutputSignatureSuccessNonKeybase(ctx, arg)
}

func (u *RemotePgpUI) KeyGenerated(ctx context.Context, arg keybase1.KeyGeneratedArg) error {
	arg.SessionID = u.sessionID
	return u.cli.KeyGenerated(ctx, arg)
}

func (u *RemotePgpUI) ShouldPushPrivate(ctx context.Context, arg keybase1.ShouldPushPrivateArg) (bool, error) {
	arg.SessionID = u.sessionID
	return u.cli.ShouldPushPrivate(ctx, arg)
}

func (u *RemotePgpUI) Finished(ctx context.Context, sessionID int) error {
	return u.cli.Finished(ctx, u.sessionID)
}

type PGPHandler struct {
	*BaseHandler
	libkb.Contextified
	connID libkb.ConnectionID
}

func NewPGPHandler(xp rpc.Transporter, id libkb.ConnectionID, g *libkb.GlobalContext) *PGPHandler {
	return &PGPHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
		connID:       id,
	}
}

func (h *PGPHandler) PGPSign(ctx context.Context, arg keybase1.PGPSignArg) (err error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := engine.PGPSignArg{Sink: snk, Source: src, Opts: arg.Opts}
	uis := libkb.UIs{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPGPSignEngine(h.G(), &earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *PGPHandler) PGPPull(ctx context.Context, arg keybase1.PGPPullArg) error {
	earg := engine.PGPPullEngineArg{
		UserAsserts: arg.UserAsserts,
	}
	uis := libkb.UIs{
		LogUI:      h.getLogUI(arg.SessionID),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPPullEngine(h.G(), &earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *PGPHandler) PGPEncrypt(ctx context.Context, arg keybase1.PGPEncryptArg) error {
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
	}
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPEncrypt(h.G(), earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *PGPHandler) PGPDecrypt(ctx context.Context, arg keybase1.PGPDecryptArg) (keybase1.PGPSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.PGPDecryptArg{
		Sink:         snk,
		Source:       src,
		AssertSigned: arg.Opts.AssertSigned,
		SignedBy:     arg.Opts.SignedBy,
	}
	uis := libkb.UIs{
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		IdentifyUI: h.NewRemoteSkipPromptIdentifyUI(arg.SessionID, h.G()),
		LogUI:      h.getLogUI(arg.SessionID),
		PgpUI:      h.getPgpUI(arg.SessionID),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPDecrypt(h.G(), earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	err := engine.RunEngine2(m, eng)
	if err != nil {
		return keybase1.PGPSigVerification{}, err
	}

	return sigVer(h.G(), eng.SignatureStatus(), eng.Signer()), nil
}

func (h *PGPHandler) PGPVerify(ctx context.Context, arg keybase1.PGPVerifyArg) (keybase1.PGPSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	earg := &engine.PGPVerifyArg{
		Source:    src,
		Signature: arg.Opts.Signature,
		SignedBy:  arg.Opts.SignedBy,
	}
	uis := libkb.UIs{
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		LogUI:      h.getLogUI(arg.SessionID),
		PgpUI:      h.getPgpUI(arg.SessionID),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPVerify(h.G(), earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	err := engine.RunEngine2(m, eng)
	if err != nil {
		return keybase1.PGPSigVerification{}, err
	}

	return sigVer(h.G(), eng.SignatureStatus(), eng.Signer()), nil
}

func sigVer(g *libkb.GlobalContext, ss *libkb.SignatureStatus, signer *libkb.User) keybase1.PGPSigVerification {
	var res keybase1.PGPSigVerification
	if ss.IsSigned {
		res.IsSigned = ss.IsSigned
		res.Verified = ss.Verified
		if signer != nil {
			signerExp := signer.Export()
			if signerExp != nil {
				res.Signer = *signerExp
			}
		}
		if ss.Entity != nil {
			bundle := libkb.NewPGPKeyBundle(ss.Entity)
			res.SignKey = bundle.Export()
		}
	}
	return res
}

func (h *PGPHandler) PGPImport(ctx context.Context, arg keybase1.PGPImportArg) error {
	uis := libkb.UIs{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng, err := engine.NewPGPKeyImportEngineFromBytes(h.G(), arg.Key, arg.PushSecret)
	if err != nil {
		return err
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	return err
}

type exporter interface {
	engine.Engine2
	Results() []keybase1.KeyInfo
}

func (h *PGPHandler) export(ctx context.Context, sessionID int, ex exporter) ([]keybase1.KeyInfo, error) {
	uis := libkb.UIs{
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		LogUI:     h.getLogUI(sessionID),
		SessionID: sessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	if err := engine.RunEngine2(m, ex); err != nil {
		return nil, err
	}
	return ex.Results(), nil
}

func (h *PGPHandler) PGPExport(ctx context.Context, arg keybase1.PGPExportArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(ctx, arg.SessionID, engine.NewPGPKeyExportEngine(h.G(), arg))
}

func (h *PGPHandler) PGPExportByKID(ctx context.Context, arg keybase1.PGPExportByKIDArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(ctx, arg.SessionID, engine.NewPGPKeyExportByKIDEngine(h.G(), arg))
}

func (h *PGPHandler) PGPExportByFingerprint(ctx context.Context, arg keybase1.PGPExportByFingerprintArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(ctx, arg.SessionID, engine.NewPGPKeyExportByFingerprintEngine(h.G(), arg))
}

func (h *PGPHandler) PGPKeyGen(ctx context.Context, arg keybase1.PGPKeyGenArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	earg := engine.ImportPGPKeyImportEngineArg(arg)
	eng := engine.NewPGPKeyImportEngine(h.G(), earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *PGPHandler) PGPKeyGenDefault(ctx context.Context, arg keybase1.PGPKeyGenDefaultArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		PgpUI:     h.getPgpUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPGPKeyGen(h.G(), arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *PGPHandler) PGPDeletePrimary(ctx context.Context, sessionID int) (err error) {
	return libkb.DeletePrimary(libkb.NewMetaContext(ctx, h.G()))
}

func (h *PGPHandler) PGPSelect(nctx context.Context, sarg keybase1.PGPSelectArg) error {
	arg := engine.GPGImportKeyArg{
		HasProvisionedDevice: true,
		Query:                sarg.FingerprintQuery,
		AllowMulti:           sarg.AllowMulti,
		SkipImport:           sarg.SkipImport,
		OnlyImport:           sarg.OnlyImport,
	}
	gpg := engine.NewGPGImportKeyEngine(h.G(), &arg)
	uis := libkb.UIs{
		GPGUI:     h.getGPGUI(sarg.SessionID),
		SecretUI:  h.getSecretUI(sarg.SessionID, h.G()),
		LogUI:     h.getLogUI(sarg.SessionID),
		LoginUI:   h.getLoginUI(sarg.SessionID),
		SessionID: sarg.SessionID,

		// TODO: Pull this type from the connectionID, rather than always
		// hardcoding CLI, which is all we use now. Note that if we did this, we'd
		// have to send HelloIAm RPCs in Main() for the CLI commands. A bit of an
		// annoying TODO, so postpone until we have a Desktop use for PGPSelect.
		ClientType: keybase1.ClientType_CLI,
	}
	m := libkb.NewMetaContext(nctx, h.G()).WithUIs(uis)

	return engine.RunEngine2(m, gpg)
}

func (h *PGPHandler) PGPUpdate(ctx context.Context, arg keybase1.PGPUpdateArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPGPUpdateEngine(h.G(), arg.Fingerprints, arg.All)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *PGPHandler) PGPPurge(ctx context.Context, arg keybase1.PGPPurgeArg) (keybase1.PGPPurgeRes, error) {
	uis := libkb.UIs{
		LogUI:      h.getLogUI(arg.SessionID),
		SessionID:  arg.SessionID,
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
	}
	eng := engine.NewPGPPurge(h.G(), arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	var res keybase1.PGPPurgeRes
	if err := engine.RunEngine2(m, eng); err != nil {
		return res, err
	}
	res.Filenames = eng.KeyFiles()
	return res, nil
}

// Set the PGP storage notification dismiss flag in the local DB.
func (h *PGPHandler) PGPStorageDismiss(ctx context.Context, sessionID int) error {
	username := h.G().Env.GetUsername()
	if username.IsNil() {
		return libkb.NewNoUsernameError()
	}

	key := libkb.DbKeyNotificationDismiss(libkb.NotificationDismissPGPPrefix, username)
	return h.G().LocalDb.PutRaw(key, []byte(libkb.NotificationDismissPGPValue))
}

func (h *PGPHandler) PGPPushPrivate(ctx context.Context, arg keybase1.PGPPushPrivateArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		GPGUI:     h.getGPGUI(arg.SessionID),
	}
	eng := engine.NewPGPPushPrivate(arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *PGPHandler) PGPPullPrivate(ctx context.Context, arg keybase1.PGPPullPrivateArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		GPGUI:     h.getGPGUI(arg.SessionID),
	}
	eng := engine.NewPGPPullPrivate(arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}
