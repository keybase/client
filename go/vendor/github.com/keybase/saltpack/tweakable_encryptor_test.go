// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/sha512"
	"fmt"
	"io"

	"golang.org/x/crypto/nacl/secretbox"
)

type testEncryptionOptions struct {
	blockSize                   int
	skipFooter                  bool
	corruptEncryptionBlock      func(bl *interface{}, ebn encryptionBlockNumber)
	corruptCiphertextBeforeHash func(c []byte, ebn encryptionBlockNumber)
	corruptPayloadNonce         func(n Nonce, ebn encryptionBlockNumber) Nonce
	corruptKeysNonce            func(n Nonce, rid int) Nonce
	corruptPayloadKey           func(pk *[]byte, rid int)
	corruptReceiverKeys         func(rk *receiverKeys, rid int)
	corruptSenderKeyPlaintext   func(pk *[]byte)
	corruptSenderKeyCiphertext  func(pk []byte)
	corruptHeader               func(eh *EncryptionHeader)
	corruptHeaderPacked         func(b []byte)
}

func (eo testEncryptionOptions) getBlockSize() int {
	if eo.blockSize == 0 {
		return encryptionBlockSize
	}
	return eo.blockSize
}

type testEncryptStream struct {
	version    Version
	output     io.Writer
	encoder    encoder
	payloadKey SymmetricKey
	buffer     bytes.Buffer
	options    testEncryptionOptions
	headerHash headerHash
	macKeys    []macKey

	numBlocks encryptionBlockNumber // the lower 64 bits of the nonce

	didHeader bool
	eof       bool
	err       error
}

func (pes *testEncryptStream) Write(plaintext []byte) (int, error) {

	if pes.err != nil {
		return 0, pes.err
	}

	var ret int
	if ret, pes.err = pes.buffer.Write(plaintext); pes.err != nil {
		return 0, pes.err
	}

	// If es.buffer.Len() == encryptionBlockSize, we don't want to
	// write it out just yet, since for V2 we need to be sure this
	// isn't the last block.
	for pes.buffer.Len() > pes.options.getBlockSize() {
		pes.err = pes.encryptBlock(false)
		if pes.err != nil {
			return 0, pes.err
		}
	}
	return ret, nil
}

func (pes *testEncryptStream) encryptBlock(isFinal bool) error {
	plaintext := pes.buffer.Next(pes.options.getBlockSize())
	checkEncryptBlockRead(pes.version, isFinal, pes.options.getBlockSize(), len(plaintext), pes.buffer.Len())

	if err := pes.numBlocks.check(); err != nil {
		return err
	}

	nonce := nonceForChunkSecretBox(pes.numBlocks)

	if pes.options.corruptPayloadNonce != nil {
		nonce = pes.options.corruptPayloadNonce(nonce, pes.numBlocks)
	}

	ciphertext := secretbox.Seal([]byte{}, plaintext, (*[24]byte)(&nonce), (*[32]byte)(&pes.payloadKey))

	assertEncodedChunkState(pes.version, ciphertext, secretbox.Overhead, uint64(pes.numBlocks), isFinal)

	if pes.options.corruptCiphertextBeforeHash != nil {
		pes.options.corruptCiphertextBeforeHash(ciphertext, pes.numBlocks)
	}

	// Compute the digest to authenticate, and authenticate it for each
	// recipient.
	hashToAuthenticate := computePayloadHash(pes.version, pes.headerHash, nonce, ciphertext, isFinal)
	var authenticators []payloadAuthenticator
	for _, macKey := range pes.macKeys {
		authenticator := computePayloadAuthenticator(macKey, hashToAuthenticate)
		authenticators = append(authenticators, authenticator)
	}

	eBlock := makeEncryptionBlock(pes.version, ciphertext, authenticators, isFinal)

	if pes.options.corruptEncryptionBlock != nil {
		pes.options.corruptEncryptionBlock(&eBlock, pes.numBlocks)
	}

	if err := pes.encoder.Encode(eBlock); err != nil {
		return err
	}

	pes.numBlocks++
	return nil
}

