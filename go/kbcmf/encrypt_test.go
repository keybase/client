// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"golang.org/x/crypto/nacl/box"
	"testing"
)

type boxPublicKey struct {
	key RawBoxKey
}

type boxSecretKey struct {
	pub boxPublicKey
	key RawBoxKey
}

type keyring struct {
	keys map[string]BoxSecretKey
}

func newKeyring() *keyring {
	return &keyring{
		keys: make(map[string]BoxSecretKey),
	}
}

func (r *keyring) insert(k BoxSecretKey) {
	r.keys[hex.EncodeToString(k.GetPublicKey().ToKID())] = k
}

func (r *keyring) LookupBoxPublicKey(kid []byte) BoxPublicKey {
	priv := r.keys[hex.EncodeToString(kid)]
	if priv == nil {
		return nil
	}
	return priv.GetPublicKey()
}

func (r *keyring) LookupBoxSecretKey(kids [][]byte) (int, BoxSecretKey) {
	for i, kid := range kids {
		if key, _ := r.keys[hex.EncodeToString(kid)]; key != nil {
			return i, key
		}
	}
	return -1, nil
}

func (b boxPublicKey) ToRawBoxKeyPointer() *RawBoxKey {
	return &b.key
}

func (b boxPublicKey) ToKID() []byte {
	return b.key[:]
}

func (b boxSecretKey) GetPublicKey() BoxPublicKey {
	return b.pub
}

func (b boxSecretKey) Box(receiver BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error) {
	var tmp [32]byte
	box.Precompute(&tmp, (*[32]byte)(receiver.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	ret := box.Seal([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(receiver.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	return ret, nil
}

var errPublicKeyDecryptionFailed = errors.New("public key decryption failed")

func (b boxSecretKey) Unbox(sender BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error) {
	var tmp [32]byte
	box.Precompute(&tmp, (*[32]byte)(sender.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	out, ok := box.Open([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(sender.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	if !ok {
		return nil, errPublicKeyDecryptionFailed
	}
	return out, nil
}

var kr = newKeyring()

func newBoxKeyNoInsert(t *testing.T) *boxSecretKey {
	pk, sk, err := box.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("In gen key: %s", err)
	}
	var tmp [32]byte
	box.Precompute(&tmp, pk, sk)
	ret := &boxSecretKey{}
	copy(ret.key[:], (*sk)[:])
	copy(ret.pub.key[:], (*pk)[:])
	return ret
}

func newBoxKey(t *testing.T) *boxSecretKey {
	ret := newBoxKeyNoInsert(t)
	kr.insert(ret)
	return ret
}

func TestSmallEncryptionOneReceiver(t *testing.T) {
	msg := []byte("secret message!")
	testRoundTrip(t, msg, nil, nil)
}

func TestMediumEncryptionOneReceiver(t *testing.T) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, nil)
}

func TestBiggishEncryptionOneReceiver(t *testing.T) {
	buf := make([]byte, 1024*100)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, nil)
}

type options struct {
	writeSize int
}

func randomMsg(t *testing.T, sz int) []byte {
	out := make([]byte, sz)
	if _, err := rand.Read(out); err != nil {
		t.Fatal(err)
	}
	return out
}

func testRealEncryptor(t *testing.T, sz int) {
	msg := make([]byte, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	var out bytes.Buffer
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	strm, err := NewPublicEncryptStream(&out, *sndr, receivers)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := strm.Write(msg); err != nil {
		t.Fatal(err)
	}
	if err := strm.Close(); err != nil {
		t.Fatal(err)
	}

	var out2 bytes.Buffer
	strm2, err := NewPublicDecryptStream(&out2, kr)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := strm2.Write(out.Bytes()); err != nil {
		t.Fatal(err)
	}

	if err := strm2.Close(); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out2.Bytes(), msg) {
		t.Fatal("decryption mismatch")
	}
}

func TestRealEncryptorSmall(t *testing.T) {
	testRealEncryptor(t, 101)
}

func TestRealEncryptorBig(t *testing.T) {
	testRealEncryptor(t, 1024*1024*3)
}

func testRoundTrip(t *testing.T, msg []byte, receivers [][]BoxPublicKey, opts *options) {
	sndr := newBoxKey(t)
	var out bytes.Buffer
	if receivers == nil {
		receivers = [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	}
	strm, err := newTestPublicEncryptStream(&out, *sndr, receivers,
		testEncryptionOptions{blockSize: 1024})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := strm.Write(msg); err != nil {
		t.Fatal(err)
	}
	if err := strm.Close(); err != nil {
		t.Fatal(err)
	}

	var out2 bytes.Buffer
	strm2, err := NewPublicDecryptStream(&out2, kr)
	if err != nil {
		t.Fatal(err)
	}

	if opts != nil && opts.writeSize != 0 {
		buf := out.Bytes()
		for len(buf) > 0 {
			end := opts.writeSize
			if end > len(buf) {
				end = len(buf)
			}
			if n, err := strm2.Write(buf[0:end]); err != nil {
				t.Fatal(err)
			} else {
				buf = buf[n:]
			}
		}
	} else {
		if _, err := strm2.Write(out.Bytes()); err != nil {
			t.Fatal(err)
		}
	}

	if err := strm2.Close(); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out2.Bytes(), msg) {
		t.Fatal("decryption mismatch")
	}
}

func TestRoundTripMedium6Receivers(t *testing.T) {
	msg := make([]byte, 1024*3)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKey(t).GetPublicKey(),
		},
	}
	testRoundTrip(t, msg, receivers, nil)
}

func TestRoundTripSmall6Receivers(t *testing.T) {
	msg := []byte("hoppy halloween")
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKey(t).GetPublicKey(),
		},
	}
	testRoundTrip(t, msg, receivers, nil)
}

func TestReceiverNotFound(t *testing.T) {
	sndr := newBoxKey(t)
	msg := []byte("those who die stay with us forever, as bones")
	var out bytes.Buffer
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
	}

	strm, err := newTestPublicEncryptStream(&out, *sndr, receivers,
		testEncryptionOptions{blockSize: 1024})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := strm.Write(msg); err != nil {
		t.Fatal(err)
	}
	if err := strm.Close(); err != nil {
		t.Fatal(err)
	}

	var out2 bytes.Buffer
	strm2, err := NewPublicDecryptStream(&out2, kr)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := strm2.Write(out.Bytes()); err != ErrNoDecryptionKey {
		t.Fatal("exepcted an ErrNoDecryptionkey")
	}
}

func TestTruncation(t *testing.T) {
	sndr := newBoxKey(t)
	var out bytes.Buffer
	msg := []byte("this message is going to be truncated")
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	strm, err := newTestPublicEncryptStream(&out, *sndr, receivers,
		testEncryptionOptions{blockSize: 1024})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := strm.Write(msg); err != nil {
		t.Fatal(err)
	}
	if err := strm.Close(); err != nil {
		t.Fatal(err)
	}

	var out2 bytes.Buffer
	strm2, err := NewPublicDecryptStream(&out2, kr)
	if err != nil {
		t.Fatal(err)
	}
	ciphertext := out.Bytes()
	trunced1 := ciphertext[0 : len(ciphertext)-51]

	if _, err := strm2.Write(trunced1); err != nil {
		t.Fatal(err)
	}
	if err := strm2.Close(); err != ErrUnexpectedEOF {
		t.Fatalf("Wanted an ErrUnexpectedEOF; got %v\n", err)
	}
}

func TestMediumEncryptionOneReceiverSmallWrites(t *testing.T) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, &options{writeSize: 1})
}

