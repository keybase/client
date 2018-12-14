// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"io"
	"io/ioutil"

	"golang.org/x/crypto/ed25519"
	"golang.org/x/crypto/nacl/secretbox"
)

type signcryptOpenStream struct {
	mps              *msgpackStream
	payloadKey       *SymmetricKey
	signingPublicKey SigningPublicKey
	senderAnonymous  bool
	headerHash       headerHash
	keyring          SigncryptKeyring
	resolver         SymmetricKeyResolver
}

func (sos *signcryptOpenStream) getNextChunk() ([]byte, error) {
	var sb signcryptionBlock
	seqno, err := sos.mps.Read(&sb)
	if err != nil {
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		return nil, err
	}

	chunk, err := sos.processBlock(sb.PayloadCiphertext, sb.IsFinal, seqno)
	if err != nil {
		return nil, err
	}

	err = checkDecodedChunkState(Version2(), chunk, seqno, sb.IsFinal)
	if err != nil {
		return nil, err
	}

	if sb.IsFinal {
		return chunk, assertEndOfStream(sos.mps)
	}

	return chunk, nil
}

func (sos *signcryptOpenStream) readHeader() error {
	// Read the header bytes.
	headerBytes := []byte{}
	_, err := sos.mps.Read(&headerBytes)
	if err != nil {
		return ErrFailedToReadHeaderBytes
	}
	// Compute the header hash.
	sos.headerHash = sha512.Sum512(headerBytes)
	// Parse the header bytes.
	var header SigncryptionHeader
	err = decodeFromBytes(&header, headerBytes)
	if err != nil {
		return err
	}
	err = sos.processHeader(&header)
	if err != nil {
		return err
	}
	return nil
}

func (sos *signcryptOpenStream) tryBoxSecretKeys(hdr *SigncryptionHeader, ephemeralPub BoxPublicKey) (*SymmetricKey, error) {
	derivedKeys := []*SymmetricKey{}
	for _, receiverBoxSecretKey := range sos.keyring.GetAllBoxSecretKeys() {
		derivedKey := derivedEphemeralKeyFromBoxKeys(ephemeralPub, receiverBoxSecretKey)
		derivedKeys = append(derivedKeys, derivedKey)
	}

	// Try each of the box secret keys against each of the receiver pairs in
	// the message header. The actual expected number of box secret keys is
	// one, so this shouldn't be as quadratic as it looks.
	for receiverIndex, receiver := range hdr.Receivers {
		for _, derivedKey := range derivedKeys {
			identifier := keyIdentifierFromDerivedKey(derivedKey, uint64(receiverIndex))
			if hmac.Equal(identifier, receiver.ReceiverKID) {
				// This is the right key! Open the sender secretbox and return the sender key.
				nonce := nonceForPayloadKeyBoxV2(uint64(receiverIndex))
				payloadKey, isValid := secretbox.Open(
					nil,
					receiver.PayloadKeyBox,
					(*[24]byte)(&nonce),
					(*[32]byte)(derivedKey))
				if !isValid {
					return nil, ErrDecryptionFailed
				}
				return symmetricKeyFromSlice(payloadKey)
			}
		}
	}

	// None of the box keys worked. We'll fall back to the secretbox keys.
	return nil, nil
}

func (sos *signcryptOpenStream) trySharedSymmetricKeys(hdr *SigncryptionHeader, ephemeralPub BoxPublicKey) (*SymmetricKey, error) {
	identifiers := [][]byte{}
	for _, receiver := range hdr.Receivers {
		identifiers = append(identifiers, receiver.ReceiverKID)
	}

	resolvedKeys, err := sos.resolver.ResolveKeys(identifiers)
	if err != nil {
		return nil, err
	}
	if len(resolvedKeys) != len(identifiers) {
		return nil, ErrWrongNumberOfKeys
	}

	for index, resolved := range resolvedKeys {
		if resolved == nil {
			// This key didn't resolve.
			continue
		}

		// We got a key. It should decrypt the corresponding receiver secretbox.
		derivedKeyDigest := hmac.New(sha512.New, []byte(signcryptionSymmetricKeyContext))
		derivedKeyDigest.Write(ephemeralPub.ToKID())
		derivedKeyDigest.Write(resolved[:])
		derivedKey, err := rawBoxKeyFromSlice(derivedKeyDigest.Sum(nil)[0:32])
		if err != nil {
			panic(err) // should be statically impossible, if the slice above is the right length
		}

		nonce := nonceForPayloadKeyBoxV2(uint64(index))
		payloadKey, isValid := secretbox.Open(
			nil,
			hdr.Receivers[index].PayloadKeyBox,
			(*[24]byte)(&nonce),
			(*[32]byte)(derivedKey))
		if !isValid {
			return nil, ErrDecryptionFailed
		}
		return symmetricKeyFromSlice(payloadKey)
	}

	// If we get out of the loop, all the resolved keys were nil (failed to resolve).
	return nil, nil
}

