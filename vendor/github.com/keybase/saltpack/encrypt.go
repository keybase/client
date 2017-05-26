// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"io"

	"golang.org/x/crypto/nacl/secretbox"
)

type encryptStream struct {
	version    Version
	output     io.Writer
	encoder    encoder
	payloadKey SymmetricKey
	buffer     bytes.Buffer
	headerHash headerHash
	macKeys    []macKey

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

	// If es.buffer.Len() == encryptionBlockSize, we don't want to
	// write it out just yet, since for V2 we need to be sure this
	// isn't the last block.
	for es.buffer.Len() > encryptionBlockSize {
		es.err = es.encryptBlock(false)
		if es.err != nil {
			return 0, es.err
		}
	}
	return ret, nil
}

func makeEncryptionBlock(version Version, ciphertext []byte, authenticators []payloadAuthenticator, isFinal bool) interface{} {
	ebV1 := encryptionBlockV1{
		PayloadCiphertext:  ciphertext,
		HashAuthenticators: authenticators,
	}
	switch version {
	case Version1():
		return ebV1
	case Version2():
		return encryptionBlockV2{
			encryptionBlockV1: ebV1,
			IsFinal:           isFinal,
		}
	default:
		panic(ErrBadVersion{version})
	}
}

func checkEncryptBlockRead(version Version, isFinal bool, blockSize, plaintextLen, bufLen int) {
	die := func() {
		panic(fmt.Errorf("invalid encryptBlock read state: version=%s, isFinal=%t, blockSize=%d, plaintextLen=%d, bufLen=%d", version, isFinal, blockSize, plaintextLen, bufLen))
	}

	// We shouldn't read more than a full block's worth.
	if plaintextLen > blockSize {
		die()
	}

	// If we read less than a full block's worth, then we
	// shouldn't have anything left in the buffer.
	if plaintextLen < blockSize && bufLen > 0 {
		die()
	}

	switch version {
	case Version1():
		// isFinal must be equivalent to plaintextLen being 0
		// (which, by the above, implies that bufLen == 0).
		if isFinal != (plaintextLen == 0) {
			die()
		}

	case Version2():
		// If isFinal, then plaintextLen can be any number,
		// buf bufLen must be 0.
		if isFinal && (bufLen != 0) {
			die()
		}

	default:
		panic(ErrBadVersion{version})
	}
}

