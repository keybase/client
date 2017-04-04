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

func (u *RemotePgpUI) ShouldPushPrivate(ctx context.Context, sessionID int) (bool, error) {
	return u.cli.ShouldPushPrivate(ctx, u.sessionID)
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
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		connID:       id,
	}
}

func (h *PGPHandler) PGPSign(_ context.Context, arg keybase1.PGPSignArg) (err error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := engine.PGPSignArg{Sink: snk, Source: src, Opts: arg.Opts}
	ctx := engine.Context{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPGPSignEngine(&earg, h.G())
	return engine.RunEngine(eng, &ctx)
}

func (h *PGPHandler) PGPPull(_ context.Context, arg keybase1.PGPPullArg) error {
	earg := engine.PGPPullEngineArg{
		UserAsserts: arg.UserAsserts,
	}
	ctx := engine.Context{
		LogUI:      h.getLogUI(arg.SessionID),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPPullEngine(&earg, h.G())
	return engine.RunEngine(eng, &ctx)
}

func (h *PGPHandler) PGPEncrypt(_ context.Context, arg keybase1.PGPEncryptArg) error {
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
	ctx := &engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPEncrypt(earg, h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *PGPHandler) PGPDecrypt(_ context.Context, arg keybase1.PGPDecryptArg) (keybase1.PGPSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.PGPDecryptArg{
		Sink:         snk,
		Source:       src,
		AssertSigned: arg.Opts.AssertSigned,
		SignedBy:     arg.Opts.SignedBy,
	}
	ctx := &engine.Context{
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		IdentifyUI: h.NewRemoteSkipPromptIdentifyUI(arg.SessionID, h.G()),
		LogUI:      h.getLogUI(arg.SessionID),
		PgpUI:      h.getPgpUI(arg.SessionID),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPDecrypt(earg, h.G())
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		return keybase1.PGPSigVerification{}, err
	}

	return sigVer(h.G(), eng.SignatureStatus(), eng.Signer()), nil
}

func (h *PGPHandler) PGPVerify(_ context.Context, arg keybase1.PGPVerifyArg) (keybase1.PGPSigVerification, error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	earg := &engine.PGPVerifyArg{
		Source:    src,
		Signature: arg.Opts.Signature,
		SignedBy:  arg.Opts.SignedBy,
	}
	ctx := &engine.Context{
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		LogUI:      h.getLogUI(arg.SessionID),
		PgpUI:      h.getPgpUI(arg.SessionID),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPVerify(earg, h.G())
	err := engine.RunEngine(eng, ctx)
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

func (h *PGPHandler) PGPImport(_ context.Context, arg keybase1.PGPImportArg) error {
	ctx := &engine.Context{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng, err := engine.NewPGPKeyImportEngineFromBytes(arg.Key, arg.PushSecret, h.G())
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
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		LogUI:     h.getLogUI(sessionID),
		SessionID: sessionID,
	}
	if err := engine.RunEngine(ex, ctx); err != nil {
		return nil, err
	}
	return ex.Results(), nil
}

func (h *PGPHandler) PGPExport(_ context.Context, arg keybase1.PGPExportArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(arg.SessionID, engine.NewPGPKeyExportEngine(arg, h.G()))
}

func (h *PGPHandler) PGPExportByKID(_ context.Context, arg keybase1.PGPExportByKIDArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(arg.SessionID, engine.NewPGPKeyExportByKIDEngine(arg, h.G()))
}

func (h *PGPHandler) PGPExportByFingerprint(_ context.Context, arg keybase1.PGPExportByFingerprintArg) (ret []keybase1.KeyInfo, err error) {
	return h.export(arg.SessionID, engine.NewPGPKeyExportByFingerprintEngine(arg, h.G()))
}

func (h *PGPHandler) PGPKeyGen(_ context.Context, arg keybase1.PGPKeyGenArg) error {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	earg := engine.ImportPGPKeyImportEngineArg(arg)
	eng := engine.NewPGPKeyImportEngine(earg)
	return engine.RunEngine(eng, ctx)
}

func (h *PGPHandler) PGPKeyGenDefault(ctx context.Context, arg keybase1.PGPKeyGenDefaultArg) error {
	ectx := &engine.Context{
		LogUI:      h.getLogUI(arg.SessionID),
		PgpUI:      h.getPgpUI(arg.SessionID),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
		NetContext: ctx,
	}
	eng := engine.NewPGPKeyGen(h.G(), arg)
	return engine.RunEngine(eng, ectx)
}

func (h *PGPHandler) PGPDeletePrimary(_ context.Context, sessionID int) (err error) {
	return libkb.DeletePrimary()
}

func (h *PGPHandler) PGPSelect(nctx context.Context, sarg keybase1.PGPSelectArg) error {
	arg := engine.GPGImportKeyArg{
		Query:      sarg.FingerprintQuery,
		AllowMulti: sarg.AllowMulti,
		SkipImport: sarg.SkipImport,
		OnlyImport: sarg.OnlyImport,
	}
	gpg := engine.NewGPGImportKeyEngine(&arg, h.G())
	ctx := &engine.Context{
		GPGUI:      h.getGPGUI(sarg.SessionID),
		SecretUI:   h.getSecretUI(sarg.SessionID, h.G()),
		LogUI:      h.getLogUI(sarg.SessionID),
		LoginUI:    h.getLoginUI(sarg.SessionID),
		SessionID:  sarg.SessionID,
		NetContext: nctx,

		// TODO: Pull this type from the connectionID, rather than always
		// hardcoding CLI, which is all we use now. Note that if we did this, we'd
		// have to send HelloIAm RPCs in Main() for the CLI commands. A bit of an
		// annoying TODO, so postpone until we have a Desktop use for PGPSelect.
		ClientType: keybase1.ClientType_CLI,
	}
	return engine.RunEngine(gpg, ctx)
}

func (h *PGPHandler) PGPUpdate(_ context.Context, arg keybase1.PGPUpdateArg) error {
	ctx := engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPGPUpdateEngine(arg.Fingerprints, arg.All, h.G())
	return engine.RunEngine(eng, &ctx)
}

func (h *PGPHandler) PGPPurge(ctx context.Context, arg keybase1.PGPPurgeArg) (keybase1.PGPPurgeRes, error) {
	ectx := &engine.Context{
		LogUI:      h.getLogUI(arg.SessionID),
		SessionID:  arg.SessionID,
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		NetContext: ctx,
	}
	eng := engine.NewPGPPurge(h.G(), arg)
	var res keybase1.PGPPurgeRes
	if err := engine.RunEngine(eng, ectx); err != nil {
		return res, err
	}
	res.Filenames = eng.KeyFiles()
	return res, nil
}

// Set the PGP storage notification dismiss flag in the local DB.
func (h *PGPHandler) PGPStorageDismiss(ctx context.Context, sessionID int) error {
	username := h.G().Env.GetUsername()
	if username.IsNil() {
		return libkb.NoUsernameError{}
	}

	key := libkb.DbKeyNotificationDismiss(libkb.NotificationDismissPGPPrefix, username)
	return h.G().LocalDb.PutRaw(key, []byte(libkb.NotificationDismissPGPValue))
}