func (sos *signcryptOpenStream) processHeader(hdr *SigncryptionHeader) error {
	if err := hdr.validate(); err != nil {
		return err
	}

	ephemeralPub := sos.keyring.ImportBoxEphemeralKey(hdr.Ephemeral)

	var err error
	sos.payloadKey, err = sos.tryBoxSecretKeys(hdr, ephemeralPub)
	if err != nil {
		return err
	}
	if sos.payloadKey == nil {
		sos.payloadKey, err = sos.trySharedSymmetricKeys(hdr, ephemeralPub)
		if err != nil {
			return err
		}
	}
	if sos.payloadKey == nil {
		return ErrNoDecryptionKey
	}

	// Decrypt the sender's public key, and check for anonymous mode.
	nonce := nonceForSenderKeySecretBox()
	senderKeySlice, ok := secretbox.Open([]byte{}, hdr.SenderSecretbox, (*[24]byte)(&nonce), (*[32]byte)(sos.payloadKey))
	if !ok {
		return ErrBadSenderKeySecretbox
	}
	zeroSlice := make([]byte, len(senderKeySlice))
	if bytes.Equal(zeroSlice, senderKeySlice) {
		// anonymous mode, an all zero sender signing public key
		sos.senderAnonymous = true
	} else {
		// regular mode, with a real signing public key
		sos.signingPublicKey = sos.keyring.LookupSigningPublicKey(senderKeySlice)
	}

	return nil
}

func (sos *signcryptOpenStream) processBlock(payloadCiphertext []byte, isFinal bool, seqno packetSeqno) ([]byte, error) {

	blockNum := encryptionBlockNumber(seqno - 1)

	if err := blockNum.check(); err != nil {
		return nil, err
	}

	nonce := nonceForChunkSigncryption(sos.headerHash, isFinal, blockNum)

	attachedSig, isValid := secretbox.Open([]byte{}, payloadCiphertext, (*[24]byte)(&nonce), (*[32]byte)(sos.payloadKey))
	if !isValid || len(attachedSig) < ed25519.SignatureSize {
		return nil, ErrBadCiphertext(seqno)
	}

	detachedSig := sliceToByte64(attachedSig[:ed25519.SignatureSize])
	chunkPlaintext := attachedSig[ed25519.SignatureSize:]

	// Handle anonymous sender mode by skipping signature verification. By
	// convention the signature bytes are all zeroes, but here we ignore them.
	if !sos.senderAnonymous {
		signatureInput := computeSigncryptionSignatureInput(sos.headerHash, nonce, isFinal, chunkPlaintext)
		sigErr := sos.signingPublicKey.Verify(signatureInput, detachedSig[:])
		if sigErr != nil {
			return nil, ErrBadSignature
		}
	}

	return chunkPlaintext, nil
}

// NewSigncryptOpenStream starts a streaming verification and decryption. It
// synchronously ingests and parses the given Reader's encryption header. It
// consults the passed keyring for the decryption keys needed to decrypt the
// message. On failure, it returns a null Reader and an error message. On
// success, it returns a Reader with the plaintext stream, and a nil error. In
// either case, it will return a `MessageKeyInfo` which tells about who the
// sender was, and which of the Receiver's keys was used to decrypt the
// message.
//
// Note that the caller has an opportunity not to ingest the plaintext if he
// doesn't trust the sender revealed in the MessageKeyInfo.
//
func NewSigncryptOpenStream(r io.Reader, keyring SigncryptKeyring, resolver SymmetricKeyResolver) (senderPub SigningPublicKey, plaintext io.Reader, err error) {
	sos := &signcryptOpenStream{
		mps:      newMsgpackStream(r),
		keyring:  keyring,
		resolver: resolver,
	}

	err = sos.readHeader()
	if err != nil {
		return nil, nil, err
	}

	return sos.signingPublicKey, newChunkReader(sos), nil
}

// SymmetricKeyResolver is an interface for resolving identifiers to keys.
type SymmetricKeyResolver interface {
	ResolveKeys(identifiers [][]byte) ([]*SymmetricKey, error)
}

// SigncryptOpen simply opens a ciphertext given the set of keys in the specified keyring.
// It returns a plaintext on sucess, and an error on failure. It returns the header's
// MessageKeyInfo in either case.
func SigncryptOpen(ciphertext []byte, keyring SigncryptKeyring, resolver SymmetricKeyResolver) (senderPub SigningPublicKey, plaintext []byte, err error) {
	buf := bytes.NewBuffer(ciphertext)
	senderPub, plaintextStream, err := NewSigncryptOpenStream(buf, keyring, resolver)
	if err != nil {
		return senderPub, nil, err
	}
	ret, err := ioutil.ReadAll(plaintextStream)
	if err != nil {
		return nil, nil, err
	}
	return senderPub, ret, err
}

// SigncryptKeyring is a combination of the Keyring and SigKeyring
// interfaces.
type SigncryptKeyring interface {
	Keyring
	SigKeyring
}
