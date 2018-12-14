// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	cryptorand "crypto/rand"
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
	derivedKey, err := symmetricKeyFromSlice(sharedSecretBox[len(sharedSecretBox)-32:])
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

// ReceiverSymmetricKey is a symmetric key paired with an identifier.
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

func checkSigncryptReceiverCount(receiverBoxKeyCount, receiverSymmetricKeyCount int) error {
	c1 := int64(receiverBoxKeyCount)
	c2 := int64(receiverSymmetricKeyCount)
	if c1 < 0 {
		panic("Bogus recieverBoxKeyCount")
	}
	if c2 < 0 {
		panic("Bogus recieverSymmetricKeyCount")
	}
	// Handle possible (but unlikely) overflow when adding
	// together the two sizes.
	if c1 > maxReceiverCount {
		return ErrBadReceivers
	}
	if c2 > maxReceiverCount {
		return ErrBadReceivers
	}
	c := c1 + c2
	if c <= 0 || c > maxReceiverCount {
		return ErrBadReceivers
	}

	return nil
}

// checkEncryptReceivers does some sanity checking on the
// receivers. Check that receivers aren't sent to twice; check that
// there's at least one receiver and not too many receivers.
func checkSigncryptReceivers(receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) error {
	err := checkSigncryptReceiverCount(len(receiverBoxKeys), len(receiverSymmetricKeys))
	if err != nil {
		return err
	}

	// Make sure that each receiver only shows up in the set once.
	receiverSet := make(map[string]bool)

	// Make sure each key hasn't been used before.

	for _, receiver := range receiverBoxKeys {
		kid := receiver.ToKID()
		kidString := string(kid)
		if receiverSet[kidString] {
			return ErrRepeatedKey(kid)
		}
		receiverSet[kidString] = true
	}

	for _, receiver := range receiverSymmetricKeys {
		kid := receiver.Identifier
		kidString := string(kid)
		if receiverSet[kidString] {
			return ErrRepeatedKey(kid)
		}
		receiverSet[kidString] = true
	}

	return nil
}

func shuffleSigncryptReceivers(receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) ([]receiverKeysMaker, error) {
	totalLen := len(receiverBoxKeys) + len(receiverSymmetricKeys)
	shuffled := make([]receiverKeysMaker, totalLen)
	for i, r := range receiverBoxKeys {
		shuffled[i] = receiverBoxKey{r}
	}
	for i, r := range receiverSymmetricKeys {
		shuffled[i+len(receiverBoxKeys)] = r
	}
	err := csprngShuffle(cryptorand.Reader, len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})
	if err != nil {
		return nil, err
	}
	return shuffled, nil
}

// signcryptRNG is an interface encapsulating all the randomness
// (aside from ephemeral key generation) that happens during
// signcryption. Tests can override it to make encryption
// deterministic.
type signcryptRNG interface {
	createSymmetricKey() (*SymmetricKey, error)
	shuffleReceivers(receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) ([]receiverKeysMaker, error)
}

// This generates the payload key, and encrypts it for all the different
// recipients of the two different types. Symmetric key recipients and DH key
// recipients use different types of identifiers, but they are the same length,
// and should both be indistinguishable from random noise.
func (sss *signcryptSealStream) init(
	receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey,
	ephemeralKeyCreator EphemeralKeyCreator, rng signcryptRNG) error {
	if err := checkSigncryptReceivers(receiverBoxKeys, receiverSymmetricKeys); err != nil {
		return err
	}

	receivers, err := rng.shuffleReceivers(receiverBoxKeys, receiverSymmetricKeys)
	if err != nil {
		return err
	}

	ephemeralKey, err := ephemeralKeyCreator.CreateEphemeralKey()
	if err != nil {
		return err
	}

	eh := SigncryptionHeader{
		FormatName: FormatName,
		Version:    sss.version,
		Type:       MessageTypeSigncryption,
		Ephemeral:  ephemeralKey.GetPublicKey().ToKID(),
	}
	encryptionKey, err := rng.createSymmetricKey()
	if err != nil {
		return err
	}
	sss.encryptionKey = *encryptionKey

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

func newSigncryptSealStream(ciphertext io.Writer, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey, ephemeralKeyCreator EphemeralKeyCreator, rng signcryptRNG) (io.WriteCloser, error) {
	sss := &signcryptSealStream{
		version:    Version2(),
		output:     ciphertext,
		encoder:    newEncoder(ciphertext),
		signingKey: sender,
	}
	err := sss.init(receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, defaultSigncryptRNG{})
	if err != nil {
		return nil, err
	}
	return sss, nil
}

type defaultSigncryptRNG struct{}

func (defaultSigncryptRNG) createSymmetricKey() (*SymmetricKey, error) {
	return newRandomSymmetricKey()
}

func (defaultSigncryptRNG) shuffleReceivers(receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) ([]receiverKeysMaker, error) {
	return shuffleSigncryptReceivers(receiverBoxKeys, receiverSymmetricKeys)
}

// NewSigncryptSealStream creates a stream that consumes plaintext data. It
// will write out signed and encrypted data to the io.Writer passed in as
// ciphertext. The encryption is from the specified sender, and is encrypted
// for the given receivers.
//
// ephemeralKeyCreator should be the last argument; it's the 2nd one
// to preserve the public API.
//
// If initialization succeeds, returns an io.WriteCloser that accepts
// plaintext data to be encrypted and a nil error. Otherwise, returns
// nil and the initialization error.
func NewSigncryptSealStream(ciphertext io.Writer, ephemeralKeyCreator EphemeralKeyCreator, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) (io.WriteCloser, error) {
	return newSigncryptSealStream(ciphertext, sender, receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, defaultSigncryptRNG{})
}

func signcryptSeal(plaintext []byte, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey, ephemeralKeyCreator EphemeralKeyCreator, rng signcryptRNG) (out []byte, err error) {
	var buf bytes.Buffer
	sss, err := newSigncryptSealStream(&buf, sender, receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, rng)
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

// SigncryptSeal a plaintext from the given sender, for the specified
// receiver groups.  Returns a ciphertext, or an error if something
// bad happened.
//
// ephemeralKeyCreator should be the last argument; it's the 2nd one
// to preserve the public API.
func SigncryptSeal(plaintext []byte, ephemeralKeyCreator EphemeralKeyCreator, sender SigningSecretKey, receiverBoxKeys []BoxPublicKey, receiverSymmetricKeys []ReceiverSymmetricKey) (out []byte, err error) {
	return signcryptSeal(plaintext, sender, receiverBoxKeys, receiverSymmetricKeys, ephemeralKeyCreator, defaultSigncryptRNG{})
}
