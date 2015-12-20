// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
)

type testEncryptionOptions struct {
	blockSize                          int
	skipFooter                         bool
	corruptEncryptionBlock             func(bl *EncryptionBlock, ebn encryptionBlockNumber)
	corruptPayloadNonce                func(n *Nonce, ebn encryptionBlockNumber) *Nonce
	corruptKeysNonce                   func(n *Nonce, rid int) *Nonce
	corruptReceiverKeysPlaintext       func(rk *receiverKeysPlaintext, rid int)
	corruptReceiverKeysPlaintextPacked func(b []byte, rid int)
	corruptReceiverKeysCiphertext      func(rk *receiverKeysCiphertexts, rid int)
	corruptHeader                      func(eh *EncryptionHeader)
	corruptHeaderPacked                func(b []byte)
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
	sessionKey SymmetricKey
	buffer     bytes.Buffer
	inblock    []byte
	options    testEncryptionOptions
	tagKeys    []BoxPrecomputedSharedKey
	nonce      *Nonce

	numBlocks encryptionBlockNumber // the lower 64 bits of the nonce

	didHeader bool
	eof       bool
	err       error
}

func (pes *testEncryptStream) Write(plaintext []byte) (int, error) {

	if !pes.didHeader {
		pes.didHeader = true
		var b []byte
		b, pes.err = encodeToBytes(pes.header)
		if pes.options.corruptHeaderPacked != nil {
			pes.options.corruptHeaderPacked(b)
		}
		if pes.err == nil {
			_, pes.err = pes.output.Write(b)
		}
	}

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

	nonce := pes.nonce.ForPayloadBox(pes.numBlocks)

	if pes.options.corruptPayloadNonce != nil {
		nonce = pes.options.corruptPayloadNonce(nonce, pes.numBlocks)
	}

	raw := secretbox.Seal([]byte{}, b, (*[24]byte)(nonce), (*[32]byte)(&pes.sessionKey))

	tag := raw[0:secretbox.Overhead]
	ciphertext := raw[secretbox.Overhead:]

	block := EncryptionBlock{
		PayloadCiphertext: ciphertext,
	}

	for _, tagKey := range pes.tagKeys {
		tag, err := tagKey.Box(nonce, tag)
		if err != nil {
			return err
		}
		block.TagCiphertexts = append(block.TagCiphertexts, tag)
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
	senderAnon := false
	if sender == nil {
		sender = ephemeralKey
		senderAnon = true
	}

	eh := &EncryptionHeader{
		FormatName: SaltPackFormatName,
		Version:    SaltPackCurrentVersion,
		Type:       MessageTypeEncryption,
		Sender:     ephemeralKey.GetPublicKey().ToKID(),
		Receivers:  make([]receiverKeysCiphertexts, 0, len(receivers)),
	}
	pes.header = eh
	if err := randomFill(pes.sessionKey[:]); err != nil {
		return err
	}

	pes.nonce = NewNonceForEncryption(ephemeralKey.GetPublicKey())
	nonce := pes.nonce.ForKeyBox()

	for rid, receiver := range receivers {

		rkp := receiverKeysPlaintext{
			Sender:     sender.GetPublicKey().ToKID(),
			SessionKey: pes.sessionKey[:],
		}

		if pes.options.corruptReceiverKeysPlaintext != nil {
			pes.options.corruptReceiverKeysPlaintext(&rkp, rid)
		}

		rkpPacked, err := encodeToBytes(rkp)
		if err != nil {
			return err
		}
		if pes.options.corruptReceiverKeysPlaintextPacked != nil {
			pes.options.corruptReceiverKeysPlaintextPacked(rkpPacked, rid)
		}

		if err != nil {
			return err
		}

		nonceTmp := nonce
		if pes.options.corruptKeysNonce != nil {
			nonceTmp = pes.options.corruptKeysNonce(nonceTmp, rid)
		}

		keys, err := ephemeralKey.Box(receiver, nonceTmp, rkpPacked)
		if err != nil {
			return err
		}

		rkc := receiverKeysCiphertexts{
			ReceiverKID: receiver.ToKID(),
			Keys:        keys,
		}

		if pes.options.corruptReceiverKeysCiphertext != nil {
			pes.options.corruptReceiverKeysCiphertext(&rkc, rid)
		}

		eh.Receivers = append(eh.Receivers, rkc)

		var tagKey BoxPrecomputedSharedKey
		if !senderAnon {
			tagKey = sender.Precompute(receiver)
		} else {
			tagKey = ephemeralKey.Precompute(receiver)
		}

		pes.tagKeys = append(pes.tagKeys, tagKey)
	}

	if pes.options.corruptHeader != nil {
		pes.options.corruptHeader(eh)
	}
	return nil
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
func newTestEncryptStream(ciphertext io.Writer, sender BoxSecretKey, receivers []BoxPublicKey, options testEncryptionOptions) (plaintext io.WriteCloser, err error) {
	pes := &testEncryptStream{
		output:  ciphertext,
		encoder: newEncoder(ciphertext),
		options: options,
		inblock: make([]byte, options.getBlockSize()),
	}
	if err := pes.init(sender, receivers); err != nil {
		return nil, err
	}
	return pes, nil
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
