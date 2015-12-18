// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
	"io/ioutil"
)

type decryptState int

const (
	stateHeader      decryptState = iota
	stateBody        decryptState = iota
	stateEndOfStream decryptState = iota
)

type decryptStream struct {
	ring       Keyring
	fmps       *framedMsgpackStream
	err        error
	state      decryptState
	keys       *receiverKeysPlaintext
	sessionKey SymmetricKey
	buf        []byte
	nonce      *Nonce
	tagKey     BoxPrecomputedSharedKey
	position   int
}

func (ds *decryptStream) Read(b []byte) (n int, err error) {
	for n == 0 && err == nil {
		n, err = ds.read(b)
	}
	if err == io.EOF && ds.state != stateEndOfStream {
		err = io.ErrUnexpectedEOF
	}
	return n, err
}

func (ds *decryptStream) read(b []byte) (n int, err error) {

	// Handle the case of a previous error. Just return the error
	// again.
	if ds.err != nil {
		return 0, ds.err
	}

	// Handle the case first of a previous read that couldn't put all
	// of its data into the outgoing buffer.
	if len(ds.buf) > 0 {
		n = copy(b, ds.buf)
		ds.buf = ds.buf[n:]
		return n, nil
	}

	// We have three states we can be in, but we can definitely
	// fall through during one read, so be careful.

	if ds.state == stateHeader {
		if ds.err = ds.readHeader(); ds.err != nil {
			return 0, ds.err
		}
		ds.state = stateBody
	}

	if ds.state == stateBody {
		var last bool
		n, last, ds.err = ds.readBlock(b)
		if ds.err != nil {
			return 0, ds.err
		}

		if last {
			ds.state = stateEndOfStream
		}
	}

	if ds.state == stateEndOfStream {
		ds.err = ds.assertEndOfStream()
		if ds.err != nil {
			return 0, ds.err
		}
	}

	return n, nil
}

func (ds *decryptStream) readHeader() error {
	var hdr EncryptionHeader
	seqno, err := ds.fmps.Read(&hdr)
	if err != nil {
		return err
	}
	hdr.seqno = seqno
	return ds.processEncryptionHeader(&hdr)
}

func (ds *decryptStream) readBlock(b []byte) (n int, lastBlock bool, err error) {
	var eb EncryptionBlock
	var seqno PacketSeqno
	seqno, err = ds.fmps.Read(&eb)
	if err != nil {
		return 0, false, err
	}
	eb.seqno = seqno
	var plaintext []byte
	plaintext, err = ds.processEncryptionBlock(&eb)
	if err != nil {
		return 0, false, err
	}
	if plaintext == nil {
		return 0, true, err
	}

	// Copy as much as we can into the given outbuffer
	n = copy(b, plaintext)
	// Leave the remainder for a subsequent read
	ds.buf = plaintext[n:]

	return n, false, err
}

func (ds *decryptStream) assertEndOfStream() error {
	var i interface{}
	_, err := ds.fmps.Read(&i)
	if err == nil {
		err = ErrTrailingGarbage
	}
	return err
}

func (ds *decryptStream) tryVisibleReceivers(hdr *EncryptionHeader, ephemeralKey BoxPublicKey) (BoxSecretKey, BoxPrecomputedSharedKey, []byte, int, error) {
	var kids [][]byte
	for _, r := range hdr.Receivers {
		if r.ReceiverKID != nil {
			kids = append(kids, r.ReceiverKID)
		}
	}

	i, sk := ds.ring.LookupBoxSecretKey(kids)
	if i < 0 || sk == nil {
		return nil, nil, nil, -1, nil
	}

	// Decrypt the sender's public key
	shared := sk.Precompute(ephemeralKey)
	keysRaw, err := shared.Unbox(ds.nonce.ForKeyBox(), hdr.Receivers[i].Keys)
	if err != nil {
		return nil, nil, nil, -1, err
	}

	return sk, shared, keysRaw, i, err
}

