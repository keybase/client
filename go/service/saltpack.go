// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/chat/attachments/progress"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/saltpackkeys"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

const saltpackExtension = ".saltpack"
const encryptedSuffix = ".encrypted"
const signedSuffix = ".signed"
const encryptedExtension = encryptedSuffix + saltpackExtension
const signedExtension = signedSuffix + saltpackExtension
const decryptedExtension = ".decrypted"
const verifiedExtension = ".verified"

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

	info, signed, err := h.frontendDecrypt(ctx, arg.SessionID, earg)
	if err != nil {
		return keybase1.SaltpackPlaintextResult{}, err
	}
	r := keybase1.SaltpackPlaintextResult{
		Info:      info,
		Plaintext: sink.String(),
		Signed:    signed,
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

	if err := h.frontendSign(ctx, arg.SessionID, earg); err != nil {
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

	spui, err := h.frontendVerify(ctx, arg.SessionID, earg)
	if err != nil {
		return keybase1.SaltpackVerifyResult{}, err
	}
	res := keybase1.SaltpackVerifyResult{
		Plaintext: sink.String(),
		Verified:  spui.verified,
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
	sf, err := newSourceFile(h.G(), keybase1.OperationType_ENCRYPT, arg.Filename)
	if err != nil {
		return "", err
	}
	defer sf.Close()

	outFilename, bw, err := boxFilename(arg.Filename, encryptedSuffix)
	if err != nil {
		return "", err
	}
	defer bw.Close()

	opts := h.encryptOptions(arg.Opts)
	opts.Binary = true
	opts.UseDeviceKeys = true
	opts.UsePaperKeys = true

	earg := &engine.SaltpackEncryptArg{
		Opts:   opts,
		Sink:   bw,
		Source: sf,
	}

	if err := h.frontendEncrypt(ctx, arg.SessionID, earg); err != nil {
		return "", err
	}

	return outFilename, nil
}

func (h *SaltpackHandler) SaltpackDecryptFile(ctx context.Context, arg keybase1.SaltpackDecryptFileArg) (keybase1.SaltpackFileResult, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	sf, err := newSourceFile(h.G(), keybase1.OperationType_DECRYPT, arg.EncryptedFilename)
	if err != nil {
		return keybase1.SaltpackFileResult{}, err
	}
	defer sf.Close()

	outFilename, bw, err := unboxFilename(arg.EncryptedFilename, decryptedExtension)
	if err != nil {
		return keybase1.SaltpackFileResult{}, err
	}
	defer bw.Close()

	earg := &engine.SaltpackDecryptArg{
		Sink:   bw,
		Source: sf,
	}

	info, signed, err := h.frontendDecrypt(ctx, arg.SessionID, earg)
	if err != nil {
		return keybase1.SaltpackFileResult{}, err
	}

	r := keybase1.SaltpackFileResult{
		Info:              info,
		DecryptedFilename: outFilename,
		Signed:            signed,
	}
	return r, nil
}

func (h *SaltpackHandler) SaltpackSignFile(ctx context.Context, arg keybase1.SaltpackSignFileArg) (string, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	sf, err := newSourceFile(h.G(), keybase1.OperationType_SIGN, arg.Filename)
	if err != nil {
		return "", err
	}
	defer sf.Close()

	outFilename, bw, err := boxFilename(arg.Filename, signedSuffix)
	if err != nil {
		return "", err
	}
	defer bw.Close()

	earg := &engine.SaltpackSignArg{
		Sink:   bw,
		Source: sf,
		Opts: keybase1.SaltpackSignOptions{
			Binary: true,
		},
	}

	if err := h.frontendSign(ctx, arg.SessionID, earg); err != nil {
		return "", err
	}

	return outFilename, nil
}

func (h *SaltpackHandler) SaltpackVerifyFile(ctx context.Context, arg keybase1.SaltpackVerifyFileArg) (keybase1.SaltpackVerifyFileResult, error) {
	ctx = libkb.WithLogTag(ctx, "SP")
	sf, err := newSourceFile(h.G(), keybase1.OperationType_VERIFY, arg.SignedFilename)
	if err != nil {
		return keybase1.SaltpackVerifyFileResult{}, err
	}
	defer sf.Close()

	outFilename, bw, err := unboxFilename(arg.SignedFilename, verifiedExtension)
	if err != nil {
		return keybase1.SaltpackVerifyFileResult{}, err
	}
	defer bw.Close()

	earg := &engine.SaltpackVerifyArg{
		Sink:   bw,
		Source: sf,
	}

	spui, err := h.frontendVerify(ctx, arg.SessionID, earg)
	if err != nil {
		return keybase1.SaltpackVerifyFileResult{}, err
	}
	res := keybase1.SaltpackVerifyFileResult{
		VerifiedFilename: outFilename,
		Verified:         spui.verified,
	}
	if spui.signingKID != nil {
		res.SigningKID = *spui.signingKID
	}
	if spui.sender != nil {
		res.Sender = *spui.sender
	}
	return res, nil
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

func (h *SaltpackHandler) frontendDecrypt(ctx context.Context, sessionID int, arg *engine.SaltpackDecryptArg) (keybase1.SaltpackEncryptedMessageInfo, bool, error) {
	spui := &capSaltpackUI{}
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(sessionID, h.G()),
		SecretUI:   &nopSecretUI{},
		SaltpackUI: spui,
		SessionID:  sessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	resolver := saltpackkeys.NewKeyPseudonymResolver(m)
	eng := engine.NewSaltpackDecrypt(arg, resolver)
	if err := engine.RunEngine2(m, eng); err != nil {
		return keybase1.SaltpackEncryptedMessageInfo{}, false, err
	}
	return eng.MessageInfo(), spui.verified, nil
}

func (h *SaltpackHandler) frontendVerify(ctx context.Context, sessionID int, arg *engine.SaltpackVerifyArg) (*capSaltpackUI, error) {
	spui := &capSaltpackUI{}
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(sessionID, h.G()),
		SecretUI:   &nopSecretUI{},
		SaltpackUI: spui,
		SessionID:  sessionID,
	}
	eng := engine.NewSaltpackVerify(h.G(), arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		return nil, err
	}
	return spui, nil
}

func (h *SaltpackHandler) frontendSign(ctx context.Context, sessionID int, arg *engine.SaltpackSignArg) error {
	uis := libkb.UIs{
		SecretUI:  &nopSecretUI{},
		SessionID: sessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	eng := engine.NewSaltpackSign(h.G(), arg)
	return engine.RunEngine2(m, eng)
}

func boxFilename(inFilename, suffix string) (string, *libkb.BufferWriter, error) {
	dir, file := filepath.Split(inFilename)
	withExt := filepath.Join(dir, file+suffix+saltpackExtension)
	f, err := os.Create(withExt)
	if err != nil {
		return "", nil, err
	}
	return withExt, libkb.NewBufferWriter(f), nil
}

// unboxFilename takes a filename and creates a new file where the result
// of decrypt or verify can go.
//
// If inFilename ends in .encrypted.saltpack or .signed.saltpack, the result
// filename will just have that stripped off.  If a file without that extension
// already exists, it will look for a file with <name>` (n)`.<extension> for
// n = 1..99 that doesn't exist.
//
// If inFilename doesn't have a saltpack suffix, it uses the suffix that is passed
// in, so it would be <filename>.decrypted or <filename>.verified.
func unboxFilename(inFilename, suffix string) (string, *libkb.BufferWriter, error) {
	dir, file := filepath.Split(inFilename)
	// default desired filename is the input filename plus the suffix.
	desiredFilename := file + suffix

	// if the input filename ends in .encrypted.saltpack or .signed.saltpack,
	// strip that off and use that instead.
	if strings.HasSuffix(file, encryptedExtension) {
		desiredFilename = strings.TrimSuffix(file, encryptedExtension)
	} else if strings.HasSuffix(file, signedExtension) {
		desiredFilename = strings.TrimSuffix(file, signedExtension)
	}

	finalPath := filepath.Join(dir, desiredFilename)

	var found bool
	for i := 0; i < 100; i++ {
		possible := finalPath
		if i > 0 {
			// after the first time through, add a (i) to the filename
			// to try to find one that doesn't exist
			ext := filepath.Ext(possible)
			possible = fmt.Sprintf("%s (%d)%s", strings.TrimSuffix(possible, ext), i, ext)
		}
		exists, err := libkb.FileExists(possible)
		if err != nil {
			return "", nil, err
		}
		if !exists {
			// found a filename that doesn't exist
			found = true
			finalPath = possible
			break
		}
	}

	if !found {
		// after 100 attempts, no file found that wouldn't overwrite an existing
		// file, so bail out.
		return "", nil, errors.New("could not create output file without overwriting existing file")
	}

	// finalPath contains a filename that doesn't exist, so make the file
	f, err := os.Create(finalPath)
	if err != nil {
		return "", nil, err
	}
	return finalPath, libkb.NewBufferWriter(f), nil
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
	verified   bool
}

func (c *capSaltpackUI) SaltpackPromptForDecrypt(ctx context.Context, arg keybase1.SaltpackPromptForDecryptArg, _ bool) error {
	c.decryptArg = &arg
	c.verified = arg.Signed
	return nil
}

func (c *capSaltpackUI) SaltpackVerifySuccess(ctx context.Context, arg keybase1.SaltpackVerifySuccessArg) error {
	c.signingKID = &arg.SigningKID
	c.sender = &arg.Sender
	c.verified = true
	return nil
}

func (c *capSaltpackUI) SaltpackVerifyBadSender(ctx context.Context, arg keybase1.SaltpackVerifyBadSenderArg) error {
	c.signingKID = &arg.SigningKID
	c.sender = &arg.Sender
	c.verified = false
	return nil
}

type sourceFile struct {
	filename string
	op       keybase1.OperationType
	f        *os.File
	r        io.Reader
	prog     *progress.ProgressWriter
	libkb.Contextified
}

func newSourceFile(g *libkb.GlobalContext, op keybase1.OperationType, filename string) (*sourceFile, error) {
	s, err := os.Stat(filename)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	sf := &sourceFile{
		filename:     filename,
		op:           op,
		f:            f,
		Contextified: libkb.NewContextified(g),
	}
	sf.G().NotifyRouter.HandleSaltpackOperationStart(context.Background(), sf.op, sf.filename)
	sf.prog = progress.NewProgressWriter(sf.reporter, s.Size())
	sf.r = io.TeeReader(bufio.NewReader(f), sf.prog)

	return sf, nil
}

func (sf *sourceFile) Read(p []byte) (n int, err error) {
	return sf.r.Read(p)
}

func (sf *sourceFile) Close() error {
	sf.G().NotifyRouter.HandleSaltpackOperationDone(context.Background(), sf.op, sf.filename)
	sf.prog.Finish()
	return sf.f.Close()
}

func (sf *sourceFile) reporter(bytesComplete, bytesTotal int64) {
	sf.G().NotifyRouter.HandleSaltpackOperationProgress(context.Background(), sf.op, sf.filename, bytesComplete, bytesTotal)
}
