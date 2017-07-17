// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"fmt"
	"io"

	"golang.org/x/crypto/ed25519"
	"golang.org/x/crypto/nacl/secretbox"
)

type signcryptSealStream struct {
	version         Version
	output          io.Writer
	encoder         encoder
	encryptionKey   SymmetricKey
	signingKey      SigningSecretKey
	senderAnonymous bool
	keyring         Keyring
	buffer          bytes.Buffer
	headerHash      headerHash

	numBlocks encryptionBlockNumber // the lower 64 bits of the nonce

	didHeader bool
	eof       bool
	err       error
}

func (sss *signcryptSealStream) Write(plaintext []byte) (int, error) {

	if sss.err != nil {
		return 0, sss.err
	}

	var ret int
	if ret, sss.err = sss.buffer.Write(plaintext); sss.err != nil {
		return 0, sss.err
	}
	for sss.buffer.Len() > encryptionBlockSize {
		sss.err = sss.signcryptBlock(false)
		if sss.err != nil {
			return 0, sss.err
		}
	}
	return ret, nil
}

func (sss *signcryptSealStream) signcryptBlock(isFinal bool) error {
	// NOTE: plaintext is a slice into sss.buffer's buffer, so
	// make sure not to stash it anywhere.
	plaintext := sss.buffer.Next(encryptionBlockSize)
	if isFinal && (sss.buffer.Len() != 0) {
		panic(fmt.Sprintf("isFinal=true and (sss.buffer.Len()=%d != 0)", sss.buffer.Len()))
	}

	if err := sss.numBlocks.check(); err != nil {
		return err
	}

	nonce := nonceForChunkSigncryption(sss.headerHash, isFinal, sss.numBlocks)

	// Handle regular signing mode and anonymous mode (where we don't actually
	// sign anything).
	var detachedSig []byte
	if sss.signingKey == nil {
		detachedSig = make([]byte, ed25519.SignatureSize)
	} else {
		signatureInput := computeSigncryptionSignatureInput(sss.headerHash, nonce, isFinal, plaintext)

		var err error
		detachedSig, err = sss.signingKey.Sign(signatureInput)
		if err != nil {
			return err
		}
	}

	attachedSig := append(detachedSig, plaintext...)

	ciphertext := secretbox.Seal([]byte{}, attachedSig, (*[24]byte)(&nonce), (*[32]byte)(&sss.encryptionKey))

	assertEncodedChunkState(sss.version, ciphertext, secretbox.Overhead, uint64(sss.numBlocks), isFinal)

	block := signcryptionBlock{
		PayloadCiphertext: ciphertext,
		IsFinal:           isFinal,
	}

	if err := sss.encoder.Encode(block); err != nil {
		return err
	}

	sss.numBlocks++
	return nil
}

// Similar to the encryption format, we derive a symmetric key from our DH keys
// (one of which is ephemeral) by encrypting 32 bytes of zeros. We could have
// used crypto_box_beforenm directly instead, but that would be a slight abuse
// of that function, and also we don't expect all NaCl/libsodium wrapper libs
// to expose it. This key does *not* mix in the recipient index -- it will be
// the same for two different recipients if they claim the same public key.
func derivedEphemeralKeyFromBoxKeys(public BoxPublicKey, private BoxSecretKey) *SymmetricKey {
	sharedSecretBox := private.Box(public, nonceForDerivedSharedKey(), make([]byte, 32))
	derivedKey, err := symmetricKeyFromSlice(sharedSecretBox[len(sharedSecretBox)-32 : len(sharedSecretBox)])
	if err != nil {
		panic(err) // should be statically impossible, if the slice above is the right length
	}
	return derivedKey
}

