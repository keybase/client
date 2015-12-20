// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"io/ioutil"
	"testing"

	"golang.org/x/crypto/nacl/box"
)

type boxPublicKey struct {
	key  RawBoxKey
	hide bool
}

type boxSecretKey struct {
	pub    boxPublicKey
	key    RawBoxKey
	isInit bool
	hide   bool
}

type keyring struct {
	keys      map[string]BoxSecretKey
	blacklist map[string]struct{}
	iterable  bool
}

func newKeyring() *keyring {
	return &keyring{
		keys:      make(map[string]BoxSecretKey),
		blacklist: make(map[string]struct{}),
	}
}

func (r *keyring) insert(k BoxSecretKey) {
	r.keys[hex.EncodeToString(k.GetPublicKey().ToKID())] = k
}

func (r *keyring) LookupBoxPublicKey(kid []byte) BoxPublicKey {
	if _, found := r.blacklist[hex.EncodeToString(kid)]; found {
		return nil
	}
	ret := boxPublicKey{}
	copy(ret.key[:], kid)
	return &ret
}

func (r *keyring) ImportEphemeralKey(kid []byte) BoxPublicKey {
	ret := &boxPublicKey{}
	if len(kid) != len(ret.key) {
		return nil
	}
	copy(ret.key[:], kid)
	return ret
}

func (r *keyring) GetAllSecretKeys() (ret []BoxSecretKey) {
	if r.iterable {
		for _, v := range r.keys {
			ret = append(ret, v)
		}
	}
	return ret
}