func TestMediumEncryptionOneReceiverSmallishWrites(t *testing.T) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, &options{writeSize: 7})
}

func TestMediumEncryptionOneReceiverMediumWrites(t *testing.T) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, &options{writeSize: 79})
}

func testSealAndOpen(t *testing.T, sz int) {
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	plaintext := make([]byte, sz)
	if _, err := rand.Read(plaintext); err != nil {
		t.Fatal(err)
	}
	ciphertext, err := Seal(plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}
	plaintext2, err := Open(ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatal("decryption mismatch")
	}
}

func TestSealAndOpenSmall(t *testing.T) {
	testSealAndOpen(t, 103)
}

func TestSealAndOpenBig(t *testing.T) {
	testSealAndOpen(t, 1024*1024*3)
}

func TestSealAndOpenTwoGroups(t *testing.T) {
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{newBoxKeyNoInsert(t).GetPublicKey()},
		[]BoxPublicKey{newBoxKey(t).GetPublicKey()},
	}
	plaintext := make([]byte, 1024*10)
	if _, err := rand.Read(plaintext); err != nil {
		t.Fatal(err)
	}
	ciphertext, err := Seal(plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}
	plaintext2, err := Open(ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatal("decryption mismatch")
	}
}

func TestRepeatedKey(t *testing.T) {
	sender := newBoxKey(t)
	pk := newBoxKey(t).GetPublicKey()
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{pk},
		[]BoxPublicKey{pk},
	}
	plaintext := randomMsg(t, 1024*3)
	_, err := Seal(plaintext, sender, receivers)
	if _, ok := err.(ErrRepeatedKey); !ok {
		t.Fatalf("Wanted a repeated key error; got %v", err)
	}
}

