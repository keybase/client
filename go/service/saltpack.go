// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/saltpackkeys"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type SaltpackHandler struct {
	*BaseHandler
	libkb.Contextified
}

type RemoteSaltpackUI struct {
	sessionID int
	cli       keybase1.SaltpackUiClient
}

func NewRemoteSaltpackUI(sessionID int, c *rpc.Client) *RemoteSaltpackUI {
	return &RemoteSaltpackUI{
		sessionID: sessionID,
		cli:       keybase1.SaltpackUiClient{Cli: c},
	}
}

func (r *RemoteSaltpackUI) SaltpackPromptForDecrypt(ctx context.Context, arg keybase1.SaltpackPromptForDecryptArg, usedDelegateUI bool) (err error) {
	arg.SessionID = r.sessionID
	arg.UsedDelegateUI = usedDelegateUI
	return r.cli.SaltpackPromptForDecrypt(ctx, arg)
}

func (r *RemoteSaltpackUI) SaltpackVerifySuccess(ctx context.Context, arg keybase1.SaltpackVerifySuccessArg) (err error) {
	arg.SessionID = r.sessionID
	return r.cli.SaltpackVerifySuccess(ctx, arg)
}

func (r *RemoteSaltpackUI) SaltpackVerifyBadSender(ctx context.Context, arg keybase1.SaltpackVerifyBadSenderArg) (err error) {
	arg.SessionID = r.sessionID
	return r.cli.SaltpackVerifyBadSender(ctx, arg)
}

func NewSaltpackHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SaltpackHandler {
	return &SaltpackHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *SaltpackHandler) SaltpackDecrypt(ctx context.Context, arg keybase1.SaltpackDecryptArg) (info keybase1.SaltpackEncryptedMessageInfo, err error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.SaltpackDecryptArg{
		Sink:   snk,
		Source: src,
		Opts:   arg.Opts,
	}

	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SaltpackUI: h.getSaltpackUI(arg.SessionID),
		SessionID:  arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	resolver := saltpackkeys.NewKeyPseudonymResolver(m)
	eng := engine.NewSaltpackDecrypt(earg, resolver)
	err = engine.RunEngine2(m, eng)
	info = eng.MessageInfo()
	return info, err
}

func (h *SaltpackHandler) SaltpackEncrypt(ctx context.Context, arg keybase1.SaltpackEncryptArg) error {
	ctx = libkb.WithLogTag(ctx, "SP")
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.SaltpackEncryptArg{
		Opts:   arg.Opts,
		Sink:   snk,
		Source: src,
	}

	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}

	keyfinderHook := saltpackkeys.NewRecipientKeyfinderEngineHook(arg.Opts.UseKBFSKeysOnlyForTesting)

	eng := engine.NewSaltpackEncrypt(earg, keyfinderHook)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *SaltpackHandler) SaltpackSign(ctx context.Context, arg keybase1.SaltpackSignArg) error {
	ctx = libkb.WithLogTag(ctx, "SP")
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.SaltpackSignArg{
		Opts:   arg.Opts,
		Sink:   snk,
		Source: src,
	}

	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	eng := engine.NewSaltpackSign(h.G(), earg)
	return engine.RunEngine2(m, eng)
}