func (r *keyring) makeIterable() *keyring {
	return &keyring{
		keys:     r.keys,
		iterable: true,
	}
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

func (b boxPublicKey) HideIdentity() bool { return b.hide }

func (b boxSecretKey) GetPublicKey() BoxPublicKey {
	ret := b.pub
	ret.hide = b.hide
	return ret
}

type boxPrecomputedSharedKey RawBoxKey

func (b boxSecretKey) Precompute(pk BoxPublicKey) BoxPrecomputedSharedKey {
	var res boxPrecomputedSharedKey
	box.Precompute((*[32]byte)(&res), (*[32]byte)(pk.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	return res
}

func (b boxPrecomputedSharedKey) Unbox(nonce *Nonce, msg []byte) ([]byte, error) {
	out, ok := box.OpenAfterPrecomputation([]byte{}, msg, (*[24]byte)(nonce), (*[32]byte)(&b))
	if !ok {
		return nil, errPublicKeyDecryptionFailed
	}
	return out, nil
}

func (b boxPrecomputedSharedKey) Box(nonce *Nonce, msg []byte) ([]byte, error) {
	out := box.SealAfterPrecomputation([]byte{}, msg, (*[24]byte)(nonce), (*[32]byte)(&b))
	return out, nil
}

func (b boxSecretKey) Box(receiver BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error) {
	ret := box.Seal([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(receiver.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	return ret, nil
}

var errPublicKeyDecryptionFailed = errors.New("public key decryption failed")
var errPublicKeyEncryptionFailed = errors.New("public key encryption failed")

func (b boxSecretKey) Unbox(sender BoxPublicKey, nonce *Nonce, msg []byte) ([]byte, error) {
	out, ok := box.Open([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(sender.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	if !ok {
		return nil, errPublicKeyDecryptionFailed
	}
	return out, nil
}

var kr = newKeyring()

func (b boxPublicKey) CreateEphemeralKey() (BoxSecretKey, error) {
	pk, sk, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	ret := &boxSecretKey{hide: b.hide}
	copy(ret.key[:], (*sk)[:])
	copy(ret.pub.key[:], (*pk)[:])
	ret.isInit = true
	return ret, nil
}

func (b boxSecretKey) IsNull() bool { return !b.isInit }

func newHiddenBoxKeyNoInsert(t *testing.T) BoxSecretKey {
	ret, err := (boxPublicKey{hide: true}).CreateEphemeralKey()
	if err != nil {
		t.Fatalf("In gen key: %s", err)
	}
	return ret
}

func newHiddenBoxKey(t *testing.T) BoxSecretKey {
	ret := newHiddenBoxKeyNoInsert(t)
	kr.insert(ret)
	return ret
}

func newBoxKeyNoInsert(t *testing.T) BoxSecretKey {
	ret, err := (boxPublicKey{}).CreateEphemeralKey()
	if err != nil {
		t.Fatalf("In gen key: %s", err)
	}
	return ret
}

func newBoxKey(t *testing.T) BoxSecretKey {
	ret := newBoxKeyNoInsert(t)
	kr.insert(ret)
	return ret
}

func newBoxKeyBlacklistPublic(t *testing.T) BoxSecretKey {
	ret := newBoxKey(t)
	kr.blacklist[hex.EncodeToString(ret.GetPublicKey().ToKID())] = struct{}{}
	return ret
}

func randomMsg(t *testing.T, sz int) []byte {
	out := make([]byte, sz)
	if _, err := rand.Read(out); err != nil {
		t.Fatal(err)
	}
	return out
}

type options struct {
	readSize int
}

func slowRead(r io.Reader, sz int) ([]byte, error) {
	buf := make([]byte, sz)
	var res []byte
	for eof := false; !eof; {
		n, err := r.Read(buf)
		if n == 0 || err == io.EOF {
			eof = true
			break
		}
		if err != nil {
			return nil, err
		}
		res = append(res, buf[0:n]...)
	}
	return res, nil
}

func testRoundTrip(t *testing.T, msg []byte, receivers []BoxPublicKey, opts *options) {
	sndr := newBoxKey(t)
	var ciphertext bytes.Buffer
	if receivers == nil {
		receivers = []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	}
	strm, err := newTestEncryptStream(&ciphertext, sndr, receivers,
		testEncryptionOptions{blockSize: 1024})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = strm.Write(msg); err != nil {
		t.Fatal(err)
	}
	if err = strm.Close(); err != nil {
		t.Fatal(err)
	}

	plaintextStream, err := NewDecryptStream(&ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}

	var plaintext []byte
	if opts != nil && opts.readSize != 0 {
		plaintext, err = slowRead(plaintextStream, opts.readSize)
	} else {
		plaintext, err = ioutil.ReadAll(plaintextStream)
	}
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, msg) {
		t.Fatal("decryption mismatch")
	}
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

func testRealEncryptor(t *testing.T, sz int) {
	msg := make([]byte, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	var ciphertext bytes.Buffer
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	strm, err := NewEncryptStream(&ciphertext, sndr, receivers)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := strm.Write(msg); err != nil {
		t.Fatal(err)
	}
	if err := strm.Close(); err != nil {
		t.Fatal(err)
	}

	msg2, err := Open(ciphertext.Bytes(), kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(msg2, msg) {
		t.Fatal("decryption mismatch")
	}
}

func TestRealEncryptorSmall(t *testing.T) {
	testRealEncryptor(t, 101)
}

func TestRealEncryptorBig(t *testing.T) {
	testRealEncryptor(t, 1024*1024*3)
}

func TestRoundTripMedium6Receivers(t *testing.T) {
	msg := make([]byte, 1024*3)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
	}
	testRoundTrip(t, msg, receivers, nil)
}

func TestRoundTripSmall6Receivers(t *testing.T) {
	msg := []byte("hoppy halloween")
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
	}
	testRoundTrip(t, msg, receivers, nil)
}

func TestReceiverNotFound(t *testing.T) {
	sndr := newBoxKey(t)
	msg := []byte("those who die stay with us forever, as bones")
	var out bytes.Buffer
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
	}

	strm, err := newTestEncryptStream(&out, sndr, receivers,
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
	_, err = Open(out.Bytes(), kr)
	if err != ErrNoDecryptionKey {
		t.Fatalf("expected an ErrNoDecryptionkey; got %v", err)
	}
}

func TestTruncation(t *testing.T) {
	sndr := newBoxKey(t)
	var out bytes.Buffer
	msg := []byte("this message is going to be truncated")
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	strm, err := newTestEncryptStream(&out, sndr, receivers,
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

	ciphertext := out.Bytes()
	trunced1 := ciphertext[0 : len(ciphertext)-51]
	_, err = Open(trunced1, kr)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("Wanted an %v; but got %v\n", io.ErrUnexpectedEOF, err)
	}
}

func TestMediumEncryptionOneReceiverSmallReads(t *testing.T) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, &options{readSize: 1})
}

func TestMediumEncryptionOneReceiverSmallishReads(t *testing.T) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, &options{readSize: 7})
}

func TestMediumEncryptionOneReceiverMediumReads(t *testing.T) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, buf, nil, &options{readSize: 79})
}

func testSealAndOpen(t *testing.T, sz int) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
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

func TestSealAndOpenTwoReceivers(t *testing.T) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
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
	receivers := []BoxPublicKey{pk, pk}
	plaintext := randomMsg(t, 1024*3)
	_, err := Seal(plaintext, sender, receivers)
	if _, ok := err.(ErrRepeatedKey); !ok {
		t.Fatalf("Wanted a repeated key error; got %v", err)
	}
}

func TestEmptyReceivers(t *testing.T) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{}
	plaintext := randomMsg(t, 1024*3)
	_, err := Seal(plaintext, sender, receivers)
	if err != ErrBadReceivers {
		t.Fatalf("Wanted error %v but got %v\n", ErrBadReceivers, err)
	}
}

func TestCorruptHeaderNonce(t *testing.T) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptKeysNonce: func(n *Nonce, rid int) *Nonce {
			ret := *n
			ret[4] ^= 1
			return &ret
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Wanted an error %v; got %v", errPublicKeyDecryptionFailed, err)
	}
}

