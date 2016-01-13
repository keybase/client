// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/sha512"
	"encoding/hex"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
)

type encryptStream struct {
	output     io.Writer
	encoder    encoder
	header     *EncryptionHeader
	payloadKey SymmetricKey
	buffer     bytes.Buffer
	inblock    []byte
	tagKeys    []BoxPrecomputedSharedKey

	numBlocks encryptionBlockNumber // the lower 64 bits of the nonce

	didHeader bool
	eof       bool
	err       error
}

func (es *encryptStream) Write(plaintext []byte) (int, error) {

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

	nonce := nonceForChunkSecretBox(es.numBlocks)
	ciphertext := secretbox.Seal([]byte{}, b, (*[24]byte)(nonce), (*[32]byte)(&es.payloadKey))
	hash := sha512.Sum512(ciphertext)

	block := EncryptionBlock{
		PayloadCiphertext: ciphertext,
	}

	for _, tagKey := range es.tagKeys {
		hashBox := tagKey.Box(nonce, hash[:])
		authenticator := hashBox[:secretbox.Overhead]
		block.HashAuthenticators = append(block.HashAuthenticators, authenticator)
	}

	if err := es.encoder.Encode(block); err != nil {
		return err
	}

	es.numBlocks++
	return nil
}

// Do some sanity checking on the receivers. Check that receivers
// aren't sent to twice; check that there's at least one receiver.
func (es *encryptStream) checkReceivers(v []BoxPublicKey) error {

	if len(v) == 0 {
		return ErrBadReceivers
	}

	tot := uint64(0)

	// Make sure that each receiver only shows up in the set once.
	receiversAsSet := make(map[string]struct{})

	for _, receiver := range v {
		// Make sure this key hasn't been used before
		kid := receiver.ToKID()
		kidString := hex.EncodeToString(kid)
		if _, found := receiversAsSet[kidString]; found {
			return ErrRepeatedKey(kid)
		}
		receiversAsSet[kidString] = struct{}{}
		tot++
	}

	// Don't allow more than 2^31 receivers.
	if tot >= 0x7fffffff {
		return ErrBadReceivers
	}

	return nil
}

func (es *encryptStream) init(sender BoxSecretKey, receivers []BoxPublicKey) error {

	if err := es.checkReceivers(receivers); err != nil {
		return err
	}

	ephemeralKey, err := receivers[0].CreateEphemeralKey()
	if err != nil {
		return err
	}

	// If we have a nil Sender key, then we really want the ephemeral key
	// as the main encryption key.
	senderAnon := false
	if sender == nil {
		sender = ephemeralKey
		senderAnon = true
	}

	eh := &EncryptionHeader{
		FormatName: SaltpackFormatName,
		Version:    SaltpackCurrentVersion,
		Type:       MessageTypeEncryption,
		Ephemeral:  ephemeralKey.GetPublicKey().ToKID(),
		Receivers:  make([]receiverKeys, 0, len(receivers)),
	}
	es.header = eh
	if err := randomFill(es.payloadKey[:]); err != nil {
		return err
	}

	eh.SenderSecretbox = secretbox.Seal([]byte{}, sender.GetPublicKey().ToKID(), (*[24]byte)(nonceForSenderKeySecretBox()), (*[32]byte)(&es.payloadKey))

	for _, receiver := range receivers {

		ephemeralShared := ephemeralKey.Precompute(receiver)

		payloadKeyBox := ephemeralShared.Box(nonceForPayloadKeyBox(), es.payloadKey[:])
		if err != nil {
			return err
		}

		keys := receiverKeys{PayloadKeyBox: payloadKeyBox}

		// Don't specify the receivers if this public key wants to hide
		if !receiver.HideIdentity() {
			keys.ReceiverKID = receiver.ToKID()
		}

		eh.Receivers = append(eh.Receivers, keys)

		tagKey := ephemeralShared
		if !senderAnon {
			tagKey = sender.Precompute(receiver)
		}
		es.tagKeys = append(es.tagKeys, tagKey)
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
// given receivers.
//
// Returns an io.WriteClose that accepts plaintext data to be encrypted; and
// also returns an error if initialization failed.
func NewEncryptStream(ciphertext io.Writer, sender BoxSecretKey, receivers []BoxPublicKey) (plaintext io.WriteCloser, err error) {
	es := &encryptStream{
		output:  ciphertext,
		encoder: newEncoder(ciphertext),
		inblock: make([]byte, EncryptionBlockSize),
	}
	if err := es.init(sender, receivers); err != nil {
		return nil, err
	}
	// Encode the header and the header length, and write them out immediately.
	headerBytes, err := encodeToBytes(es.header)
	if err != nil {
		return nil, err
	}
	headerLen, err := encodeToBytes(len(headerBytes))
	if err != nil {
		return nil, err
	}
	_, err = es.output.Write(headerLen)
	if err != nil {
		return nil, err
	}
	_, err = es.output.Write(headerBytes)
	return es, err
}

// Seal a plaintext from the given sender, for the specified receiver groups.
// Returns a ciphertext, or an error if something bad happened.
func Seal(plaintext []byte, sender BoxSecretKey, receivers []BoxPublicKey) (out []byte, err error) {
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
