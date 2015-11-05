// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"encoding/hex"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
)

type publicEncryptStream struct {
	output     io.Writer
	header     *EncryptionHeader
	sessionKey SymmetricKey
	buffer     bytes.Buffer
	inblock    []byte
	macGroups  []SymmetricKey

	numBlocks encryptionBlockNumber // the lower 64 bits of the nonce

	didHeader bool
	eof       bool
	err       error
}

func (pes *publicEncryptStream) Write(plaintext []byte) (int, error) {

	if !pes.didHeader {
		pes.didHeader = true
		pes.err = encodeNewPacket(pes.output, pes.header)
	}

	if pes.err != nil {
		return 0, pes.err
	}

	var ret int
	if ret, pes.err = pes.buffer.Write(plaintext); pes.err != nil {
		return 0, pes.err
	}
	for pes.buffer.Len() >= EncryptionBlockSize {
		pes.err = pes.encryptBlock()
		if pes.err != nil {
			return 0, pes.err
		}
	}
	return ret, nil
}

func (pes *publicEncryptStream) macForAllGroups(b []byte) [][]byte {
	var macs [][]byte
	for _, key := range pes.macGroups {
		mac := hmacSHA512(key[:], b)
		macs = append(macs, mac)
	}
	return macs
}

func (pes *publicEncryptStream) encryptBlock() error {
	var n int
	var err error
	n, err = pes.buffer.Read(pes.inblock[:])
	if err != nil {
		return nil
	}
	return pes.encryptBytes(pes.inblock[0:n])
}

func (pes *publicEncryptStream) encryptBytes(b []byte) error {

	if err := pes.numBlocks.check(); err != nil {
		return err
	}

	nonce := pes.numBlocks.newCounterNonce()
	ciphertext := secretbox.Seal([]byte{}, b, (*[24]byte)(nonce), (*[32]byte)(&pes.sessionKey))
	// Compute the MAC over the nonce and the ciphertext
	sum, err := hashNonceAndAuthTag(nonce, ciphertext)
	if err != nil {
		return err
	}
	macs := pes.macForAllGroups(sum)
	block := EncryptionBlock{
		Version:    PacketVersion1,
		Tag:        PacketTagEncryptionBlock,
		Ciphertext: ciphertext,
		MACs:       macs,
	}

	if err = encodeNewPacket(pes.output, block); err != nil {
		return nil
	}

	pes.numBlocks++
	return nil
}

func (pes *publicEncryptStream) init(sender BoxSecretKey, receivers [][]BoxPublicKey) error {
	eh := &EncryptionHeader{
		Version:   PacketVersion1,
		Tag:       PacketTagEncryptionHeader,
		Sender:    sender.GetPublicKey().ToKID(),
		Receivers: make([]receiverKeysCiphertext, 0, len(receivers)),
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

	// Make sure that each receiver only shows up in the set once.
	receiversAsSet := make(map[string]struct{})

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
		for _, receiver := range group {
			kid := receiver.ToKID()
			kidString := hex.EncodeToString(kid)
			if _, found := receiversAsSet[kidString]; found {
				return ErrRepeatedKey(kid)
			}
			receiversAsSet[kidString] = struct{}{}

			pt := receiverKeysPlaintext{
				GroupID:    gid,
				SessionKey: pes.sessionKey[:],
			}
			if gid >= 0 {
				pt.MACKey = macKey[:]
			}
			pte, err := encodeToBytes(pt)
			if err != nil {
				return err
			}
			nonce.writeCounter32(i)
			i++
			ptec, err := sender.Box(receiver, &nonce, pte)
			if err != nil {
				return err
			}

			rkc := receiverKeysCiphertext{
				KID:  kid,
				Keys: ptec,
			}
			eh.Receivers = append(eh.Receivers, rkc)
		}
	}
	return nil
}

func (pes *publicEncryptStream) Close() error {
	for pes.buffer.Len() > 0 {
		err := pes.encryptBlock()
		if err != nil {
			return err
		}
	}
	return pes.writeFooter()
}

func (pes *publicEncryptStream) writeFooter() error {
	return pes.encryptBytes([]byte{})
}

// NewPublicEncryptStream creates a stream that consumes plaintext data.
// It will write out encrypted data to the io.Writer passed in as ciphertext.
// The encryption is from the specified sender, and is encrypted for the
// given receivers.  Note that receivers as specified as two-dimensional array.
// Each inner group of receivers shares the same pairwise MAC-key, so should
// represent a logic receiver split across multiple devices.  Each group of
// receivers represents a mutually distrustful set of receivers, and will each
// get their own pairwise-MAC keys.
//
// Returns an io.WriteClose that accepts plaintext data to be encrypted; and
// also returns an error if initialization failed.
func NewPublicEncryptStream(ciphertext io.Writer, sender BoxSecretKey, receivers [][]BoxPublicKey) (plaintext io.WriteCloser, err error) {
	pes := &publicEncryptStream{
		output:  ciphertext,
		inblock: make([]byte, EncryptionBlockSize),
	}
	if err := pes.init(sender, receivers); err != nil {
		return nil, err
	}
	return pes, nil
}

// Seal a plaintext from the given sender, for the specified receiver groups.
// Returns a ciphertext, or an error if something bad happened.
func Seal(plaintext []byte, sender BoxSecretKey, receivers [][]BoxPublicKey) (out []byte, err error) {
	var buf bytes.Buffer
	es, err := NewPublicEncryptStream(&buf, sender, receivers)
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
