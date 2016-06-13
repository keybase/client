// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// CryptoClient implements the Crypto interface by sending RPCs to the
// keybase daemon to perform signatures using the device's current
// signing key.
type CryptoClient struct {
	CryptoCommon
	client     keybase1.CryptoClient
	shutdownFn func()
	config     Config
}

// cryptoRPCWarningTime says how long we should wait before logging a
// message about an RPC taking too long.
const cryptoRPCWarningTime = 2 * time.Minute

var _ Crypto = (*CryptoClient)(nil)

var _ rpc.ConnectionHandler = (*CryptoClient)(nil)

// NewCryptoClient constructs a new CryptoClient.
func NewCryptoClient(config Config, kbCtx *libkb.GlobalContext) *CryptoClient {
	log := config.MakeLogger("")
	c := &CryptoClient{
		CryptoCommon: MakeCryptoCommon(config.Codec(), log),
		config:       config,
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, c)
	c.client = keybase1.CryptoClient{Cli: conn.GetClient()}
	c.shutdownFn = conn.Shutdown
	return c
}

// newCryptoClientWithClient should only be used for testing.
func newCryptoClientWithClient(config Config, client rpc.GenericClient) *CryptoClient {
	log := config.MakeLogger("")
	return &CryptoClient{
		CryptoCommon: MakeCryptoCommon(config.Codec(), log),
		client:       keybase1.CryptoClient{Cli: client},
	}
}

// HandlerName implements the ConnectionHandler interface.
func (CryptoClient) HandlerName() string {
	return "CryptoClient"
}

// OnConnect implements the ConnectionHandler interface.
func (c *CryptoClient) OnConnect(ctx context.Context, conn *rpc.Connection,
	_ rpc.GenericClient, server *rpc.Server) error {
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, nil)
	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (c *CryptoClient) OnConnectError(err error, wait time.Duration) {
	c.log.Warning("CryptoClient: connection error: %q; retrying in %s",
		err, wait)
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (c *CryptoClient) OnDoCommandError(err error, wait time.Duration) {
	c.log.Warning("CryptoClient: docommand error: %q; retrying in %s",
		err, wait)
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
}

// OnDisconnected implements the ConnectionHandler interface.
func (c *CryptoClient) OnDisconnected(_ context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		c.log.Warning("CryptoClient is disconnected")
		c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, errDisconnected{})
	}
}

// ShouldRetry implements the ConnectionHandler interface.
func (c *CryptoClient) ShouldRetry(rpcName string, err error) bool {
	return false
}

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (c *CryptoClient) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
}

func (c *CryptoClient) logAboutLongRPCUnlessCancelled(ctx context.Context,
	method string) *time.Timer {
	return time.AfterFunc(cryptoRPCWarningTime, func() {
		log := c.log.CloneWithAddedDepth(2)
		log.CInfof(ctx, "%s RPC call took more than %s", method,
			cryptoRPCWarningTime)
	})
}

// Sign implements the Crypto interface for CryptoClient.
func (c *CryptoClient) Sign(ctx context.Context, msg []byte) (
	sigInfo SignatureInfo, err error) {
	c.log.CDebugf(ctx, "Signing %d-byte message", len(msg))
	defer func() {
		c.deferLog.CDebugf(ctx, "Signed %d-byte message with %s: err=%v", len(msg),
			sigInfo, err)
	}()

	timer := c.logAboutLongRPCUnlessCancelled(ctx, "SignED25519")
	defer timer.Stop()
	ed25519SigInfo, err := c.client.SignED25519(ctx, keybase1.SignED25519Arg{
		Msg:    msg,
		Reason: "to use kbfs",
	})
	if err != nil {
		return
	}

	sigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    ed25519SigInfo.Sig[:],
		VerifyingKey: MakeVerifyingKey(libkb.NaclSigningKeyPublic(ed25519SigInfo.PublicKey).GetKID()),
	}
	return
}

// SignToString implements the Crypto interface for CryptoClient.
func (c *CryptoClient) SignToString(ctx context.Context, msg []byte) (
	signature string, err error) {
	c.log.CDebugf(ctx, "Signing %d-byte message to string", len(msg))
	defer func() {
		c.deferLog.CDebugf(ctx, "Signed %d-byte message: err=%v", len(msg), err)
	}()

	timer := c.logAboutLongRPCUnlessCancelled(ctx, "SignToString")
	defer timer.Stop()
	signature, err = c.client.SignToString(ctx, keybase1.SignToStringArg{
		Msg:    msg,
		Reason: "KBFS Authentication",
	})
	return
}

