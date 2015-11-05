// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"crypto/hmac"
	"golang.org/x/crypto/nacl/secretbox"
	"io"
)

// Keyring is an interface used with decryption; it is call to recover
// public or private keys during the decryption process. Calls can block
// on network action.
type Keyring interface {
	// LookupBoxSecretKey looks in the Keyring for the secret key corresponding
	// to one of the given Key IDs.  Returns the index and the key on success,
	// or -1 and nil on failure.
	LookupBoxSecretKey(kids [][]byte) (int, BoxSecretKey)

	// LookupBoxPublicKey returns a public key given the specified key ID.
	// For most cases, the key ID will be the key itself.
	LookupBoxPublicKey(kid []byte) BoxPublicKey
}

type publicDecryptStream struct {
	output     io.Writer
	ring       Keyring
	fmps       *framedMsgpackStream
	err        error
	state      int
	keys       *receiverKeysPlaintext
	sessionKey SymmetricKey
}

func (pds *publicDecryptStream) Write(b []byte) (n int, err error) {
	if pds.err != nil {
		return 0, pds.err
	}
	if n, pds.err = pds.fmps.Write(b); pds.err != nil {
		return 0, pds.err
	}
	if pds.err = pds.decode(); pds.err != nil {
		return 0, pds.err
	}
	return n, nil
}

func (pds *publicDecryptStream) Close() (err error) {
	if pds.err != nil {
		return pds.err
	}
	if pds.err = pds.fmps.Close(); pds.err != nil {
		return pds.err
	}
	pds.err = pds.decode()
	return pds.err
}

func (pds *publicDecryptStream) decode() error {
	var err error
	var seqno PacketSeqno

	for err == nil {
		switch pds.state {
		case 0:
			var hdr EncryptionHeader
			seqno, err = pds.fmps.Decode(&hdr)
			if err == nil {
				hdr.seqno = seqno
				err = pds.processEncryptionHeader(&hdr)
				if err == nil {
					pds.state++
				}
			}
		case 1:
			var eb EncryptionBlock
			seqno, err = pds.fmps.Decode(&eb)
			var done bool
			if err == nil {
				eb.seqno = seqno
				done, err = pds.processEncryptionBlock(&eb)
				if err == nil && done {
					pds.state++
				}
			}
		case 2:
			var i interface{}
			_, err = pds.fmps.Decode(&i)
			if err == nil {
				err = ErrTrailingGarbage
			}
			if err == io.EOF {
				pds.state++
			}
		}
	}

	if err == errAgain {
		err = nil
	}

	// EOFs are only allowed in state 3; otherwise, it's a failure
	if err == io.EOF {
		if pds.state == 3 {
			err = nil
		} else {
			err = ErrUnexpectedEOF
		}
	}

	return err
}

func (pds *publicDecryptStream) processEncryptionHeader(hdr *EncryptionHeader) error {
	if err := hdr.validate(); err != nil {
		return err
	}
	var kids [][]byte
	for _, r := range hdr.Receivers {
		kids = append(kids, r.KID)
	}
	i, sk := pds.ring.LookupBoxSecretKey(kids)
	if sk == nil || i < 0 {
		return ErrNoDecryptionKey
	}
	pk := pds.ring.LookupBoxPublicKey(hdr.Sender)
	if pk == nil {
		return ErrNoSenderKey
	}
	var nonce Nonce
	copy(nonce[:], hdr.Nonce)
	nonce.writeCounter32(uint32(i))
	keysPacked, err := sk.Unbox(pk, &nonce, hdr.Receivers[i].Keys)
	if err != nil {
		return err
	}

	var keys receiverKeysPlaintext
	if err = decodeFromBytes(&keys, keysPacked); err != nil {
		return err
	}
	pds.keys = &keys
	copy(pds.sessionKey[:], pds.keys.SessionKey)

	return nil
}

func (pds *publicDecryptStream) checkMAC(bl *EncryptionBlock, b []byte) error {
	if pds.keys.GroupID < 0 {
		if len(pds.keys.MACKey) != 0 {
			return ErrUnexpectedMAC(bl.seqno)
		}
		return nil
	}
	if len(bl.MACs) <= pds.keys.GroupID {
		return ErrBadGroupID(pds.keys.GroupID)
	}

	if len(pds.keys.MACKey) == 0 {
		return ErrNoGroupMACKey
	}

	mac := hmacSHA512(pds.keys.MACKey, b)
	if !hmac.Equal(mac, bl.MACs[pds.keys.GroupID]) {
		return ErrMACMismatch(bl.seqno)
	}
	return nil
}

func (pds *publicDecryptStream) processEncryptionBlock(bl *EncryptionBlock) (bool, error) {
	if err := bl.validate(); err != nil {
		return false, err
	}

	if bl.seqno <= 0 {
		return false, errPacketUnderflow
	}

	blockNum := encryptionBlockNumber(bl.seqno - 1)

	if err := blockNum.check(); err != nil {
		return false, err
	}

	nonce := blockNum.newCounterNonce()

	if sum, err := hashNonceAndAuthTag(nonce, bl.Ciphertext); err != nil {
		return false, err
	} else if err := pds.checkMAC(bl, sum[:]); err != nil {
		return false, err
	}

	plaintext, ok := secretbox.Open([]byte{}, bl.Ciphertext, (*[24]byte)(nonce), (*[32]byte)(&pds.sessionKey))
	if !ok {
		return false, ErrBadCiphertext(bl.seqno)
	}

	// The encoding of the empty buffer implies the EOF.  But otherwise, all mechanisms are the same.
	if len(plaintext) == 0 {
		return true, nil
	}
	_, err := pds.output.Write(plaintext)
	return false, err

}

// NewPublicDecryptStream starts a streaming decryption. You should give it an io.Writer
// to write plaintext output to, and also a Keyring to lookup private and public keys
// as necessary. The stream will only ever write validated data.  It returns
// an io.Writer that you can write the ciphertext stream to, and an error if anything
// goes wrong in the construction process.
func NewPublicDecryptStream(plaintext io.Writer, keyring Keyring) (ciphertext io.WriteCloser, err error) {
	pds := &publicDecryptStream{
		output: plaintext,
		ring:   keyring,
		fmps:   new(framedMsgpackStream),
	}
	return pds, nil
}

// Open simply opens a ciphertext given the set of keys in the specified keyring.
// It return a plaintext on sucess, and an error on failure.
func Open(ciphertext []byte, keyring Keyring) (plaintext []byte, err error) {
	var buf bytes.Buffer
	ds, err := NewPublicDecryptStream(&buf, keyring)
	if err != nil {
		return nil, err
	}
	if _, err := ds.Write(ciphertext); err != nil {
		return nil, err
	}
	if err := ds.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