func TestCorruptHeaderNonce(t *testing.T) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptHeaderNonce: func(n *Nonce, gid int, rid int) {
			(*n)[4] ^= 1
		},
	}
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Wanted an error %v; got %v", errPublicKeyDecryptionFailed, err)
	}
}

func TestCorruptHeaderNonceG2R1(t *testing.T) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptHeaderNonce: func(n *Nonce, gid int, rid int) {
			if gid == 2 && rid == 1 {
				(*n)[4] ^= 1
			}
		},
	}
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKey(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
	}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Wanted an error %v; got %v", errPublicKeyDecryptionFailed, err)
	}

	// If someone else's encryption was tampered with, we don't care and
	// shouldn't get an error.
	teo = testEncryptionOptions{
		corruptHeaderNonce: func(n *Nonce, gid int, rid int) {
			if gid == 2 && rid == 3 {
				(*n)[4] ^= 1
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
}

func TestCorruptReceiverKeysCiphertextG2R1(t *testing.T) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptReceiverKeysCiphertext: func(rkc *receiverKeysCiphertext, gid int, rid int) {
			if gid == 2 && rid == 1 {
				rkc.Keys[35] ^= 1
			}
		},
	}
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKey(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
	}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Wanted an error %v; got %v", errPublicKeyDecryptionFailed, err)
	}

	// If someone else's encryption was tampered with, we don't care and
	// shouldn't get an error.
	teo = testEncryptionOptions{
		corruptReceiverKeysCiphertext: func(rkc *receiverKeysCiphertext, gid int, rid int) {
			if gid == 2 && rid == 2 {
				rkc.Keys[35] ^= 1
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
}

// TestCorruptRewceiverKeys tests what happens if the encryptor messes up in
// formulating the **plaintext** input of the encrypted session keys.  We try
// fiddling all of the keys below, in the case of multiple receivers in multiple
// groups.
func TestCorruptReceiverKeysPlaintextG1R0(t *testing.T) {
	msg := randomMsg(t, 129)

	// First try to supply a bogus group ID that's out of bounds.
	teo := testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == 1 && rid == 0 {
				rkp.GroupID = 100
			}
		},
	}
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{
			newBoxKeyNoInsert(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
		[]BoxPublicKey{
			newBoxKey(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
	}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if badgroup, ok := err.(ErrBadGroupID); !ok {
		t.Fatalf("Wanted a 'Bad Group ID' error")
	} else if int(badgroup) != 100 {
		t.Fatalf("Wrong bad group (wanted 100, got %d)", badgroup)
	}

	// Now supply the wrong group ID
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == 1 && rid == 0 {
				rkp.GroupID = 0
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrMACMismatch); !ok {
		t.Fatalf("Wanted MAC mismatch error but got %v", err)
	} else if int(mm) != 1 {
		t.Fatalf("Wanted a failure in packet %d, but got %d", 1, mm)
	}

	// Now zero out the MAC key even though one was explicitly promised for
	// this operation.
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == 1 && rid == 0 {
				rkp.MACKey = nil
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != ErrNoGroupMACKey {
		t.Fatalf("Got wrong error; wanted %v but got %v", ErrNoGroupMACKey, err)
	}

	// Now corrupt the MAC key
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == 1 && rid == 0 {
				rkp.MACKey[3] ^= 1
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrMACMismatch); !ok {
		t.Fatalf("Got wrong error; wanted MAC mismatch but got %v", err)
	} else if int(mm) != 1 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 1, mm)
	}

	// Finally let's corrupt the session key
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == 1 && rid == 0 {
				sk := make([]byte, len(rkp.SessionKey))
				copy(sk, rkp.SessionKey)
				sk[3] ^= 1
				rkp.SessionKey = sk
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrBadCiphertext); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Ciphertext' but got %v", err)
	} else if int(mm) != 1 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 1, mm)
	}

}

