// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"io"
	"io/ioutil"

	"golang.org/x/crypto/nacl/secretbox"
)

type decryptStream struct {
	versionValidator VersionValidator
	version          Version
	ring             Keyring
	mps              *msgpackStream
	payloadKey       *SymmetricKey
	senderKey        *RawBoxKey
	headerHash       headerHash
	macKey           macKey
	position         int
	mki              MessageKeyInfo
}

// MessageKeyInfo conveys all of the data about the keys used in this encrypted message.
type MessageKeyInfo struct {
	// These fields are cryptographically verified
	SenderKey      BoxPublicKey
	SenderIsAnon   bool
	ReceiverKey    BoxSecretKey
	ReceiverIsAnon bool

	// These fields are not cryptographically verified, and are just repeated from what
	// we saw in the incoming message.
	NamedReceivers   [][]byte
	NumAnonReceivers int
}

func (ds *decryptStream) getNextChunk() ([]byte, error) {
	ciphertext, authenticators, isFinal, seqno, err := readEncryptionBlock(ds.version, ds.mps)
	if err != nil {
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		return nil, err
	}

	chunk, err := ds.processBlock(ciphertext, authenticators, isFinal, seqno)
	if err != nil {
		return nil, err
	}

	err = checkDecodedChunkState(ds.version, chunk, seqno, isFinal)
	if err != nil {
		return nil, err
	}

	if isFinal {
		return chunk, assertEndOfStream(ds.mps)
	}

	return chunk, nil
}

func (ds *decryptStream) readHeader(rawReader io.Reader) error {
	// Read the header bytes.
	headerBytes := []byte{}
	_, err := ds.mps.Read(&headerBytes)
	if err != nil {
		return ErrFailedToReadHeaderBytes
	}
	// Compute the header hash.
	ds.headerHash = sha512.Sum512(headerBytes)
	// Parse the header bytes.
	var header EncryptionHeader
	err = decodeFromBytes(&header, headerBytes)
	if err != nil {
		return err
	}
	err = ds.processHeader(&header)
	if err != nil {
		return err
	}
	return nil
}

func readEncryptionBlock(version Version, mps *msgpackStream) (ciphertext []byte, authenticators []payloadAuthenticator, isFinal bool, seqno packetSeqno, err error) {
	switch version.Major {
	case 1:
		var ebV1 encryptionBlockV1
		seqno, err = mps.Read(&ebV1)
		if err != nil {
			return nil, nil, false, 0, err
		}

		return ebV1.PayloadCiphertext, ebV1.HashAuthenticators, len(ebV1.PayloadCiphertext) == secretbox.Overhead, seqno, nil
	case 2:
		var ebV2 encryptionBlockV2
		seqno, err := mps.Read(&ebV2)
		if err != nil {
			return nil, nil, false, 0, err
		}

		return ebV2.PayloadCiphertext, ebV2.HashAuthenticators, ebV2.IsFinal, seqno, nil
	default:
		panic(ErrBadVersion{version})
	}
}

func (ds *decryptStream) tryVisibleReceivers(hdr *EncryptionHeader, ephemeralKey BoxPublicKey) (BoxSecretKey, *SymmetricKey, int, error) {
	var kids [][]byte
	tab := make(map[int]int)
	for i, r := range hdr.Receivers {
		if len(r.ReceiverKID) != 0 {
			tab[len(kids)] = i // Keep track of where it was in the original list
			kids = append(kids, r.ReceiverKID)
		}
	}
	ds.mki.NamedReceivers = kids

	i, sk := ds.ring.LookupBoxSecretKey(kids)
	if i < 0 || sk == nil {
		return nil, nil, -1, nil
	}

	orig, ok := tab[i]
	if !ok {
		return nil, nil, -1, ErrBadLookup
	}

	nonce := nonceForPayloadKeyBox(hdr.Version, uint64(orig))
	payloadKeySlice, err := sk.Unbox(ephemeralKey, nonce, hdr.Receivers[orig].PayloadKeyBox)
	if err != nil {
		return nil, nil, -1, err
	}

	payloadKey, err := symmetricKeyFromSlice(payloadKeySlice)
	if err != nil {
		return nil, nil, -1, err
	}

	return sk, payloadKey, orig, err
}

func (ds *decryptStream) tryHiddenReceivers(hdr *EncryptionHeader, ephemeralKey BoxPublicKey) (BoxSecretKey, *SymmetricKey, int, error) {
	secretKeys := ds.ring.GetAllBoxSecretKeys()

	for _, r := range hdr.Receivers {
		if len(r.ReceiverKID) == 0 {
			ds.mki.NumAnonReceivers++
		}
	}

	for _, secretKey := range secretKeys {

		shared := secretKey.Precompute(ephemeralKey)

		for i, r := range hdr.Receivers {
			if len(r.ReceiverKID) == 0 {
				nonce := nonceForPayloadKeyBox(hdr.Version, uint64(i))
				payloadKeySlice, err := shared.Unbox(nonce, r.PayloadKeyBox)
				if err != nil {
					continue
				}
				payloadKey, err := symmetricKeyFromSlice(payloadKeySlice)
				if err != nil {
					return nil, nil, -1, err
				}
				return secretKey, payloadKey, i, nil
			}
		}
	}

	return nil, nil, -1, nil
}

