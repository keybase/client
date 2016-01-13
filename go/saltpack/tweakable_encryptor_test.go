// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
)

type testEncryptionOptions struct {
	blockSize                   int
	skipFooter                  bool
	corruptEncryptionBlock      func(bl *EncryptionBlock, ebn encryptionBlockNumber)
	corruptCiphertextBeforeHash func(c []byte, ebn encryptionBlockNumber)
	corruptPayloadNonce         func(n *Nonce, ebn encryptionBlockNumber) *Nonce
	corruptKeysNonce            func(n *Nonce, rid int) *Nonce
	corruptPayloadKey           func(pk *[]byte, rid int)
	corruptReceiverKeys         func(rk *receiverKeys, rid int)
	corruptSenderKeyPlaintext   func(pk *[]byte)
	corruptSenderKeyCiphertext  func(pk []byte)
	corruptHeader               func(eh *EncryptionHeader)
	corruptHeaderPacked         func(b []byte)
}

func (eo testEncryptionOptions) getBlockSize() int {
	if eo.blockSize == 0 {
		return EncryptionBlockSize
	}
	return eo.blockSize
}

type testEncryptStream struct {
	output     io.Writer
	encoder    encoder
	header     *EncryptionHeader
	payloadKey SymmetricKey
	buffer     bytes.Buffer
	inblock    []byte
	options    testEncryptionOptions
	headerHash []byte
	macKeys    [][]byte

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
	for pes.buffer.Len() >= pes.options.getBlockSize() {
		pes.err = pes.encryptBlock()
		if pes.err != nil {
			return 0, pes.err
		}
	}
	return ret, nil
}

func (pes *testEncryptStream) encryptBlock() error {
	var n int
	var err error
	n, err = pes.buffer.Read(pes.inblock[:])
	if err != nil {
		return nil
	}
	return pes.encryptBytes(pes.inblock[0:n])
}

func (pes *testEncryptStream) encryptBytes(b []byte) error {

	if err := pes.numBlocks.check(); err != nil {
		return err
	}

	nonce := nonceForChunkSecretBox(pes.numBlocks)

	if pes.options.corruptPayloadNonce != nil {
		nonce = pes.options.corruptPayloadNonce(nonce, pes.numBlocks)
	}

	ciphertext := secretbox.Seal([]byte{}, b, (*[24]byte)(nonce), (*[32]byte)(&pes.payloadKey))

	if pes.options.corruptCiphertextBeforeHash != nil {
		pes.options.corruptCiphertextBeforeHash(ciphertext, pes.numBlocks)
	}

	block := EncryptionBlock{
		PayloadCiphertext: ciphertext,
	}

	// Compute the digest to authenticate, and authenticate it for each
	// recipient.
	ciphertextDigest := sha512.New()
	ciphertextDigest.Write(pes.headerHash)
	ciphertextDigest.Write(nonce[:])
	ciphertextDigest.Write(ciphertext)
	hashToAuthenticate := ciphertextDigest.Sum(nil)
	for _, macKey := range pes.macKeys {
		authenticatorDigest := hmac.New(sha512.New, macKey)
		authenticatorDigest.Write(hashToAuthenticate)
		fullMAC := authenticatorDigest.Sum(nil)
		truncatedMAC := fullMAC[:32]
		block.HashAuthenticators = append(block.HashAuthenticators, truncatedMAC)
	}

	if pes.options.corruptEncryptionBlock != nil {
		pes.options.corruptEncryptionBlock(&block, pes.numBlocks)
	}

	if err := pes.encoder.Encode(block); err != nil {
		return err
	}

	pes.numBlocks++
	return nil
}