// Compute the visible identifier that the recipient will use to find the right
// recipient entry. Include the entry index, so that this identifier is unique
// even if two recipients claim the same public key (though unfortunately that
// means that recipients will need to recompute the identifier for each entry
// in the recipients list). This identifier is somewhat redundant, because a
// recipient could instead just attempt to decrypt the payload key secretbox
// and see if it works, but including them adds a bit to anonymity by making
// box key recipients indistinguishable from symmetric key recipients.
func keyIdentifierFromDerivedKey(derivedKey *SymmetricKey, recipientIndex uint64) []byte {
	keyIdentifierDigest := hmac.New(sha512.New, []byte(signcryptionBoxKeyIdentifierContext))
	keyIdentifierDigest.Write(derivedKey[:])
	nonce := nonceForPayloadKeyBoxV2(recipientIndex)
	keyIdentifierDigest.Write(nonce[:])
	return keyIdentifierDigest.Sum(nil)[0:32]
}

// A receiverKeysMaker is either a (wrapped) BoxPublicKey or a
// ReceiverSymmetricKey.
type receiverKeysMaker interface {
	makeReceiverKeys(ephemeralPriv BoxSecretKey, payloadKey SymmetricKey, index uint64) receiverKeys
}

type receiverBoxKey struct {
	pk BoxPublicKey
}

func (r receiverBoxKey) makeReceiverKeys(ephemeralPriv BoxSecretKey, payloadKey SymmetricKey, index uint64) receiverKeys {
	derivedKey := derivedEphemeralKeyFromBoxKeys(r.pk, ephemeralPriv)
	identifier := keyIdentifierFromDerivedKey(derivedKey, index)

	nonce := nonceForPayloadKeyBoxV2(index)
	payloadKeyBox := secretbox.Seal(
		nil,
		payloadKey[:],
		(*[24]byte)(&nonce),
		(*[32]byte)(derivedKey))

	return receiverKeys{
		ReceiverKID:   identifier,
		PayloadKeyBox: payloadKeyBox,
	}
}

type ReceiverSymmetricKey struct {
	// In practice these identifiers will be KBFS TLF keys.
	Key SymmetricKey
	// In practice these identifiers will be KBFS TLF pseudonyms.
	Identifier []byte
}

func (r ReceiverSymmetricKey) makeReceiverKeys(ephemeralPriv BoxSecretKey, payloadKey SymmetricKey, index uint64) receiverKeys {
	// Derive a message-specific shared secret by hashing the symmetric key and
	// the ephemeral public key together. This lets us use nonces that are
	// simple counters.
	derivedKeyDigest := hmac.New(sha512.New, []byte(signcryptionSymmetricKeyContext))
	derivedKeyDigest.Write(ephemeralPriv.GetPublicKey().ToKID())
	derivedKeyDigest.Write(r.Key[:])
	derivedKey, err := rawBoxKeyFromSlice(derivedKeyDigest.Sum(nil)[0:32])
	if err != nil {
		panic(err) // should be statically impossible, if the slice above is the right length
	}

	nonce := nonceForPayloadKeyBoxV2(index)
	payloadKeyBox := secretbox.Seal(
		nil,
		payloadKey[:],
		(*[24]byte)(&nonce),
		(*[32]byte)(derivedKey))

	// Unlike the box key case, the identifier is supplied by the caller rather
	// than computed. (These will be KBFS TLF pseudonyms.)
	return receiverKeys{
		ReceiverKID:   r.Identifier,
		PayloadKeyBox: payloadKeyBox,
	}
}

func shuffleSigncryptionReceivers(receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) []receiverKeysMaker {
	totalLen := len(receiverBoxKeys) + len(receiverSymmetricKeys)
	order := randomPerm(totalLen)
	receivers := make([]receiverKeysMaker, totalLen)
	for i, r := range receiverBoxKeys {
		receivers[order[i]] = receiverBoxKey{r}
	}

	for i, r := range receiverSymmetricKeys {
		receivers[order[len(receiverBoxKeys)+i]] = r
	}
	return receivers
}