func TestCorruptHeaderNonceR5(t *testing.T) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptKeysNonce: func(n *Nonce, rid int) *Nonce {
			if rid == 5 {
				ret := *n
				ret[4] ^= 1
				return &ret
			}
			return n
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
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
		corruptKeysNonce: func(n *Nonce, rid int) *Nonce {
			if rid != 5 {
				ret := *n
				ret[4] ^= 1
				return &ret
			}
			return n
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

func TestCorruptReceiverKeysCiphertextR5(t *testing.T) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptReceiverKeysCiphertext: func(rkc *receiverKeysCiphertexts, rid int) {
			if rid == 5 {
				rkc.Keys[35] ^= 1
			}
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
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
		corruptReceiverKeysCiphertext: func(rkc *receiverKeysCiphertexts, rid int) {
			if rid != 5 {
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
// fiddling all of the keys below, in the case of multiple receivers.
func TestCorruptReceiverKeysPlaintext(t *testing.T) {
	msg := randomMsg(t, 129)

	// First try to supply a bogus group ID that's out of bounds.
	teo := testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, rid int) {
			if rid == 2 {
				rkp.Sender[3] ^= 1
			}
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
	}

	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}

	// If we've corrupted the sender key, the first thing that will fail is the
	// Tag check for this receiver on packet #1.
	_, err = Open(ciphertext, kr)
	if ebt, ok := err.(ErrBadTag); !ok || int(ebt) != 1 {
		t.Fatalf("Got wrong error; wanted %v but got %v", ErrNoSenderKey, ErrBadTag(1))
	}

	// Finally let's corrupt the session key
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, rid int) {
			if rid == 2 {
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

	// Test Bad Sender Key
	teo = testEncryptionOptions{
		corruptReceiverKeysPlaintext: func(rkp *receiverKeysPlaintext, rid int) {
			if rid == 2 {
				rkp.Sender = rkp.Sender[0 : len(rkp.Sender)-1]
			}
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != ErrBadSenderKey {
		t.Fatalf("Bad error: wanted %v but got %v", ErrBadSenderKey, err)
	}
}

func TestMissingFooter(t *testing.T) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	msg := randomMsg(t, 1024*9)
	ciphertext, err := testSeal(msg, sender, receivers, testEncryptionOptions{
		skipFooter: true,
		blockSize:  1024,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("Wanted %v but got %v", io.ErrUnexpectedEOF, err)
	}
}

func TestCorruptEncryption(t *testing.T) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	msg := randomMsg(t, 1024*9)

	// First check that a corrupted ciphertext fails the Poly1305
	ciphertext, err := testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *EncryptionBlock, ebn encryptionBlockNumber) {
			if ebn == 2 {
				eb.PayloadCiphertext[8] ^= 1
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
				eb.TagCiphertexts[0][2] ^= 1
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if mm, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Tag; failed Poly1305' but got %v", err)
	} else if int(mm) != 3 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 3, mm)
	}

	// Next check what happens if we swap nonces for blocks 0 and 1
	msg = randomMsg(t, 1024*2-1)
	ciphertext, err = testSeal(msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptPayloadNonce: func(n *Nonce, ebn encryptionBlockNumber) *Nonce {
			switch ebn {
			case 1:
				tmp := *n
				return tmp.ForPayloadBox(encryptionBlockNumber(0))
			case 0:
				tmp := *n
				return tmp.ForPayloadBox(encryptionBlockNumber(1))
			}
			return n
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if emm, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Expected a 'bad tag' error but got %v", err)
	} else if int(emm) != 1 {
		t.Fatalf("Wanted error packet %d but got %d", 1, emm)
	}
}

func TestCorruptNonce(t *testing.T) {
	msg := randomMsg(t, 1024*11)
	teo := testEncryptionOptions{
		blockSize: 1024,
		corruptPayloadNonce: func(n *Nonce, ebn encryptionBlockNumber) *Nonce {
			if ebn == 2 {
				ret := *n
				ret[23]++
				return &ret
			}
			return n
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if bcte, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Wanted error 'ErrBadTag' but got %v", err)
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
			eh.Version.Major = 2
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	ciphertext, err := testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebv, ok := err.(ErrBadVersion); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Version' but got %v", err)
	} else if int(ebv.seqno) != 0 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 0, ebv.seqno)
	} else if ebv.received.Major != 2 {
		t.Fatalf("got wrong version # in error message: %v", ebv.received.Major)
	}

	// Test bad header Tag
	teo = testEncryptionOptions{
		blockSize: 1024,
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Type = MessageTypeAttachedSignature
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if ebv, ok := err.(ErrWrongMessageType); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Type' but got %v", err)
	} else if ebv.wanted != MessageTypeEncryption {
		t.Fatalf("got wrong wanted in error message: %d", ebv.wanted)
	} else if ebv.received != MessageTypeAttachedSignature {
		t.Fatalf("got wrong received in error message: %d", ebv.received)
	}

	// Corrupt Plaintext Keys after packing
	teo = testEncryptionOptions{
		blockSize: 1024,
		corruptReceiverKeysPlaintextPacked: func(b []byte, rid int) {
			b[0] = 0xff
			b[1] = 0xff
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err == nil || err.Error() != "only encoded map or array can be decoded into a struct" {
		t.Fatalf("wanted a msgpack decode error")
	}

	// Corrupt Header after packing
	teo = testEncryptionOptions{
		blockSize: 1024,
		corruptHeaderPacked: func(b []byte) {
			b[0] = 0xff
			b[1] = 0xff
			b[2] = 0xff
			b[3] = 0xff
		},
	}
	ciphertext, err = testSeal(msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err == nil || err.Error() != "only encoded map or array can be decoded into a struct" {
		t.Fatalf("wanted a msgpack decode error")
	}
}

func TestNoSenderKey(t *testing.T) {
	sender := newBoxKeyBlacklistPublic(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
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
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	buf.Write(ciphertext)
	newEncoder(&buf).Encode(randomMsg(t, 14))
	_, err = Open(buf.Bytes(), kr)
	if err != ErrTrailingGarbage {
		t.Fatalf("Wanted 'ErrTrailingGarbage' but got %v", err)
	}
}

func TestAnonymousSender(t *testing.T) {
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
}

func TestAllAnonymous(t *testing.T) {
	receivers := []BoxPublicKey{
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKey(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
	}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != ErrNoDecryptionKey {
		t.Fatalf("Got %v but wanted %v", err, ErrNoDecryptionKey)
	}
	_, err = Open(ciphertext, kr.makeIterable())
	if err != nil {
		t.Fatal(err)
	}

	receivers[5] = newHiddenBoxKeyNoInsert(t).GetPublicKey()
	ciphertext, err = Seal(plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr.makeIterable())
	if err != ErrNoDecryptionKey {
		t.Fatalf("Got %v but wanted %v", err, ErrNoDecryptionKey)
	}
}

func TestCorruptEmpheralKey(t *testing.T) {
	receivers := []BoxPublicKey{newHiddenBoxKey(t).GetPublicKey()}
	plaintext := randomMsg(t, 1024*3)
	teo := testEncryptionOptions{
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Sender = eh.Sender[0 : len(eh.Sender)-1]
		},
	}
	ciphertext, err := testSeal(plaintext, nil, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != ErrBadEphemeralKey {
		t.Fatalf("Got %v but wanted %v", err, ErrBadEphemeralKey)
	}
}

func TestCiphertextSwapKeys(t *testing.T) {
	receivers := []BoxPublicKey{
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKey(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
	}
	plaintext := randomMsg(t, 1024*3)
	teo := testEncryptionOptions{
		corruptHeader: func(h *EncryptionHeader) {
			h.Receivers[1].Keys, h.Receivers[0].Keys = h.Receivers[0].Keys, h.Receivers[1].Keys
		},
	}
	ciphertext, err := testSeal(plaintext, nil, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Got %v but wanted %v", err, errPublicKeyDecryptionFailed)
	}
}

func TestEmptyReceiverKID(t *testing.T) {
	receivers := []BoxPublicKey{
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKey(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
	}
	plaintext := randomMsg(t, 1024*3)
	teo := testEncryptionOptions{
		corruptReceiverKeysCiphertext: func(rkc *receiverKeysCiphertexts, rid int) {
			rkc.ReceiverKID = []byte{}
		},
	}
	ciphertext, err := testSeal(plaintext, nil, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Open(ciphertext, kr)
	if err != ErrNoDecryptionKey {
		t.Fatalf("Got %v but wanted %v", err, ErrNoDecryptionKey)
	}
}