func (pes *testEncryptStream) init(sender BoxSecretKey, receivers []BoxPublicKey) error {

	ephemeralKey, err := receivers[0].CreateEphemeralKey()
	if err != nil {
		return err
	}

	// If we have a NULL Sender key, then we really want an ephemeral key
	// as the main encryption key.
	if sender == nil {
		sender = ephemeralKey
	}

	eh := &EncryptionHeader{
		FormatName: SaltpackFormatName,
		Version:    SaltpackCurrentVersion,
		Type:       MessageTypeEncryption,
		Ephemeral:  ephemeralKey.GetPublicKey().ToKID(),
		Receivers:  make([]receiverKeys, 0, len(receivers)),
	}
	pes.header = eh
	if err := randomFill(pes.payloadKey[:]); err != nil {
		return err
	}

	var senderPlaintext [32]byte
	copy(senderPlaintext[:], sender.GetPublicKey().ToKID())
	senderPlaintextSlice := senderPlaintext[:]
	if pes.options.corruptSenderKeyPlaintext != nil {
		pes.options.corruptSenderKeyPlaintext(&senderPlaintextSlice)
	}
	eh.SenderSecretbox = secretbox.Seal([]byte{}, senderPlaintextSlice, (*[24]byte)(nonceForSenderKeySecretBox()), (*[32]byte)(&pes.payloadKey))
	if pes.options.corruptSenderKeyCiphertext != nil {
		pes.options.corruptSenderKeyCiphertext(eh.SenderSecretbox)
	}

	for rid, receiver := range receivers {

		payloadKeySlice := pes.payloadKey[:]
		if pes.options.corruptPayloadKey != nil {
			pes.options.corruptPayloadKey(&payloadKeySlice, rid)
		}

		nonceTmp := nonceForPayloadKeyBox()
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
		pes.options.corruptHeader(eh)
	}

	// Encode the header and the header length, and write them out immediately.
	headerBytes, err := encodeToBytes(pes.header)
	if err != nil {
		return err
	}
	headerLen, err := encodeToBytes(len(headerBytes))
	if err != nil {
		return err
	}
	if pes.options.corruptHeaderPacked != nil {
		pes.options.corruptHeaderPacked(headerBytes)
	}
	headerHash := sha512.Sum512(headerBytes)
	pes.headerHash = headerHash[:]
	_, err = pes.output.Write(headerLen)
	if err != nil {
		return err
	}
	_, err = pes.output.Write(headerBytes)

	// Use the header hash to compute the MAC keys.
	pes.computeMACKeys(sender, receivers)

	return nil
}

func (pes *testEncryptStream) computeMACKeys(sender BoxSecretKey, receivers []BoxPublicKey) {
	for _, receiver := range receivers {
		macKeyBox := sender.Box(receiver, nonceForMACKeyBox(pes.headerHash[:]), make([]byte, 32))
		pes.macKeys = append(pes.macKeys, macKeyBox[16:48])
	}
}

func (pes *testEncryptStream) Close() error {
	for pes.buffer.Len() > 0 {
		err := pes.encryptBlock()
		if err != nil {
			return err
		}
	}
	return pes.writeFooter()
}

func (pes *testEncryptStream) writeFooter() error {
	var err error
	if !pes.options.skipFooter {
		err = pes.encryptBytes([]byte{})
	}
	return err
}

// Options are available mainly for testing.  Can't think of a good reason for
// end-users to have to specify options.
func newTestEncryptStream(ciphertext io.Writer, sender BoxSecretKey, receivers []BoxPublicKey, options testEncryptionOptions) (io.WriteCloser, error) {
	pes := &testEncryptStream{
		output:  ciphertext,
		encoder: newEncoder(ciphertext),
		options: options,
		inblock: make([]byte, options.getBlockSize()),
	}
	err := pes.init(sender, receivers)
	return pes, err
}

func testSeal(plaintext []byte, sender BoxSecretKey, receivers []BoxPublicKey, options testEncryptionOptions) (out []byte, err error) {
	var buf bytes.Buffer
	es, err := newTestEncryptStream(&buf, sender, receivers, options)
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