func (h *SaltpackHandler) SaltpackVerify(ctx context.Context, arg keybase1.SaltpackVerifyArg) error {
	ctx = libkb.WithLogTag(ctx, "SP")
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.SaltpackVerifyArg{
		Opts:   arg.Opts,
		Sink:   snk,
		Source: src,
	}

	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SaltpackUI: h.getSaltpackUI(arg.SessionID),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewSaltpackVerify(h.G(), earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

// frontend handlers:

func (h *SaltpackHandler) SaltpackEncryptString(ctx context.Context, arg keybase1.SaltpackEncryptStringArg) (string, error) {
	ctx = libkb.WithLogTag(ctx, "SP")

	opts := h.encryptOptions(arg.Opts)
	sink := libkb.NewBufferCloser()
	earg := &engine.SaltpackEncryptArg{
		Opts:   opts,
		Sink:   sink,
		Source: strings.NewReader(arg.Plaintext),
	}

	if err := h.frontendEncrypt(ctx, arg.SessionID, earg); err != nil {
		return "", err
	}

	return sink.String(), nil
}

func (h *SaltpackHandler) SaltpackDecryptString(ctx context.Context, arg keybase1.SaltpackDecryptStringArg) (keybase1.SaltpackPlaintextResult, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	sink := libkb.NewBufferCloser()
	earg := &engine.SaltpackDecryptArg{
		Sink:   sink,
		Source: strings.NewReader(arg.Ciphertext),
	}

	info, err := h.frontendDecrypt(ctx, arg.SessionID, earg)
	if err != nil {
		return keybase1.SaltpackPlaintextResult{}, err
	}
	r := keybase1.SaltpackPlaintextResult{
		Info:      info,
		Plaintext: sink.String(),
	}
	return r, nil
}

func (h *SaltpackHandler) SaltpackSignString(ctx context.Context, arg keybase1.SaltpackSignStringArg) (string, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	sink := libkb.NewBufferCloser()
	earg := &engine.SaltpackSignArg{
		Sink:   sink,
		Source: ioutil.NopCloser(bytes.NewBufferString(arg.Plaintext)),
	}

	uis := libkb.UIs{
		SecretUI:  &nopSecretUI{},
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	eng := engine.NewSaltpackSign(h.G(), earg)
	if err := engine.RunEngine2(m, eng); err != nil {
		return "", err
	}

	return sink.String(), nil
}

func (h *SaltpackHandler) SaltpackVerifyString(ctx context.Context, arg keybase1.SaltpackVerifyStringArg) (keybase1.SaltpackVerifyResult, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	sink := libkb.NewBufferCloser()
	earg := &engine.SaltpackVerifyArg{
		Sink:   sink,
		Source: strings.NewReader(arg.SignedMsg),
	}

	spui := &capSaltpackUI{}
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   &nopSecretUI{},
		SaltpackUI: spui,
		SessionID:  arg.SessionID,
	}
	eng := engine.NewSaltpackVerify(h.G(), earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		return keybase1.SaltpackVerifyResult{}, err
	}
	res := keybase1.SaltpackVerifyResult{
		Plaintext: sink.String(),
	}
	if spui.signingKID != nil {
		res.SigningKID = *spui.signingKID
	}
	if spui.sender != nil {
		res.Sender = *spui.sender
	}
	return res, nil
}

func (h *SaltpackHandler) SaltpackEncryptFile(ctx context.Context, arg keybase1.SaltpackEncryptFileArg) (string, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	in, err := os.Open(arg.Filename)
	if err != nil {
		return "", err
	}
	defer in.Close()

	outFilename, bw, err := encryptFilename(arg.Filename, ".encrypted")
	if err != nil {
		return "", err
	}
	defer bw.Close()

	opts := h.encryptOptions(arg.Opts)
	opts.Binary = true

	earg := &engine.SaltpackEncryptArg{
		Opts:   opts,
		Sink:   bw,
		Source: bufio.NewReader(in),
	}

	if err := h.frontendEncrypt(ctx, arg.SessionID, earg); err != nil {
		return "", err
	}

	return outFilename, nil
}

func (h *SaltpackHandler) SaltpackDecryptFile(ctx context.Context, arg keybase1.SaltpackDecryptFileArg) (keybase1.SaltpackFileResult, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	in, err := os.Open(arg.EncryptedFilename)
	if err != nil {
		return keybase1.SaltpackFileResult{}, err
	}
	defer in.Close()
	outFilename, bw, err := decryptFilename(arg.EncryptedFilename)
	if err != nil {
		return keybase1.SaltpackFileResult{}, err
	}
	defer bw.Close()

	earg := &engine.SaltpackDecryptArg{
		Sink:   bw,
		Source: in,
	}

	info, err := h.frontendDecrypt(ctx, arg.SessionID, earg)
	if err != nil {
		return keybase1.SaltpackFileResult{}, err
	}

	r := keybase1.SaltpackFileResult{
		Info:              info,
		DecryptedFilename: outFilename,
	}
	return r, nil
}

func (h *SaltpackHandler) SaltpackSignFile(ctx context.Context, arg keybase1.SaltpackSignFileArg) (string, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	return "", errors.New("nyi")
}

func (h *SaltpackHandler) SaltpackVerifyFile(ctx context.Context, arg keybase1.SaltpackVerifyFileArg) (keybase1.SaltpackVerifyFileResult, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	return keybase1.SaltpackVerifyFileResult{}, errors.New("nyi")
}

func (h *SaltpackHandler) encryptOptions(opts keybase1.SaltpackFrontendEncryptOptions) keybase1.SaltpackEncryptOptions {
	auth := keybase1.AuthenticityType_REPUDIABLE
	if opts.Signed {
		auth = keybase1.AuthenticityType_SIGNED
	}
	return keybase1.SaltpackEncryptOptions{
		Recipients:       opts.Recipients,
		AuthenticityType: auth,
		NoSelfEncrypt:    !opts.IncludeSelf,
		UseEntityKeys:    true,
	}
}

func (h *SaltpackHandler) frontendEncrypt(ctx context.Context, sessionID int, arg *engine.SaltpackEncryptArg) error {
	uis := libkb.UIs{
		SecretUI:  &nopSecretUI{},
		SessionID: sessionID,
	}

	keyfinderHook := saltpackkeys.NewRecipientKeyfinderEngineHook(false)

	eng := engine.NewSaltpackEncrypt(arg, keyfinderHook)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)

	return engine.RunEngine2(m, eng)
}

func (h *SaltpackHandler) frontendDecrypt(ctx context.Context, sessionID int, arg *engine.SaltpackDecryptArg) (keybase1.SaltpackEncryptedMessageInfo, error) {
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(sessionID, h.G()),
		SecretUI:   &nopSecretUI{},
		SaltpackUI: &capSaltpackUI{},
		SessionID:  sessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	resolver := saltpackkeys.NewKeyPseudonymResolver(m)
	eng := engine.NewSaltpackDecrypt(arg, resolver)
	if err := engine.RunEngine2(m, eng); err != nil {
		return keybase1.SaltpackEncryptedMessageInfo{}, err
	}
	return eng.MessageInfo(), nil
}

const saltpackExtension = ".saltpack"

func encryptFilename(inFilename, suffix string) (string, *libkb.BufferWriter, error) {
	dir, file := filepath.Split(inFilename)
	withExt := filepath.Join(dir, file+suffix+saltpackExtension)
	f, err := os.Create(withExt)
	if err != nil {
		return "", nil, err
	}
	return withExt, libkb.NewBufferWriter(f), nil
}

func decryptFilename(inFilename string) (string, *libkb.BufferWriter, error) {
	dir, file := filepath.Split(inFilename)
	res := file + ".decrypted"
	if strings.HasSuffix(file, ".encrypted.saltpack") {
		res = strings.TrimSuffix(file, ".encrypted.saltpack")
	} else if strings.HasSuffix(file, ".signed.saltpack") {
		res = strings.TrimSuffix(file, ".signed.saltpack")
	}
	out := filepath.Join(dir, res)

	var found bool
	for i := 0; i < 100; i++ {
		poss := out
		if i > 0 {
			ext := filepath.Ext(poss)
			poss = fmt.Sprintf("%s (%d)%s", strings.TrimSuffix(poss, ext), i, ext)
		}
		exists, err := libkb.FileExists(poss)
		if err != nil {
			return "", nil, err
		}
		if !exists {
			found = true
			out = poss
			break
		}
	}

	if !found {
		return "", nil, errors.New("could not create output file without overwriting existing file")
	}

	f, err := os.Create(out)
	if err != nil {
		return "", nil, err
	}
	return out, libkb.NewBufferWriter(f), nil
}

// nopSecretUI returns an error if it is ever called.
// A lot of these saltpack engines say they require a secret UI.
// They really don't, but it's dangerous to try to strip it out.
type nopSecretUI struct{}

func (n *nopSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, errors.New("GetPassphrase called unexpectedly")
}

// capSaltpackUI captures the various sender info so the RPCs can just return that
// directly to the caller instead of via a UI.
type capSaltpackUI struct {
	decryptArg *keybase1.SaltpackPromptForDecryptArg
	signingKID *keybase1.KID
	sender     *keybase1.SaltpackSender
}

func (c *capSaltpackUI) SaltpackPromptForDecrypt(ctx context.Context, arg keybase1.SaltpackPromptForDecryptArg, _ bool) error {
	c.decryptArg = &arg
	return nil
}

func (c *capSaltpackUI) SaltpackVerifySuccess(ctx context.Context, arg keybase1.SaltpackVerifySuccessArg) error {
	c.signingKID = &arg.SigningKID
	c.sender = &arg.Sender
	return nil
}

func (c *capSaltpackUI) SaltpackVerifyBadSender(ctx context.Context, arg keybase1.SaltpackVerifyBadSenderArg) error {
	c.signingKID = &arg.SigningKID
	c.sender = &arg.Sender
	return nil
}