func (es *encryptStream) encryptBlock(isFinal bool) error {
	// NOTE: plaintext is a slice into es.buffer's buffer, so make
	// sure not to stash it anywhere.
	plaintext := es.buffer.Next(encryptionBlockSize)
	checkEncryptBlockRead(es.version, isFinal, encryptionBlockSize, len(plaintext), es.buffer.Len())

	if err := es.numBlocks.check(); err != nil {
		return err
	}

	nonce := nonceForChunkSecretBox(es.numBlocks)
	ciphertext := secretbox.Seal([]byte{}, plaintext, (*[24]byte)(&nonce), (*[32]byte)(&es.payloadKey))

	assertEncodedChunkState(es.version, ciphertext, secretbox.Overhead, uint64(es.numBlocks), isFinal)

	// Compute the digest to authenticate, and authenticate it for each
	// recipient.
	hashToAuthenticate := computePayloadHash(es.version, es.headerHash, nonce, ciphertext, isFinal)
	var authenticators []payloadAuthenticator
	for _, macKey := range es.macKeys {
		authenticator := computePayloadAuthenticator(macKey, hashToAuthenticate)
		authenticators = append(authenticators, authenticator)
	}

	eBlock := makeEncryptionBlock(es.version, ciphertext, authenticators, isFinal)
	if err := es.encoder.Encode(eBlock); err != nil {
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

func checkKnownVersion(version Version) error {
	for _, knownVersion := range KnownVersions() {
		if version == knownVersion {
			return nil
		}
	}
	return ErrBadVersion{version}
}

func shuffleEncryptReceivers(receivers []BoxPublicKey) []BoxPublicKey {
	order := randomPerm(len(receivers))
	shuffled := make([]BoxPublicKey, len(receivers))
	for i := 0; i < len(receivers); i++ {
		shuffled[i] = receivers[order[i]]
	}
	return shuffled
}

func (es *encryptStream) init(version Version, sender BoxSecretKey, receivers []BoxPublicKey) error {
	if err := checkKnownVersion(version); err != nil {
		return err
	}

	if err := es.checkReceivers(receivers); err != nil {
		return err
	}

	ephemeralKey, err := receivers[0].CreateEphemeralKey()
	if err != nil {
		return err
	}

	// If we have a nil Sender key, then we really want the ephemeral key
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
	if err := randomFill(es.payloadKey[:]); err != nil {
		return err
	}

	nonce := nonceForSenderKeySecretBox()
	eh.SenderSecretbox = secretbox.Seal([]byte{}, sender.GetPublicKey().ToKID(), (*[24]byte)(&nonce), (*[32]byte)(&es.payloadKey))

	for i, receiver := range receivers {
		sharedKey := ephemeralKey.Precompute(receiver)
		nonce := nonceForPayloadKeyBox(version, uint64(i))
		payloadKeyBox := sharedKey.Box(nonce, es.payloadKey[:])

		keys := receiverKeys{PayloadKeyBox: payloadKeyBox}

		// Don't specify the receivers if this public key wants to hide
		if !receiver.HideIdentity() {
			keys.ReceiverKID = receiver.ToKID()
		}

		eh.Receivers = append(eh.Receivers, keys)
	}

	// Encode the header to bytes, hash it, then double encode it.
	headerBytes, err := encodeToBytes(eh)
	if err != nil {
		return err
	}
	es.headerHash = sha512.Sum512(headerBytes)
	err = es.encoder.Encode(headerBytes)
	if err != nil {
		return err
	}

	// Use the header hash to compute the MAC keys.
	//
	// TODO: Plumb the pre-computed shared keys above through to
	// computeMACKeysSender.
	es.macKeys = computeMACKeysSender(version, sender, ephemeralKey, receivers, es.headerHash)

	return nil
}

func computeMACKeySender(version Version, index uint64, secret, eSecret BoxSecretKey, public BoxPublicKey, headerHash headerHash) macKey {
	// Switch on the whole version (i.e., not just the major
	// version) since we're writing.
	switch version {
	case Version1():
		nonce := nonceForMACKeyBoxV1(headerHash)
		return computeMACKeySingle(secret, public, nonce)
	case Version2():
		nonce := nonceForMACKeyBoxV2(headerHash, false, index)
		mac := computeMACKeySingle(secret, public, nonce)
		eNonce := nonceForMACKeyBoxV2(headerHash, true, index)
		eMAC := computeMACKeySingle(eSecret, public, eNonce)
		return sum512Truncate256(append(mac[:], eMAC[:]...))
	default:
		panic(ErrBadVersion{version})
	}
}

func computeMACKeysSender(version Version, sender, ephemeralKey BoxSecretKey, receivers []BoxPublicKey, headerHash headerHash) []macKey {
	var macKeys []macKey
	for i, receiver := range receivers {
		macKey := computeMACKeySender(version, uint64(i), sender, ephemeralKey, receiver, headerHash)
		macKeys = append(macKeys, macKey)
	}
	return macKeys
}

func (es *encryptStream) Close() error {
	switch es.version {
	case Version1():
		if es.buffer.Len() > 0 {
			err := es.encryptBlock(false)
			if err != nil {
				return err
			}
		}

		if es.buffer.Len() > 0 {
			panic(fmt.Sprintf("es.buffer.Len()=%d > 0", es.buffer.Len()))
		}

		return es.encryptBlock(true)

	case Version2():
		err := es.encryptBlock(true)
		if err != nil {
			return err

		}

		if es.buffer.Len() > 0 {
			panic(fmt.Sprintf("es.buffer.Len()=%d > 0", es.buffer.Len()))
		}

		return nil

	default:
		panic(ErrBadVersion{es.version})
	}
}

// NewEncryptStream creates a stream that consumes plaintext data.
// It will write out encrypted data to the io.Writer passed in as ciphertext.
// The encryption is from the specified sender, and is encrypted for the
// given receivers.
//
// Returns an io.WriteClose that accepts plaintext data to be encrypted; and
// also returns an error if initialization failed.
func NewEncryptStream(version Version, ciphertext io.Writer, sender BoxSecretKey, receivers []BoxPublicKey) (io.WriteCloser, error) {
	es := &encryptStream{
		version: version,
		output:  ciphertext,
		encoder: newEncoder(ciphertext),
	}
	err := es.init(version, sender, shuffleEncryptReceivers(receivers))
	return es, err
}

// Seal a plaintext from the given sender, for the specified receiver groups.
// Returns a ciphertext, or an error if something bad happened.
func Seal(version Version, plaintext []byte, sender BoxSecretKey, receivers []BoxPublicKey) (out []byte, err error) {
	var buf bytes.Buffer
	es, err := NewEncryptStream(version, &buf, sender, receivers)
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
