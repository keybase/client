// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	"io"
	"io/ioutil"

	"golang.org/x/crypto/nacl/secretbox"
)

type decryptStream struct {
	ring       Keyring
	mps        *msgpackStream
	err        error
	state      readState
	keys       *receiverKeysPlaintext
	sessionKey SymmetricKey
	buf        []byte
	nonce      *Nonce
	tagKey     BoxPrecomputedSharedKey
	position   int
	mki        MessageKeyInfo
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
		ds.err = assertEndOfStream(ds.mps)
		if ds.err != nil {
			return 0, ds.err
		}
	}

	return n, nil
}

func (ds *decryptStream) readHeader() error {
	var hdr EncryptionHeader
	seqno, err := ds.mps.Read(&hdr)
	if err != nil {
		return err
	}
	hdr.seqno = seqno
	err = ds.processEncryptionHeader(&hdr)
	if err != nil {
		return err
	}
	ds.state = stateBody
	return nil
}

func (ds *decryptStream) readBlock(b []byte) (n int, lastBlock bool, err error) {
	var eb EncryptionBlock
	var seqno PacketSeqno
	seqno, err = ds.mps.Read(&eb)
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

func (ds *decryptStream) tryVisibleReceivers(hdr *EncryptionHeader, ephemeralKey BoxPublicKey) (BoxSecretKey, BoxPrecomputedSharedKey, []byte, int, error) {
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
		return nil, nil, nil, -1, nil
	}

	// Decrypt the sender's public key
	shared := sk.Precompute(ephemeralKey)

	orig, ok := tab[i]
	if !ok {
		return nil, nil, nil, -1, ErrBadLookup
	}

	keysRaw, err := shared.Unbox(ds.nonce.ForKeyBox(), hdr.Receivers[orig].Keys)
	if err != nil {
		return nil, nil, nil, -1, err
	}

	return sk, shared, keysRaw, orig, err
}

func (ds *decryptStream) tryHiddenReceivers(hdr *EncryptionHeader, ephemeralKey BoxPublicKey) (BoxSecretKey, BoxPrecomputedSharedKey, []byte, int) {
	secretKeys := ds.ring.GetAllSecretKeys()

	for _, r := range hdr.Receivers {
		if len(r.ReceiverKID) == 0 {
			ds.mki.NumAnonReceivers++
		}
	}

	for _, secretKey := range secretKeys {

		shared := secretKey.Precompute(ephemeralKey)

		for i, r := range hdr.Receivers {
			if len(r.ReceiverKID) == 0 {
				keysRaw, err := shared.Unbox(ds.nonce.ForKeyBox(), r.Keys)
				if err == nil {
					return secretKey, shared, keysRaw, i
				}
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
		ds.mki.ReceiverIsAnon = true
	}
	if secretKey == nil || ds.position < 0 {
		return ErrNoDecryptionKey
	}
	ds.mki.ReceiverKey = secretKey

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
		ds.mki.SenderKey = longLivedSenderKey
	} else {
		ds.mki.SenderIsAnon = true
		ds.mki.SenderKey = ephemeralKey
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
func NewDecryptStream(r io.Reader, keyring Keyring) (mki *MessageKeyInfo, plaintext io.Reader, err error) {
	ds := &decryptStream{
		ring: keyring,
		mps:  newMsgpackStream(r),
	}

	err = ds.readHeader()
	if err != nil {
		return &ds.mki, nil, err
	}

	return &ds.mki, ds, nil
}

// Open simply opens a ciphertext given the set of keys in the specified keyring.
// It returns a plaintext on sucess, and an error on failure. It returns the header's
// MessageKeyInfo in either case.
func Open(ciphertext []byte, keyring Keyring) (i *MessageKeyInfo, plaintext []byte, err error) {
	buf := bytes.NewBuffer(ciphertext)
	mki, plaintextStream, err := NewDecryptStream(buf, keyring)
	if err != nil {
		return mki, nil, err
	}
	ret, err := ioutil.ReadAll(plaintextStream)
	if err != nil {
		return nil, nil, err
	}
	return mki, ret, err
}