func TestCorruptReceiverKeysPlaintextOneGroup(t *testing.T) {
	msg := randomMsg(t, 129)

	// First try to supply a bogus group ID that's out of bounds.
	teo := testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == -1 && rid == 0 {
				rkp.GroupID = 100
			}
		},
	}
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{
		[]BoxPublicKey{
			newBoxKey(t).GetPublicKey(),
			newBoxKeyNoInsert(t).GetPublicKey(),
		},
	}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if badgroup, ok := err.(ErrBadGroupID); !ok {
		t.Fatalf("Wanted a 'Bad Group ID' error; got %v", err)
	} else if int(badgroup) != 100 {
		t.Fatalf("Wrong bad group (wanted 100, got %d)", badgroup)
	}

	// Now supply the wrong group ID
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == -1 && rid == 0 {
				rkp.GroupID = 0
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if bgid, ok := err.(ErrBadGroupID); !ok {
		t.Fatalf("Wanted MAC mismatch error but got %v", err)
	} else if int(bgid) != 0 {
		t.Fatalf("Wanted a failure in group %d, but got %d", 0, bgid)
	}

	// Now zero out the MAC key even though one was explicitly promised for
	// this operation.
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == -1 && rid == 0 {
				rkp.MACKey = make([]byte, 32)
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if eum, ok := err.(ErrUnexpectedMAC); !ok {
		t.Fatalf("Got wrong error; wanted 'Unexpected MAC' but got %v", err)
	} else if int(eum) != 1 {
		t.Fatalf("Got wrong packet; wanted %d but got %d", 1, eum)
	}

	// Finally let's corrupt the session key
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, gid int, rid int) {
			if gid == -1 && rid == 0 {
				sk := make([]byte, len(rkp.SessionKey))
				copy(sk, rkp.SessionKey)
				sk[3] ^= 1
				rkp.SessionKey = sk
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrBadCiphertext); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Ciphertext' but got %v", err)
	} else if int(mm) != 1 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 1, mm)
	}

}

