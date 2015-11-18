// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"encoding/hex"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
)

type encryptStream struct {
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

func (es *encryptStream) Write(plaintext []byte) (int, error) {

	if !es.didHeader {
		es.didHeader = true
		es.err = encodeNewPacket(es.output, es.header)
	}

	if es.err != nil {
		return 0, es.err
	}

	var ret int
	if ret, es.err = es.buffer.Write(plaintext); es.err != nil {
		return 0, es.err
	}
	for es.buffer.Len() >= EncryptionBlockSize {
		es.err = es.encryptBlock()
		if es.err != nil {
			return 0, es.err
		}
	}
	return ret, nil
}

func (es *encryptStream) macForAllGroups(b []byte) [][]byte {
	var macs [][]byte
	for _, key := range es.macGroups {
		mac := hmacSHA512(key[:], b)
		macs = append(macs, mac)
	}
	return macs
}

func (es *encryptStream) encryptBlock() error {
	var n int
	var err error
	n, err = es.buffer.Read(es.inblock[:])
	if err != nil {
		return nil
	}
	return es.encryptBytes(es.inblock[0:n])
}

func (es *encryptStream) encryptBytes(b []byte) error {

	if err := es.numBlocks.check(); err != nil {
		return err
	}

	nonce := es.numBlocks.newCounterNonce()
	ciphertext := secretbox.Seal([]byte{}, b, (*[24]byte)(nonce), (*[32]byte)(&es.sessionKey))
	// Compute the MAC over the nonce and the ciphertext
	sum := hashNonceAndAuthTag(nonce, ciphertext)
	macs := es.macForAllGroups(sum)
	block := EncryptionBlock{
		Version:    PacketVersion1,
		Tag:        PacketTagEncryptionBlock,
		Ciphertext: ciphertext,
		MACs:       macs,
	}

	if err := encodeNewPacket(es.output, block); err != nil {
		return nil
	}

	es.numBlocks++
	return nil
}

// Do some sanity checking on the receiver group. Check that receivers
// aren't sent to twice; check that there aren't any empty receiver
// groups. In particular, we need r[0][0] to be a valid PublicKey.
func (es *encryptStream) checkReceivers(r [][]BoxPublicKey) error {

	if len(r) == 0 {
		return ErrBadReceivers
	}

	// Make sure that each receiver only shows up in the set once.
	receiversAsSet := make(map[string]struct{})

	for _, g := range r {

		if len(g) == 0 {
			return ErrBadReceivers
		}

		for _, receiver := range g {

			// Make sure this key hasn't been used before
			kid := receiver.ToKID()
			kidString := hex.EncodeToString(kid)
			if _, found := receiversAsSet[kidString]; found {
				return ErrRepeatedKey(kid)
			}
			receiversAsSet[kidString] = struct{}{}
		}
	}
	return nil
}

func (es *encryptStream) init(sender BoxSecretKey, receivers [][]BoxPublicKey) error {

	if err := es.checkReceivers(receivers); err != nil {
		return err
	}

	ephemeralKey, err := receivers[0][0].CreateEphemeralKey()
	if err != nil {
		return err
	}

	// If we have a nil Sender key, then we really want the ephemeral key
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
	es.header = eh
	if err := randomFill(es.sessionKey[:]); err != nil {
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

	var i uint32

	for gid, group := range receivers {
		var macKey SymmetricKey
		if len(receivers) > 1 {
			if err := randomFill(macKey[:]); err != nil {
				return err
			}
			es.macGroups = append(es.macGroups, macKey)
		} else {
			gid = -1
		}
		for _, receiver := range group {

			// Next encode the ultimate sender key for the receiver,
			// using the ephemeral key.
			nonce.writeCounter32(i)
			i++
			ske, err := ephemeralKey.Box(receiver, &nonce, sender.GetPublicKey().ToKID())
			if err != nil {
				return err
			}

			pt := receiverKeysPlaintext{
				GroupID:    gid,
				SessionKey: es.sessionKey[:],
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

			rkc := receiverKeysCiphertexts{
				KID:    receiver.ToKID(),
				Keys:   ptec,
				Sender: ske,
			}
			eh.Receivers = append(eh.Receivers, rkc)
		}
	}
	return nil
}

func (es *encryptStream) Close() error {
	for es.buffer.Len() > 0 {
		err := es.encryptBlock()
		if err != nil {
			return err
		}
	}
	return es.writeFooter()
}

func (es *encryptStream) writeFooter() error {
	return es.encryptBytes([]byte{})
}

// NewEncryptStream creates a stream that consumes plaintext data.
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
func NewEncryptStream(ciphertext io.Writer, sender BoxSecretKey, receivers [][]BoxPublicKey) (plaintext io.WriteCloser, err error) {
	es := &encryptStream{
		output:  ciphertext,
		inblock: make([]byte, EncryptionBlockSize),
	}
	if err := es.init(sender, receivers); err != nil {
		return nil, err
	}
	return es, nil
}

// Seal a plaintext from the given sender, for the specified receiver groups.
// Returns a ciphertext, or an error if something bad happened.
func Seal(plaintext []byte, sender BoxSecretKey, receivers [][]BoxPublicKey) (out []byte, err error) {
	var buf bytes.Buffer
	es, err := NewEncryptStream(&buf, sender, receivers)
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