func (ds *decryptStream) tryHiddenReceivers(hdr *EncryptionHeader, ephemeralKey BoxPublicKey) (BoxSecretKey, BoxPrecomputedSharedKey, []byte, int) {
	secretKeys := ds.ring.GetAllSecretKeys()

	for _, secretKey := range secretKeys {
		shared := secretKey.Precompute(ephemeralKey)

		for i, r := range hdr.Receivers {
			keysRaw, err := shared.Unbox(ds.nonce.ForKeyBox(), r.Keys)
			if err == nil {
				return secretKey, shared, keysRaw, i
			}
		}
	}

	return nil, nil, nil, -1
}

func (ds *decryptStream) processEncryptionHeader(hdr *EncryptionHeader) error {
	if err := hdr.validate(); err != nil {
		return err
	}

	ephemeralKey := ds.ring.ImportEphemeralKey(hdr.Sender)
	if ephemeralKey == nil {
		return ErrBadEphemeralKey
	}

	ds.nonce = NewNonceForEncryption(ephemeralKey)

	var secretKey BoxSecretKey
	var keysPacked []byte
	var err error

	secretKey, ds.tagKey, keysPacked, ds.position, err = ds.tryVisibleReceivers(hdr, ephemeralKey)
	if err != nil {
		return err
	}
	if secretKey == nil {
		secretKey, ds.tagKey, keysPacked, ds.position = ds.tryHiddenReceivers(hdr, ephemeralKey)
	}
	if secretKey == nil || ds.position < 0 {
		return ErrNoDecryptionKey
	}

	var keys receiverKeysPlaintext
	if err = decodeFromBytes(&keys, keysPacked); err != nil {
		return err
	}

	if err := verifyRawKey(keys.Sender); err != nil {
		return err
	}

	// Lookup the sender's public key in our keyring, and import
	// it for use. However, if the sender key is the same as the ephemeral
	// key, then assume "anonymous mode", so use the already imported anonymous
	// key.
	if !hmac.Equal(hdr.Sender, keys.Sender) {
		longLivedSenderKey := ds.ring.LookupBoxPublicKey(keys.Sender)
		if longLivedSenderKey == nil {
			return ErrNoSenderKey
		}
		ds.tagKey = secretKey.Precompute(longLivedSenderKey)
	}

	copy(ds.sessionKey[:], keys.SessionKey)

	return nil
}

func (ds *decryptStream) processEncryptionBlock(bl *EncryptionBlock) ([]byte, error) {

	blockNum := encryptionBlockNumber(bl.seqno - 1)

	if err := blockNum.check(); err != nil {
		return nil, err
	}

	nonce := ds.nonce.ForPayloadBox(blockNum)

	tag, err := ds.tagKey.Unbox(nonce, bl.TagCiphertexts[ds.position])
	if err != nil {
		return nil, ErrBadTag(bl.seqno)
	}

	ciphertext := append(tag, bl.PayloadCiphertext...)
	plaintext, ok := secretbox.Open([]byte{}, ciphertext, (*[24]byte)(nonce), (*[32]byte)(&ds.sessionKey))
	if !ok {
		return nil, ErrBadCiphertext(bl.seqno)
	}

	// The encoding of the empty buffer implies the EOF.  But otherwise, all mechanisms are the same.
	if len(plaintext) == 0 {
		return nil, nil
	}
	return plaintext, nil
}

// NewDecryptStream starts a streaming decryption. You should give it an io.Writer
// to write plaintext output to, and also a Keyring to lookup private and public keys
// as necessary. The stream will only ever write validated data.  It returns
// an io.Writer that you can write the ciphertext stream to, and an error if anything
// goes wrong in the construction process.
func NewDecryptStream(r io.Reader, keyring Keyring) (ds io.Reader, err error) {
	ds = &decryptStream{
		ring: keyring,
		fmps: newFramedMsgpackStream(r),
	}
	return ds, nil
}

// Open simply opens a ciphertext given the set of keys in the specified keyring.
// It return a plaintext on sucess, and an error on failure.
func Open(ciphertext []byte, keyring Keyring) (plaintext []byte, err error) {
	buf := bytes.NewBuffer(ciphertext)
	plaintextStream, err := NewDecryptStream(buf, keyring)
	if err != nil {
		return nil, err
	}
	return ioutil.ReadAll(plaintextStream)
}