func TestMissingFooter(t *testing.T) {
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	msg := randomMsg(t, 1024*9)
	ciphertext, err := testSeal(msg, sender, receivers, testEncryptionOptions{
		skipFooter: true,
		blockSize:  1024,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != ErrUnexpectedEOF {
		t.Fatalf("Wanted %v but got %v", ErrUnexpectedEOF, err)
	}
}

func TestCorruptEncryption(t *testing.T) {
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	msg := randomMsg(t, 1024*9)

	// First check that a corrupted ciphertext fails the Poly1305
	ciphertext, err := testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *EncryptionBlock, ebn encryptionBlockNumber) {
			if ebn == 2 {
				eb.Ciphertext[40] ^= 1
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrBadCiphertext); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Ciphertext' but got %v", err)
	} else if int(mm) != 3 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 3, mm)
	}

	// Next check that a corruption of the Poly1305 tags causes a failure
	ciphertext, err = testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *EncryptionBlock, ebn encryptionBlockNumber) {
			if ebn == 2 {
				eb.Ciphertext[2] ^= 1
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrBadCiphertext); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Ciphertext' but got %v", err)
	} else if int(mm) != 3 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 3, mm)
	}

	// Next check what happens if we mangle the Version
	ciphertext, err = testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *EncryptionBlock, ebn encryptionBlockNumber) {
			if ebn == 2 {
				eb.Version = PacketVersion(2)
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebv, ok := err.(ErrBadVersion); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Version' but got %v", err)
	} else if int(ebv.seqno) != 3 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 3, ebv.seqno)
	} else if ebv.received != PacketVersion(2) {
		t.Fatalf("got wrong version # in error message: %d", ebv.received)
	}

	// Next check what happens if we mangle the Tag
	ciphertext, err = testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *EncryptionBlock, ebn encryptionBlockNumber) {
			if ebn == 2 {
				eb.Tag = PacketTagEncryptionHeader
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebv, ok := err.(ErrWrongPacketTag); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Version' but got %v", err)
	} else if int(ebv.seqno) != 3 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 3, ebv.seqno)
	} else if ebv.wanted != PacketTagEncryptionBlock {
		t.Fatalf("got wrong version wanted in error message: %d", ebv.wanted)
	} else if ebv.received != PacketTagEncryptionHeader {
		t.Fatalf("got wrong version received error message: %d", ebv.received)
	}

	// Next check what happens if we mangle the MAC
	receivers = [][]BoxPublicKey{
		[]BoxPublicKey{newBoxKeyNoInsert(t).GetPublicKey()},
		[]BoxPublicKey{newBoxKey(t).GetPublicKey()},
	}
	ciphertext, err = testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *EncryptionBlock, ebn encryptionBlockNumber) {
			if ebn == 2 {
				eb.MACs[1][5] ^= 1
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrMACMismatch); !ok {
		t.Fatalf("Expected a 'MAC Mismatch' error but got %v", err)
	} else if int(mm) != 3 {
		t.Fatalf("Wanted error packet %d but got %d", 3, mm)
	}

	// Next check what happens if we swap macs for blocks 0 and 1 for 2 rewceivers
	msg = randomMsg(t, 1024*2-1)
	ciphertext, err = testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptNonce: func(n *Nonce, ebn encryptionBlockNumber) {
			var nn *Nonce
			switch ebn {
			case 1:
				nn = encryptionBlockNumber(0).newCounterNonce()
			case 0:
				nn = encryptionBlockNumber(1).newCounterNonce()
			case 2:
				nn = n
			default:
				t.Fatalf("didn't expected packet %d", ebn)
			}
			*n = *nn
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if emm, ok := err.(ErrMACMismatch); !ok {
		t.Fatalf("Expected a 'mac mismatch' error but got %v", err)
	} else if int(emm) != 1 {
		t.Fatalf("Wanted error packet %d but got %d", 1, emm)
	}

	// Next check what happens if we swap macs for blocks 0 and 1 for 1 receiver
	msg = randomMsg(t, 1024*2-1)
	receivers = [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	ciphertext, err = testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptNonce: func(n *Nonce, ebn encryptionBlockNumber) {
			var nn *Nonce
			switch ebn {
			case 1:
				nn = encryptionBlockNumber(0).newCounterNonce()
			case 0:
				nn = encryptionBlockNumber(1).newCounterNonce()
			case 2:
				nn = n
			default:
				t.Fatalf("didn't expected packet %d", ebn)
			}
			*n = *nn
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebct, ok := err.(ErrBadCiphertext); !ok {
		t.Fatalf("Expected a 'bad ciphertext' error but got %v", err)
	} else if int(ebct) != 1 {
		t.Fatalf("Wanted error packet %d but got %d", 1, ebct)
	}
}

func TestCorruptNonce(t *testing.T) {
	msg := randomMsg(t, 1024*11)
	teo := testEncryptionOptions{
		blockSize: 1024,
		corruptNonce: func(n *Nonce, ebn encryptionBlockNumber) {
			if ebn == 2 {
				(*n)[23]++
			}
		},
	}
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if bcte, ok := err.(ErrBadCiphertext); !ok {
		t.Fatalf("Wanted error 'ErrBadCiphertext' but got %v", err)
	} else if int(bcte) != 3 {
		t.Fatalf("wrong packet; wanted %d but got %d", 3, bcte)
	}
}

func TestCorruptHeader(t *testing.T) {
	msg := randomMsg(t, 1024*11)

	// Test bad Header version
	teo := testEncryptionOptions{
		blockSize: 1024,
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Version = PacketVersion(2)
		},
	}
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebv, ok := err.(ErrBadVersion); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Version' but got %v", err)
	} else if int(ebv.seqno) != 0 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 0, ebv.seqno)
	} else if ebv.received != PacketVersion(2) {
		t.Fatalf("got wrong version # in error message: %d", ebv.received)
	}

	// Test bad header Tag
	teo = testEncryptionOptions{
		blockSize: 1024,
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Tag = PacketTagEncryptionBlock
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebv, ok := err.(ErrWrongPacketTag); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Version' but got %v", err)
	} else if int(ebv.seqno) != 0 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 0, ebv.seqno)
	} else if ebv.wanted != PacketTagEncryptionHeader {
		t.Fatalf("got wrong wanted in error message: %d", ebv.wanted)
	} else if ebv.received != PacketTagEncryptionBlock {
		t.Fatalf("got wrong received in error message: %d", ebv.received)
	}

	// Test bad Nonce length
	teo = testEncryptionOptions{
		blockSize: 1024,
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Nonce = make([]byte, 24)
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebn, ok := err.(ErrBadNonce); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Nonce' but got %v", err)
	} else if int(ebn.seqno) != 0 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 0, ebn.seqno)
	} else if ebn.byteLen != 24 {
		t.Fatalf("got wrong byte len in message: %d", ebn.byteLen)
	}
}

func TestNoSenderKey(t *testing.T) {
	sender := newBoxKeyNoInsert(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	msg := randomMsg(t, 1024*9)
	ciphertext, err := testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != ErrNoSenderKey {
		t.Fatalf("Wanted %v but got %v", ErrNoSenderKey, err)
	}
}

func TestSealAndOpenTrailingGarbage(t *testing.T) {
	sender := newBoxKey(t)
	receivers := [][]BoxPublicKey{{newBoxKey(t).GetPublicKey()}}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	buf.Write(ciphertext)
	encodeNewPacket(&buf, randomMsg(t, 14))
	_, err = Open(buf.Bytes(), kr)
	if err != ErrTrailingGarbage {
		t.Fatalf("Wanted 'ErrTrailingGarbage' but got %v", err)
	}
}