func (ds *decryptStream) processHeader(hdr *EncryptionHeader) error {
	if err := hdr.validate(ds.versionValidator); err != nil {
		return err
	}

	ds.version = hdr.Version

	ephemeralKey := ds.ring.ImportBoxEphemeralKey(hdr.Ephemeral)
	if ephemeralKey == nil {
		return ErrBadEphemeralKey
	}

	var secretKey BoxSecretKey
	var err error

	secretKey, ds.payloadKey, ds.position, err = ds.tryVisibleReceivers(hdr, ephemeralKey)
	if err != nil {
		return err
	}
	if secretKey == nil {
		secretKey, ds.payloadKey, ds.position, err = ds.tryHiddenReceivers(hdr, ephemeralKey)
		ds.mki.ReceiverIsAnon = true
	}
	if err != nil {
		return err
	}
	if secretKey == nil || ds.position < 0 {
		return ErrNoDecryptionKey
	}
	ds.mki.ReceiverKey = secretKey

	// Decrypt the sender's public key
	nonce := nonceForSenderKeySecretBox()
	senderKeySlice, ok := secretbox.Open([]byte{}, hdr.SenderSecretbox, (*[24]byte)(&nonce), (*[32]byte)(ds.payloadKey))
	if !ok {
		return ErrBadSenderKeySecretbox
	}
	ds.senderKey, err = rawBoxKeyFromSlice(senderKeySlice)
	if err != nil {
		return err
	}

	// Lookup the sender's public key in our keyring, and import
	// it for use. However, if the sender key is the same as the ephemeral
	// key, then assume "anonymous mode", so use the already imported anonymous
	// key.
	if !hmac.Equal(hdr.Ephemeral, ds.senderKey[:]) {
		longLivedSenderKey := ds.ring.LookupBoxPublicKey(ds.senderKey[:])
		if longLivedSenderKey == nil {
			return ErrNoSenderKey
		}
		ds.mki.SenderKey = longLivedSenderKey
	} else {
		ds.mki.SenderIsAnon = true
		ds.mki.SenderKey = ephemeralKey
	}

	// Compute the MAC key.
	ds.macKey = computeMACKeyReceiver(hdr.Version, uint64(ds.position), secretKey, ds.mki.SenderKey, ephemeralKey, ds.headerHash)

	return nil
}

func computeMACKeyReceiver(version Version, index uint64, secret BoxSecretKey, public, ePublic BoxPublicKey, headerHash headerHash) macKey {
	// Switch on the major version since we're reading, and so may
	// encounter headers written by unknown minor versions.
	switch version.Major {
	case 1:
		nonce := nonceForMACKeyBoxV1(headerHash)
		return computeMACKeySingle(secret, public, nonce)
	case 2:
		nonce := nonceForMACKeyBoxV2(headerHash, false, index)
		mac := computeMACKeySingle(secret, public, nonce)
		eNonce := nonceForMACKeyBoxV2(headerHash, true, index)
		eMAC := computeMACKeySingle(secret, ePublic, eNonce)
		return sum512Truncate256(append(mac[:], eMAC[:]...))
	default:
		panic(ErrBadVersion{version})
	}
}

func (ds *decryptStream) processBlock(ciphertext []byte, authenticators []payloadAuthenticator, isFinal bool, seqno packetSeqno) ([]byte, error) {

	blockNum := encryptionBlockNumber(seqno - 1)

	if err := blockNum.check(); err != nil {
		return nil, err
	}

	nonce := nonceForChunkSecretBox(blockNum)

	// Check the authenticator.
	hashToAuthenticate := computePayloadHash(ds.version, ds.headerHash, nonce, ciphertext, isFinal)
	ourAuthenticator := computePayloadAuthenticator(ds.macKey, hashToAuthenticate)
	if !ourAuthenticator.Equal(authenticators[ds.position]) {
		return nil, ErrBadTag(seqno)
	}

	plaintext, ok := secretbox.Open([]byte{}, ciphertext, (*[24]byte)(&nonce), (*[32]byte)(ds.payloadKey))
	if !ok {
		return nil, ErrBadCiphertext(seqno)
	}

	// The encoding of the empty buffer implies the EOF.  But otherwise, all mechanisms are the same.
	if len(plaintext) == 0 {
		return nil, nil
	}
	return plaintext, nil
}

// NewDecryptStream starts a streaming decryption. It synchronously ingests
// and parses the given Reader's encryption header. It consults the passed
// keyring for the decryption keys needed to decrypt the message. On failure,
// it returns a null Reader and an error message. On success, it returns a
// Reader with the plaintext stream, and a nil error. In either case, it will
// return a `MessageKeyInfo` which tells about who the sender was, and which of the
// Receiver's keys was used to decrypt the message.
//
// Note that the caller has an opportunity not to ingest the plaintext if he
// doesn't trust the sender revealed in the MessageKeyInfo.
//
func NewDecryptStream(versionValidator VersionValidator, r io.Reader, keyring Keyring) (mki *MessageKeyInfo, plaintext io.Reader, err error) {
	ds := &decryptStream{
		versionValidator: versionValidator,
		ring:             keyring,
		mps:              newMsgpackStream(r),
	}

	err = ds.readHeader(r)
	if err != nil {
		return &ds.mki, nil, err
	}

	return &ds.mki, newChunkReader(ds), nil
}

// Open simply opens a ciphertext given the set of keys in the specified keyring.
// It returns a plaintext on success, and an error on failure. It returns the header's
// MessageKeyInfo in either case.
func Open(versionValidator VersionValidator, ciphertext []byte, keyring Keyring) (i *MessageKeyInfo, plaintext []byte, err error) {
	buf := bytes.NewBuffer(ciphertext)
	mki, plaintextStream, err := NewDecryptStream(versionValidator, buf, keyring)
	if err != nil {
		return mki, nil, err
	}
	ret, err := ioutil.ReadAll(plaintextStream)
	if err != nil {
		return nil, nil, err
	}
	return mki, ret, err
}