// This generates the payload key, and encrypts it for all the different
// recipients of the two different types. Symmetric key recipients and DH key
// recipients use different types of identifiers, but they are the same length,
// and should both be indistinguishable from random noise.
func (sss *signcryptSealStream) init(receivers []receiverKeysMaker) error {
	ephemeralKey, err := sss.keyring.CreateEphemeralKey()
	if err != nil {
		return err
	}

	eh := SigncryptionHeader{
		FormatName: FormatName,
		Version:    sss.version,
		Type:       MessageTypeSigncryption,
		Ephemeral:  ephemeralKey.GetPublicKey().ToKID(),
	}
	if err := randomFill(sss.encryptionKey[:]); err != nil {
		return err
	}

	// Prepare the secretbox that contains the sender's public key. If the
	// sender is anonymous, use an all-zeros key, so that the anonymity bit
	// doesn't leak out.
	nonce := nonceForSenderKeySecretBox()
	if sss.signingKey == nil {
		// anonymous sender mode, all zeros
		eh.SenderSecretbox = secretbox.Seal([]byte{}, make([]byte, ed25519.PublicKeySize), (*[24]byte)(&nonce), (*[32]byte)(&sss.encryptionKey))
	} else {
		// regular sender mode, an actual key
		signingPublicKeyBytes := sss.signingKey.GetPublicKey().ToKID()
		if len(signingPublicKeyBytes) != ed25519.PublicKeySize {
			panic("unexpected signing key length, anonymity bit will leak")
		}
		eh.SenderSecretbox = secretbox.Seal([]byte{}, sss.signingKey.GetPublicKey().ToKID(), (*[24]byte)(&nonce), (*[32]byte)(&sss.encryptionKey))
	}

	// Collect all the recipient identifiers, and encrypt the payload key for
	// all of them.
	for i, r := range receivers {
		eh.Receivers = append(eh.Receivers, r.makeReceiverKeys(ephemeralKey, sss.encryptionKey, uint64(i)))
	}

	// Encode the header to bytes, hash it, then double encode it.
	headerBytes, err := encodeToBytes(eh)
	if err != nil {
		return err
	}
	sss.headerHash = sha512.Sum512(headerBytes)
	err = sss.encoder.Encode(headerBytes)
	if err != nil {
		return err
	}

	return nil
}

func (sss *signcryptSealStream) Close() error {
	err := sss.signcryptBlock(true)
	if err != nil {
		return err
	}

	if sss.buffer.Len() > 0 {
		panic(fmt.Sprintf("sss.buffer.Len()=%d > 0", sss.buffer.Len()))
	}

	return nil
}

// NewSigncryptSealStream creates a stream that consumes plaintext data. It
// will write out signed and encrypted data to the io.Writer passed in as
// ciphertext. The encryption is from the specified sender, and is encrypted
// for the given receivers.
//
// Returns an io.WriteClose that accepts plaintext data to be signcrypted; and
// also returns an error if initialization failed.
func NewSigncryptSealStream(ciphertext io.Writer, keyring Keyring, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) (io.WriteCloser, error) {
	sss := &signcryptSealStream{
		version:    Version2(),
		output:     ciphertext,
		encoder:    newEncoder(ciphertext),
		signingKey: sender,
		keyring:    keyring,
	}
	receivers := shuffleSigncryptionReceivers(receiverBoxKeys, receiverSymmetricKeys)
	err := sss.init(receivers)
	return sss, err
}

// Seal a plaintext from the given sender, for the specified receiver groups.
// Returns a ciphertext, or an error if something bad happened.
func SigncryptSeal(plaintext []byte, keyring Keyring, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) (out []byte, err error) {
	var buf bytes.Buffer
	sss, err := NewSigncryptSealStream(&buf, keyring, sender, receiverBoxKeys, receiverSymmetricKeys)
	if err != nil {
		return nil, err
	}
	if _, err := sss.Write(plaintext); err != nil {
		return nil, err
	}
	if err := sss.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
