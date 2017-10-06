// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// CryptoClient is a keybase1.CryptoInterface based implementation for Crypto.
type CryptoClient struct {
	CryptoCommon
	log        logger.Logger
	deferLog   logger.Logger
	client     keybase1.CryptoInterface
	shutdownFn func()
}

// cryptoWarningTime says how long we should wait before logging a
// message about it taking too long.
const cryptoWarningTime = 2 * time.Minute

var _ Crypto = (*CryptoClient)(nil)

// NewCryptoClient constructs a crypto client for a keybase1.CryptoInterface.
func NewCryptoClient(codec kbfscodec.Codec, client keybase1.CryptoInterface, log logger.Logger) *CryptoClient {
	deferLog := log.CloneWithAddedDepth(1)
	return &CryptoClient{
		CryptoCommon: MakeCryptoCommon(codec),
		client:       client,
		log:          log,
		deferLog:     deferLog,
	}
}

func (c *CryptoClient) logAboutTooLongUnlessCancelled(ctx context.Context,
	method string) *time.Timer {
	return time.AfterFunc(cryptoWarningTime, func() {
		log := c.log.CloneWithAddedDepth(2)
		log.CInfof(ctx, "%s call took more than %s", method,
			cryptoWarningTime)
	})
}

// Sign implements the Crypto interface for CryptoClient.
func (c *CryptoClient) Sign(ctx context.Context, msg []byte) (
	sigInfo kbfscrypto.SignatureInfo, err error) {
	c.log.CDebugf(ctx, "Signing %d-byte message", len(msg))
	defer func() {
		c.deferLog.CDebugf(ctx, "Signed %d-byte message with %s: err=%+v", len(msg),
			sigInfo, err)
	}()

	timer := c.logAboutTooLongUnlessCancelled(ctx, "SignED25519")
	defer timer.Stop()
	ed25519SigInfo, err := c.client.SignED25519(ctx, keybase1.SignED25519Arg{
		Msg:    msg,
		Reason: "to use kbfs",
	})
	if err != nil {
		return kbfscrypto.SignatureInfo{}, errors.WithStack(err)
	}

	return kbfscrypto.SignatureInfo{
		Version:      kbfscrypto.SigED25519,
		Signature:    ed25519SigInfo.Sig[:],
		VerifyingKey: kbfscrypto.MakeVerifyingKey(libkb.NaclSigningKeyPublic(ed25519SigInfo.PublicKey).GetKID()),
	}, nil
}

// SignForKBFS implements the Crypto interface for CryptoClient.
func (c *CryptoClient) SignForKBFS(ctx context.Context, msg []byte) (
	sigInfo kbfscrypto.SignatureInfo, err error) {
	c.log.CDebugf(ctx, "Signing %d-byte message", len(msg))
	defer func() {
		c.deferLog.CDebugf(ctx, "Signed %d-byte message with %s: err=%+v", len(msg),
			sigInfo, err)
	}()

	timer := c.logAboutTooLongUnlessCancelled(ctx, "SignED25519ForKBFS")
	defer timer.Stop()
	ed25519SigInfo, err := c.client.SignED25519ForKBFS(ctx, keybase1.SignED25519ForKBFSArg{
		Msg:    msg,
		Reason: "to use kbfs",
	})
	if err != nil {
		return kbfscrypto.SignatureInfo{}, errors.WithStack(err)
	}

	return kbfscrypto.SignatureInfo{
		Version:      kbfscrypto.SigED25519ForKBFS,
		Signature:    ed25519SigInfo.Sig[:],
		VerifyingKey: kbfscrypto.MakeVerifyingKey(libkb.NaclSigningKeyPublic(ed25519SigInfo.PublicKey).GetKID()),
	}, nil
}

// SignToString implements the Crypto interface for CryptoClient.
func (c *CryptoClient) SignToString(ctx context.Context, msg []byte) (
	signature string, err error) {
	c.log.CDebugf(ctx, "Signing %d-byte message to string", len(msg))
	defer func() {
		c.deferLog.CDebugf(ctx, "Signed %d-byte message: err=%+v", len(msg), err)
	}()

	timer := c.logAboutTooLongUnlessCancelled(ctx, "SignToString")
	defer timer.Stop()
	signature, err = c.client.SignToString(ctx, keybase1.SignToStringArg{
		Msg:    msg,
		Reason: "KBFS Authentication",
	})
	if err != nil {
		return "", errors.WithStack(err)
	}
	return signature, nil
}