func (pes *testEncryptStream) init(version Version, sender BoxSecretKey, receivers []BoxPublicKey) error {

	ephemeralKey, err := receivers[0].CreateEphemeralKey()
	if err != nil {
		return err
	}

	// If we have a NULL Sender key, then we really want an ephemeral key
	// as the main encryption key.
	if sender == nil {
		sender = ephemeralKey
	}

	eh := EncryptionHeader{
		FormatName: FormatName,
		Version:    version,
		Type:       MessageTypeEncryption,
		Ephemeral:  ephemeralKey.GetPublicKey().ToKID(),
		Receivers:  make([]receiverKeys, 0, len(receivers)),
	}
	if err := randomFill(pes.payloadKey[:]); err != nil {
		return err
	}

	senderPlaintext := sliceToByte32(sender.GetPublicKey().ToKID())
	senderPlaintextSlice := senderPlaintext[:]
	if pes.options.corruptSenderKeyPlaintext != nil {
		pes.options.corruptSenderKeyPlaintext(&senderPlaintextSlice)
	}
	nonce := nonceForSenderKeySecretBox()
	eh.SenderSecretbox = secretbox.Seal([]byte{}, senderPlaintextSlice, (*[24]byte)(&nonce), (*[32]byte)(&pes.payloadKey))
	if pes.options.corruptSenderKeyCiphertext != nil {
		pes.options.corruptSenderKeyCiphertext(eh.SenderSecretbox)
	}

	for rid, receiver := range receivers {

		payloadKeySlice := pes.payloadKey[:]
		if pes.options.corruptPayloadKey != nil {
			pes.options.corruptPayloadKey(&payloadKeySlice, rid)
		}

		nonceTmp := nonceForPayloadKeyBox(version, uint64(rid))
		if pes.options.corruptKeysNonce != nil {
			nonceTmp = pes.options.corruptKeysNonce(nonceTmp, rid)
		}

		payloadKeyBox := ephemeralKey.Box(receiver, nonceTmp, payloadKeySlice)
		if err != nil {
			return err
		}

		keys := receiverKeys{
			PayloadKeyBox: payloadKeyBox,
		}

		// Don't specify the receivers if this public key wants to hide
		if !receiver.HideIdentity() {
			keys.ReceiverKID = receiver.ToKID()
		}

		if pes.options.corruptReceiverKeys != nil {
			pes.options.corruptReceiverKeys(&keys, rid)
		}

		eh.Receivers = append(eh.Receivers, keys)
	}

	if pes.options.corruptHeader != nil {
		pes.options.corruptHeader(&eh)
	}

	// Encode the header and the header length, and write them out immediately.
	headerBytes, err := encodeToBytes(eh)
	if err != nil {
		return err
	}
	if pes.options.corruptHeaderPacked != nil {
		pes.options.corruptHeaderPacked(headerBytes)
	}
	pes.headerHash = sha512.Sum512(headerBytes)
	err = pes.encoder.Encode(headerBytes)
	if err != nil {
		return err
	}

	// Use the header hash to compute the MAC keys.
	//
	// TODO: Plumb the pre-computed shared keys above through to
	// computeMACKeysSender.
	pes.macKeys = computeMACKeysSender(version, sender, ephemeralKey, receivers, pes.headerHash)

	return nil
}

func (pes *testEncryptStream) Close() error {
	switch pes.version {
	case Version1():
		if pes.buffer.Len() > 0 {
			err := pes.encryptBlock(false)
			if err != nil {
				return err
			}
		}

		if pes.buffer.Len() > 0 {
			panic(fmt.Sprintf("es.buffer.Len()=%d > 0", pes.buffer.Len()))
		}

		if pes.options.skipFooter {
			return nil
		}

		return pes.encryptBlock(true)

	case Version2():
		isFinal := true

		if pes.options.skipFooter {
			isFinal = false
		}

		err := pes.encryptBlock(isFinal)
		if err != nil {
			return err
		}

		if pes.buffer.Len() > 0 {
			panic(fmt.Sprintf("pes.buffer.Len()=%d > 0", pes.buffer.Len()))
		}

		return nil

	default:
		panic(ErrBadVersion{pes.version})
	}
}

// Options are available mainly for testing.  Can't think of a good reason for
// end-users to have to specify options.
func newTestEncryptStream(version Version, ciphertext io.Writer, sender BoxSecretKey, receivers []BoxPublicKey, options testEncryptionOptions) (io.WriteCloser, error) {
	pes := &testEncryptStream{
		version: version,
		output:  ciphertext,
		encoder: newEncoder(ciphertext),
		options: options,
	}
	err := pes.init(version, sender, receivers)
	return pes, err
}

func testSeal(version Version, plaintext []byte, sender BoxSecretKey, receivers []BoxPublicKey, options testEncryptionOptions) (out []byte, err error) {
	var buf bytes.Buffer
	es, err := newTestEncryptStream(version, &buf, sender, receivers, options)
	if err != nil {
		return nil, err
	}
	if _, err := es.Write(plaintext); err != nil {
		return nil, err
	}
	if err := es.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
