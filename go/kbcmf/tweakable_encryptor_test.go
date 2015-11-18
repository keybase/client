// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"encoding/hex"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
)

type testEncryptionOptions struct {
	blockSize                          int
	skipFooter                         bool
	corruptEncryptionBlock             func(bl *EncryptionBlock, ebn encryptionBlockNumber)
	corruptNonce                       func(n *Nonce, ebn encryptionBlockNumber)
	corruptMacKey                      func(k *SymmetricKey, i int)
	corruptReceiverKeysPlaintext       func(rk *receiverKeysPlaintext, gid int, rid int)
	corruptReceiverKeysPlaintextPacked func(b []byte, gid int, rid int)
	corruptReceiverKeysCiphertext      func(rk *receiverKeysCiphertexts, gid int, rid int)
	corruptHeaderNonce                 func(n *Nonce, gid int, rid int, slot int)
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
	header     *EncryptionHeader
	sessionKey SymmetricKey
	buffer     bytes.Buffer
	inblock    []byte
	macGroups  []SymmetricKey
	options    testEncryptionOptions

	numBlocks encryptionBlockNumber // the lower 64 bits of the nonce

	didHeader bool
	eof       bool
	err       error
}

func (pes *testEncryptStream) Write(plaintext []byte) (int, error) {

	if !pes.didHeader {
		pes.didHeader = true
		var buf bytes.Buffer
		pes.err = encodeNewPacket(&buf, pes.header)
		b := buf.Bytes()
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

func (pes *testEncryptStream) macForAllGroups(b []byte) [][]byte {
	var macs [][]byte
	for _, key := range pes.macGroups {
		mac := hmacSHA512(key[:], b)
		macs = append(macs, mac)
	}
	return macs
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

	nonce := pes.numBlocks.newCounterNonce()

	if pes.options.corruptNonce != nil {
		pes.options.corruptNonce(nonce, pes.numBlocks)
	}

	ciphertext := secretbox.Seal([]byte{}, b, (*[24]byte)(nonce), (*[32]byte)(&pes.sessionKey))
	// Compute the MAC over the nonce and the ciphertext
	sum := hashNonceAndAuthTag(nonce, ciphertext)
	macs := pes.macForAllGroups(sum)
	block := EncryptionBlock{
		Version:    PacketVersion1,
		Tag:        PacketTagEncryptionBlock,
		Ciphertext: ciphertext,
		MACs:       macs,
	}

	if pes.options.corruptEncryptionBlock != nil {
		pes.options.corruptEncryptionBlock(&block, pes.numBlocks)
	}

	if err := encodeNewPacket(pes.output, block); err != nil {
		return nil
	}

	pes.numBlocks++
	return nil
}

func (pes *testEncryptStream) init(sender BoxSecretKey, receivers [][]BoxPublicKey) error {

	ephemeralKey, err := receivers[0][0].CreateEphemeralKey()
	if err != nil {
		return err
	}

	// If we have a NULL Sender key, then we really want an ephemeral key
	// as the main encryption key.
	if sender == nil {
		sender = ephemeralKey
	}

	eh := &EncryptionHeader{
		Version:   PacketVersion1,
		Tag:       PacketTagEncryptionHeader,
		Sender:    ephemeralKey.GetPublicKey().ToKID(),
		Receivers: make([]receiverKeysCiphertexts, 0, len(receivers)),
	}
	pes.header = eh
	if err := randomFill(pes.sessionKey[:]); err != nil {
		return err
	}

	// Only fill the first 20 bytes of the nonce. The remaining 4
	// we'll increment with every call to Box
	nonceRandLen := 20
	var nonce Nonce
	if err := randomFill(nonce[:nonceRandLen]); err != nil {
		return err
	}

	// We don't necessarily have to copy our header nonce into place,
	// but if feels safer, since we modify the nonce below
	eh.Nonce = make([]byte, nonceRandLen)
	copy(eh.Nonce, nonce[:])

	d := make(map[string]struct{})

	var i uint32

	for gid, group := range receivers {
		var macKey SymmetricKey
		if len(receivers) > 1 {
			if err := randomFill(macKey[:]); err != nil {
				return err
			}
			pes.macGroups = append(pes.macGroups, macKey)
		} else {
			gid = -1
		}

		if pes.options.corruptMacKey != nil {
			pes.options.corruptMacKey(&macKey, gid)
		}

		for rid, receiver := range group {
			kid := receiver.ToKID()
			kidString := hex.EncodeToString(kid)
			if _, found := d[kidString]; found {
				return ErrRepeatedKey(kid)
			}
			d[kidString] = struct{}{}

			pt := receiverKeysPlaintext{
				GroupID:    gid,
				SessionKey: pes.sessionKey[:],
			}
			if gid >= 0 {
				pt.MACKey = macKey[:]
			}

			if pes.options.corruptReceiverKeysPlaintext != nil {
				pes.options.corruptReceiverKeysPlaintext(&pt, gid, rid)
			}

			pte, err := encodeToBytes(pt)
			if pes.options.corruptReceiverKeysPlaintextPacked != nil {
				pes.options.corruptReceiverKeysPlaintextPacked(pte, gid, rid)
			}
			if err != nil {
				return err
			}
			nonce.writeCounter32(i)
			i++

			if pes.options.corruptHeaderNonce != nil {
				pes.options.corruptHeaderNonce(&nonce, gid, rid, 0)
			}

			ske, err := ephemeralKey.Box(receiver, &nonce, sender.GetPublicKey().ToKID())
			if err != nil {
				return err
			}

			if pes.options.corruptHeaderNonce != nil {
				pes.options.corruptHeaderNonce(&nonce, gid, rid, 1)
			}

			nonce.writeCounter32(i)
			i++

			ptec, err := sender.Box(receiver, &nonce, pte)
			if err != nil {
				return err
			}

			rkc := receiverKeysCiphertexts{
				KID:    kid,
				Keys:   ptec,
				Sender: ske,
			}

			if pes.options.corruptReceiverKeysCiphertext != nil {
				pes.options.corruptReceiverKeysCiphertext(&rkc, gid, rid)
			}

			eh.Receivers = append(eh.Receivers, rkc)
		}
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
func newTestEncryptStream(ciphertext io.Writer, sender BoxSecretKey, receivers [][]BoxPublicKey, options testEncryptionOptions) (plaintext io.WriteCloser, err error) {
	pes := &testEncryptStream{
		output:  ciphertext,
		options: options,
		inblock: make([]byte, options.getBlockSize()),
	}
	if err := pes.init(sender, receivers); err != nil {
		return nil, err
	}
	return pes, nil
}

func testSeal(plaintext []byte, sender BoxSecretKey, receivers [][]BoxPublicKey, options testEncryptionOptions) (out []byte, err error) {
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