func (c *CryptoClient) prepareTLFCryptKeyClientHalf(encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	encryptedData keybase1.EncryptedBytes32, nonce keybase1.BoxNonce, err error) {
	if encryptedClientHalf.Version != EncryptionSecretbox {
		err = UnknownEncryptionVer{encryptedClientHalf.Version}
		return
	}

	if len(encryptedClientHalf.EncryptedData) != len(encryptedData) {
		err = libkb.DecryptionError{}
		return
	}
	copy(encryptedData[:], encryptedClientHalf.EncryptedData)

	if len(encryptedClientHalf.Nonce) != len(nonce) {
		err = InvalidNonceError{encryptedClientHalf.Nonce}
		return
	}
	copy(nonce[:], encryptedClientHalf.Nonce)
	return encryptedData, nonce, err
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoClient.
func (c *CryptoClient) DecryptTLFCryptKeyClientHalf(ctx context.Context,
	publicKey TLFEphemeralPublicKey,
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	clientHalf TLFCryptKeyClientHalf, err error) {
	c.log.CDebugf(ctx, "Decrypting TLF client key half")
	defer func() {
		c.deferLog.CDebugf(ctx, "Decrypted TLF client key half: %v", err)
	}()
	encryptedData, nonce, err := c.prepareTLFCryptKeyClientHalf(encryptedClientHalf)
	if err != nil {
		return
	}

	timer := c.logAboutLongRPCUnlessCancelled(ctx, "UnboxBytes32")
	defer timer.Stop()
	decryptedClientHalf, err := c.client.UnboxBytes32(ctx, keybase1.UnboxBytes32Arg{
		EncryptedBytes32: encryptedData,
		Nonce:            nonce,
		PeersPublicKey:   keybase1.BoxPublicKey(publicKey.data),
		Reason:           "to use kbfs",
	})
	if err != nil {
		return
	}

	clientHalf = MakeTLFCryptKeyClientHalf(decryptedClientHalf)
	return
}

// DecryptTLFCryptKeyClientHalfAny implements the Crypto interface for
// CryptoClient.
func (c *CryptoClient) DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
	keys []EncryptedTLFCryptKeyClientAndEphemeral, promptPaper bool) (
	clientHalf TLFCryptKeyClientHalf, index int, err error) {
	c.log.CDebugf(ctx, "Decrypting TLF client key half with any key")
	defer func() {
		c.deferLog.CDebugf(ctx, "Decrypted TLF client key half with any key: %v",
			err)
	}()
	if len(keys) == 0 {
		return clientHalf, index, NoKeysError{}
	}
	bundles := make([]keybase1.CiphertextBundle, 0, len(keys))
	errors := make([]error, 0, len(keys))
	indexLookup := make([]int, 0, len(keys))
	for i, k := range keys {
		encryptedData, nonce, err := c.prepareTLFCryptKeyClientHalf(k.ClientHalf)
		if err != nil {
			errors = append(errors, err)
		} else {
			bundles = append(bundles, keybase1.CiphertextBundle{
				Kid:        k.PubKey.kidContainer.kid,
				Ciphertext: encryptedData,
				Nonce:      nonce,
				PublicKey:  keybase1.BoxPublicKey(k.EPubKey.data),
			})
			indexLookup = append(indexLookup, i)
		}
	}
	if len(bundles) == 0 {
		err = errors[0]
		return
	}
	timer := c.logAboutLongRPCUnlessCancelled(ctx, "UnboxBytes32Any")
	defer timer.Stop()
	res, err := c.client.UnboxBytes32Any(ctx, keybase1.UnboxBytes32AnyArg{
		Bundles:     bundles,
		Reason:      "to rekey for kbfs",
		PromptPaper: promptPaper,
	})
	if err != nil {
		return
	}
	return MakeTLFCryptKeyClientHalf(res.Plaintext), indexLookup[res.Index], nil
}

// Shutdown implements the Crypto interface for CryptoClient.
func (c *CryptoClient) Shutdown() {
	if c.shutdownFn != nil {
		c.shutdownFn()
	}
}