func (c *CryptoClient) prepareTLFCryptKeyClientHalf(
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	encryptedData keybase1.EncryptedBytes32, nonce keybase1.BoxNonce,
	err error) {
	if encryptedClientHalf.Version != EncryptionSecretbox {
		return keybase1.EncryptedBytes32{}, keybase1.BoxNonce{},
			errors.WithStack(kbfscrypto.UnknownEncryptionVer{
				Ver: encryptedClientHalf.Version})
	}

	if len(encryptedClientHalf.EncryptedData) != len(encryptedData) {
		return keybase1.EncryptedBytes32{}, keybase1.BoxNonce{},
			errors.Errorf("Expected %d bytes, got %d",
				len(encryptedData),
				len(encryptedClientHalf.EncryptedData))
	}
	copy(encryptedData[:], encryptedClientHalf.EncryptedData)

	if len(encryptedClientHalf.Nonce) != len(nonce) {
		return keybase1.EncryptedBytes32{}, keybase1.BoxNonce{},
			errors.WithStack(kbfscrypto.InvalidNonceError{
				Nonce: encryptedClientHalf.Nonce})
	}
	copy(nonce[:], encryptedClientHalf.Nonce)
	return encryptedData, nonce, nil
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoClient.
func (c *CryptoClient) DecryptTLFCryptKeyClientHalf(ctx context.Context,
	publicKey kbfscrypto.TLFEphemeralPublicKey,
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	clientHalf kbfscrypto.TLFCryptKeyClientHalf, err error) {
	c.log.CDebugf(ctx, "Decrypting TLF client key half")
	defer func() {
		c.deferLog.CDebugf(ctx, "Decrypted TLF client key half: %+v",
			err)
	}()
	encryptedData, nonce, err := c.prepareTLFCryptKeyClientHalf(
		encryptedClientHalf)
	if err != nil {
		return kbfscrypto.TLFCryptKeyClientHalf{}, err
	}

	timer := c.logAboutTooLongUnlessCancelled(ctx, "UnboxBytes32")
	defer timer.Stop()
	decryptedClientHalf, err := c.client.UnboxBytes32(ctx, keybase1.UnboxBytes32Arg{
		EncryptedBytes32: encryptedData,
		Nonce:            nonce,
		PeersPublicKey:   keybase1.BoxPublicKey(publicKey.Data()),
		Reason:           "to use kbfs",
	})
	if err != nil {
		return kbfscrypto.TLFCryptKeyClientHalf{}, errors.WithStack(err)
	}

	return kbfscrypto.MakeTLFCryptKeyClientHalf(decryptedClientHalf), nil
}

// DecryptTLFCryptKeyClientHalfAny implements the Crypto interface for
// CryptoClient.
func (c *CryptoClient) DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
	keys []EncryptedTLFCryptKeyClientAndEphemeral, promptPaper bool) (
	clientHalf kbfscrypto.TLFCryptKeyClientHalf, index int, err error) {
	c.log.CDebugf(ctx, "Decrypting TLF client key half with any key")
	defer func() {
		c.deferLog.CDebugf(ctx,
			"Decrypted TLF client key half with any key: %+v",
			err)
	}()
	if len(keys) == 0 {
		return kbfscrypto.TLFCryptKeyClientHalf{}, -1,
			errors.WithStack(NoKeysError{})
	}
	bundles := make([]keybase1.CiphertextBundle, 0, len(keys))
	prepErrs := make([]error, 0, len(keys))
	indexLookup := make([]int, 0, len(keys))
	for i, k := range keys {
		encryptedData, nonce, prepErr :=
			c.prepareTLFCryptKeyClientHalf(k.ClientHalf)
		if err != nil {
			prepErrs = append(prepErrs, prepErr)
		} else {
			bundles = append(bundles, keybase1.CiphertextBundle{
				Kid:        k.PubKey.KID(),
				Ciphertext: encryptedData,
				Nonce:      nonce,
				PublicKey:  keybase1.BoxPublicKey(k.EPubKey.Data()),
			})
			indexLookup = append(indexLookup, i)
		}
	}
	if len(bundles) == 0 {
		return kbfscrypto.TLFCryptKeyClientHalf{}, -1, prepErrs[0]
	}
	timer := c.logAboutTooLongUnlessCancelled(ctx, "UnboxBytes32Any")
	defer timer.Stop()
	res, err := c.client.UnboxBytes32Any(ctx, keybase1.UnboxBytes32AnyArg{
		Bundles:     bundles,
		Reason:      "to rekey for kbfs",
		PromptPaper: promptPaper,
	})
	if err != nil {
		return kbfscrypto.TLFCryptKeyClientHalf{}, -1,
			errors.WithStack(err)
	}
	return kbfscrypto.MakeTLFCryptKeyClientHalf(res.Plaintext),
		indexLookup[res.Index], nil
}

// Shutdown implements the Crypto interface for CryptoClient.
func (c *CryptoClient) Shutdown() {
	if c.shutdownFn != nil {
		c.shutdownFn()
	}
}
