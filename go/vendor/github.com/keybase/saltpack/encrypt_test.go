// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"sort"
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
	sigKeys   map[string]SigningSecretKey
	blacklist map[string]struct{}
	iterable  bool
	bad       bool
}

func newKeyring() *keyring {
	return &keyring{
		keys:      make(map[string]BoxSecretKey),
		sigKeys:   make(map[string]SigningSecretKey),
		blacklist: make(map[string]struct{}),
	}
}

func (r *keyring) insert(k BoxSecretKey) {
	r.keys[hex.EncodeToString(k.GetPublicKey().ToKID())] = k
}

func (r *keyring) insertSigningKey(k SigningSecretKey) {
	r.sigKeys[hex.EncodeToString(k.GetPublicKey().ToKID())] = k
}

func (r *keyring) LookupBoxPublicKey(kid []byte) BoxPublicKey {
	if _, found := r.blacklist[hex.EncodeToString(kid)]; found {
		return nil
	}
	ret := boxPublicKey{key: sliceToByte32(kid)}
	return &ret
}

func (r *keyring) LookupSigningPublicKey(kid []byte) SigningPublicKey {
	key, ok := r.sigKeys[hex.EncodeToString(kid)]
	if !ok {
		return nil
	}
	return key.GetPublicKey()
}

func (r *keyring) ImportBoxEphemeralKey(kid []byte) BoxPublicKey {
	ret := &boxPublicKey{}
	if len(kid) != len(ret.key) {
		return nil
	}
	ret.key = sliceToByte32(kid)
	return ret
}

func (r *keyring) GetAllBoxSecretKeys() (ret []BoxSecretKey) {
	if r.iterable {
		for _, v := range r.keys {
			ret = append(ret, v)
		}
	}
	return ret
}

func (k *keyring) CreateEphemeralKey() (BoxSecretKey, error) {
	pk, sk, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	ret := &boxSecretKey{}
	ret.key = *sk
	ret.pub.key = *pk
	ret.isInit = true
	return ret, nil
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
			if r.bad {
				return (len(kids)*4 + i), key
			}
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

func (b boxSecretKey) Precompute(peer BoxPublicKey) BoxPrecomputedSharedKey {
	var res boxPrecomputedSharedKey
	box.Precompute((*[32]byte)(&res), (*[32]byte)(peer.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	return res
}

func (b boxPrecomputedSharedKey) Unbox(nonce Nonce, msg []byte) ([]byte, error) {
	out, ok := box.OpenAfterPrecomputation([]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(&b))
	if !ok {
		return nil, errPublicKeyDecryptionFailed
	}
	return out, nil
}

func (b boxPrecomputedSharedKey) Box(nonce Nonce, msg []byte) []byte {
	out := box.SealAfterPrecomputation([]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(&b))
	return out
}

func (b boxSecretKey) Box(receiver BoxPublicKey, nonce Nonce, msg []byte) []byte {
	ret := box.Seal([]byte{}, msg, (*[24]byte)(&nonce),
		(*[32]byte)(receiver.ToRawBoxKeyPointer()), (*[32]byte)(&b.key))
	return ret
}

var errPublicKeyDecryptionFailed = errors.New("public key decryption failed")
var errPublicKeyEncryptionFailed = errors.New("public key encryption failed")

func (b boxSecretKey) Unbox(sender BoxPublicKey, nonce Nonce, msg []byte) ([]byte, error) {
	out, ok := box.Open([]byte{}, msg, (*[24]byte)(&nonce),
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
	ret.key = *sk
	ret.pub.key = *pk
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
		res = append(res, buf[:n]...)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
	}
	return res, nil
}

func isValidNonTrivialPermutation(n int, a []int) bool {
	if len(a) != n {
		return false
	}
	// Technically this check is flaky, but the flake probability
	// is 1/n!, which is very small for n ~ 20.
	if sort.IntsAreSorted(a) {
		return false
	}

	aCopy := make([]int, len(a))
	copy(aCopy, a)
	sort.Ints(aCopy)
	for i := 0; i < len(a); i++ {
		if aCopy[i] != i {
			return false
		}
	}

	return true
}

func getEncryptReceiverOrder(receivers []BoxPublicKey) []int {
	order := make([]int, len(receivers))
	for i, r := range receivers {
		order[i] = int(r.(boxPublicKey).key[0])
	}
	return order
}

func TestShuffleEncryptReceivers(t *testing.T) {
	receiverCount := 20
	var receivers []BoxPublicKey
	for i := 0; i < receiverCount; i++ {
		k := boxPublicKey{
			key: RawBoxKey{byte(i)},
		}
		receivers = append(receivers, k)
	}

	shuffled := shuffleEncryptReceivers(receivers)

	shuffledOrder := getEncryptReceiverOrder(shuffled)
	if !isValidNonTrivialPermutation(receiverCount, shuffledOrder) {
		t.Fatalf("shuffledOrder == %+v is an invalid or trivial permutation", shuffledOrder)
	}
}

func getEncryptReceiverKeysOrder(receiverKeys []receiverKeys) []int {
	order := make([]int, len(receiverKeys))
	for i, k := range receiverKeys {
		order[i] = int(k.ReceiverKID[0])
	}
	return order
}

func testNewEncryptStreamShuffledReaders(t *testing.T, version Version) {
	receiverCount := 20
	var receivers []BoxPublicKey
	for i := 0; i < receiverCount; i++ {
		k := boxPublicKey{
			key: RawBoxKey{byte(i)},
		}
		receivers = append(receivers, k)
	}

	sndr := boxSecretKey{
		key: RawBoxKey{0x08},
	}
	var ciphertext bytes.Buffer
	_, err := NewEncryptStream(version, &ciphertext, sndr, receivers)
	if err != nil {
		t.Fatal(err)
	}

	var headerBytes []byte
	err = decodeFromBytes(&headerBytes, ciphertext.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	var header EncryptionHeader
	err = decodeFromBytes(&header, headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	shuffledOrder := getEncryptReceiverKeysOrder(header.Receivers)
	if !isValidNonTrivialPermutation(receiverCount, shuffledOrder) {
		t.Fatalf("shuffledOrder == %+v is an invalid or trivial permutation", shuffledOrder)
	}
}

func testRoundTrip(t *testing.T, version Version, msg []byte, receivers []BoxPublicKey, opts *options) {
	sndr := newBoxKey(t)
	var ciphertext bytes.Buffer
	if receivers == nil {
		receivers = []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	}
	strm, err := newTestEncryptStream(version, &ciphertext, sndr, receivers,
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

	_, plaintextStream, err := NewDecryptStream(SingleVersionValidator(version), &ciphertext, kr)
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
		t.Fatalf("decryption mismatch: %x != %x", plaintext, msg)
	}
}

func testEmptyEncryptionOneReceiver(t *testing.T, version Version) {
	msg := []byte{}
	testRoundTrip(t, version, msg, nil, nil)
}

func testSmallEncryptionOneReceiver(t *testing.T, version Version) {
	msg := []byte("secret message!")
	testRoundTrip(t, version, msg, nil, nil)
}

func testMediumEncryptionOneReceiver(t *testing.T, version Version) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, version, buf, nil, nil)
}

func testBiggishEncryptionOneReceiver(t *testing.T, version Version) {
	buf := make([]byte, 1024*100)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, version, buf, nil, nil)
}

func testRealEncryptor(t *testing.T, version Version, sz int) {
	msg := make([]byte, sz)
	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}
	sndr := newBoxKey(t)
	var ciphertext bytes.Buffer
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	strm, err := NewEncryptStream(version, &ciphertext, sndr, receivers)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := strm.Write(msg); err != nil {
		t.Fatal(err)
	}
	if err := strm.Close(); err != nil {
		t.Fatal(err)
	}

	mki, msg2, err := Open(SingleVersionValidator(version), ciphertext.Bytes(), kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(msg2, msg) {
		t.Fatal("decryption mismatch")
	}
	if mki.SenderIsAnon {
		t.Fatal("sender should't be anon")
	}
	if mki.ReceiverIsAnon {
		t.Fatal("receiver shouldn't be anon")
	}
	if !PublicKeyEqual(sndr.GetPublicKey(), mki.SenderKey) {
		t.Fatal("got wrong sender key")
	}
	if !PublicKeyEqual(receivers[0], mki.ReceiverKey.GetPublicKey()) {
		t.Fatal("wrong receiver key")
	}
	if mki.NumAnonReceivers != 0 {
		t.Fatal("wrong number of anon receivers")
	}
}

func testRealEncryptorSmall(t *testing.T, version Version) {
	testRealEncryptor(t, version, 101)
}

func testRealEncryptorBig(t *testing.T, version Version) {
	testRealEncryptor(t, version, 1024*1024*3)
}

func testRoundTripMedium6Receivers(t *testing.T, version Version) {
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
	testRoundTrip(t, version, msg, receivers, nil)
}

func testRoundTripSmall6Receivers(t *testing.T, version Version) {
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
	testRoundTrip(t, version, msg, receivers, nil)
}

func testReceiverNotFound(t *testing.T, version Version) {
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

	strm, err := newTestEncryptStream(version, &out, sndr, receivers,
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
	_, _, err = Open(SingleVersionValidator(version), out.Bytes(), kr)
	if err != ErrNoDecryptionKey {
		t.Fatalf("expected an ErrNoDecryptionkey; got %v", err)
	}
}

func testTruncation(t *testing.T, version Version) {
	sndr := newBoxKey(t)
	var out bytes.Buffer
	msg := []byte("this message is going to be truncated")
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	strm, err := newTestEncryptStream(version, &out, sndr, receivers,
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
	_, _, err = Open(SingleVersionValidator(version), trunced1, kr)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("Wanted an %v; but got %v", io.ErrUnexpectedEOF, err)
	}
}

func testMediumEncryptionOneReceiverSmallReads(t *testing.T, version Version) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, version, buf, nil, &options{readSize: 1})
}

func testMediumEncryptionOneReceiverSmallishReads(t *testing.T, version Version) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, version, buf, nil, &options{readSize: 7})
}

func testMediumEncryptionOneReceiverMediumReads(t *testing.T, version Version) {
	buf := make([]byte, 1024*10)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	testRoundTrip(t, version, buf, nil, &options{readSize: 79})
}

func testSealAndOpen(t *testing.T, version Version, sz int) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	plaintext := make([]byte, sz)
	if _, err := rand.Read(plaintext); err != nil {
		t.Fatal(err)
	}
	ciphertext, err := Seal(version, plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, plaintext2, err := Open(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatal("decryption mismatch")
	}
}

func testSealAndOpenSmall(t *testing.T, version Version) {
	testSealAndOpen(t, version, 103)
}

func testSealAndOpenBig(t *testing.T, version Version) {
	testSealAndOpen(t, version, 1024*1024*3)
}

func testSealAndOpenTwoReceivers(t *testing.T, version Version) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
	}
	plaintext := make([]byte, 1024*10)
	if _, err := rand.Read(plaintext); err != nil {
		t.Fatal(err)
	}
	ciphertext, err := Seal(version, plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, plaintext2, err := Open(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, plaintext2) {
		t.Fatal("decryption mismatch")
	}
}

func testRepeatedKey(t *testing.T, version Version) {
	sender := newBoxKey(t)
	pk := newBoxKey(t).GetPublicKey()
	receivers := []BoxPublicKey{pk, pk}
	plaintext := randomMsg(t, 1024*3)
	_, err := Seal(version, plaintext, sender, receivers)
	if _, ok := err.(ErrRepeatedKey); !ok {
		t.Fatalf("Wanted a repeated key error; got %v", err)
	}
}

func testEmptyReceivers(t *testing.T, version Version) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{}
	plaintext := randomMsg(t, 1024*3)
	_, err := Seal(version, plaintext, sender, receivers)
	if err != ErrBadReceivers {
		t.Fatalf("Wanted error %v but got %v", ErrBadReceivers, err)
	}
}

func testCorruptHeaderNonce(t *testing.T, version Version) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptKeysNonce: func(n Nonce, rid int) Nonce {
			ret := n
			ret[4] ^= 1
			return ret
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Wanted an error %v; got %v", errPublicKeyDecryptionFailed, err)
	}
}

func testCorruptHeaderNonceR5(t *testing.T, version Version) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptKeysNonce: func(n Nonce, rid int) Nonce {
			if rid == 5 {
				ret := n
				ret[4] ^= 1
				return ret
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
	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Wanted an error %v; got %v", errPublicKeyDecryptionFailed, err)
	}

	// If someone else's encryption was tampered with, we don't care and
	// shouldn't get an error.
	teo = testEncryptionOptions{
		corruptKeysNonce: func(n Nonce, rid int) Nonce {
			if rid != 5 {
				ret := n
				ret[4] ^= 1
				return ret
			}
			return n
		},
	}
	ciphertext, err = testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
}

func testCorruptPayloadKeyBoxR5(t *testing.T, version Version) {
	msg := randomMsg(t, 129)
	teo := testEncryptionOptions{
		corruptReceiverKeys: func(keys *receiverKeys, rid int) {
			if rid == 5 {
				keys.PayloadKeyBox[35] ^= 1
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
	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Wanted an error %v; got %v", errPublicKeyDecryptionFailed, err)
	}

	// If someone else's encryption was tampered with, we don't care and
	// shouldn't get an error.
	teo = testEncryptionOptions{
		corruptReceiverKeys: func(keys *receiverKeys, rid int) {
			if rid != 5 {
				keys.PayloadKeyBox[35] ^= 1
			}
		},
	}
	ciphertext, err = testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
}

func testCorruptPayloadKeyPlaintext(t *testing.T, version Version) {
	msg := randomMsg(t, 129)

	// First try flipping a bit in the payload key.
	teo := testEncryptionOptions{
		corruptPayloadKey: func(pk *[]byte, rid int) {
			if rid == 2 {
				(*pk)[3] ^= 1
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

	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}

	// If we've corrupted the payload key, the first thing that will fail is
	// opening the sender secretbox.
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrBadSenderKeySecretbox {
		t.Fatalf("Got wrong error; wanted %v but got %v", ErrBadSenderKeySecretbox, err)
	}

	// Also try truncating the payload key. This should fail with a different
	// error.
	teo = testEncryptionOptions{
		corruptPayloadKey: func(pk *[]byte, rid int) {
			var shortKey [31]byte
			*pk = shortKey[:]
		},
	}
	ciphertext, err = testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrBadSymmetricKey {
		t.Fatalf("Got wrong error; wanted 'Bad Symmetric Key' but got %v", err)
	}

	// Finally, do the above test again with a hidden receiver. The default
	// testing keyring is not iterable, so we need to make a new one.
	iterableKeyring := newKeyring().makeIterable()
	sender = newHiddenBoxKeyNoInsert(t)
	iterableKeyring.insert(sender)
	receivers = []BoxPublicKey{
		sender.GetPublicKey(),
	}
	ciphertext, err = testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, iterableKeyring)
	if err != ErrBadSymmetricKey {
		t.Fatalf("Got wrong error; wanted 'Bad Symmetric Key' but got %v", err)
	}
}

func testCorruptSenderSecretboxPlaintext(t *testing.T, version Version) {
	msg := randomMsg(t, 129)

	// First try flipping a bit. This should break the first payload packet.
	teo := testEncryptionOptions{
		corruptSenderKeyPlaintext: func(pk *[]byte) {
			(*pk)[3] ^= 1
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
	}
	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if mm, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Tag' but got %v", err)
	} else if int(mm) != 1 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 1, mm)
	}

	// Also try truncating the sender key. This should hit the bad length
	// check.
	teo = testEncryptionOptions{
		corruptSenderKeyPlaintext: func(pk *[]byte) {
			var shortKey [31]byte
			copy(shortKey[:], *pk)
			*pk = shortKey[:]
		},
	}
	ciphertext, err = testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrBadBoxKey {
		t.Fatalf("Got wrong error; wanted 'Bad Sender Key' but got %v", err)
	}
}

func testCorruptSenderSecretboxCiphertext(t *testing.T, version Version) {
	msg := randomMsg(t, 129)

	teo := testEncryptionOptions{
		corruptSenderKeyCiphertext: func(pk []byte) {
			pk[3] ^= 1
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
	}
	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrBadSenderKeySecretbox {
		t.Fatalf("Got wrong error; wanted 'Bad Sender Key Secretbox' but got %v", err)
	}
}

func testMissingFooter(t *testing.T, version Version) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	msg := randomMsg(t, 1024*9)
	ciphertext, err := testSeal(version, msg, sender, receivers, testEncryptionOptions{
		skipFooter: true,
		blockSize:  1024,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("Wanted %v but got %v", io.ErrUnexpectedEOF, err)
	}
}

func getEncryptionBlockV1(eb *interface{}) encryptionBlockV1 {
	switch eb := (*eb).(type) {
	case encryptionBlockV1:
		return eb
	case encryptionBlockV2:
		return eb.encryptionBlockV1
	default:
		panic(fmt.Sprintf("Unknown type %T", eb))
	}
}

func testCorruptEncryption(t *testing.T, version Version) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	msg := randomMsg(t, 1024*9)

	// First check that a corrupted ciphertext fails the Poly1305
	ciphertext, err := testSeal(version, msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *interface{}, ebn encryptionBlockNumber) {
			if ebn == 2 {
				ebV1 := getEncryptionBlockV1(eb)
				ebV1.PayloadCiphertext[8] ^= 1
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if mm, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Ciphertext' but got %v", err)
	} else if int(mm) != 3 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 3, mm)
	}

	// Next check that a corruption of the Poly1305 tags causes a failure
	ciphertext, err = testSeal(version, msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptEncryptionBlock: func(eb *interface{}, ebn encryptionBlockNumber) {
			if ebn == 2 {
				ebV1 := getEncryptionBlockV1(eb)
				ebV1.HashAuthenticators[0][2] ^= 1
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if mm, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Tag; failed Poly1305' but got %v", err)
	} else if int(mm) != 3 {
		t.Fatalf("Wanted a failure in packet %d but got %d", 3, mm)
	}

	// Next check what happens if we swap nonces for blocks 0 and 1
	msg = randomMsg(t, 1024*2-1)
	ciphertext, err = testSeal(version, msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
		corruptPayloadNonce: func(n Nonce, ebn encryptionBlockNumber) Nonce {
			switch ebn {
			case 1:
				return nonceForChunkSecretBox(encryptionBlockNumber(0))
			case 0:
				return nonceForChunkSecretBox(encryptionBlockNumber(1))
			}
			return n
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if emm, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Expected a 'bad tag' error but got %v", err)
	} else if int(emm) != 1 {
		t.Fatalf("Wanted error packet %d but got %d", 1, emm)
	}
}

func testCorruptButAuthenticPayloadBox(t *testing.T, version Version) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	msg := randomMsg(t, 1024*2-1)
	ciphertext, err := testSeal(version, msg, sender, receivers, testEncryptionOptions{
		corruptCiphertextBeforeHash: func(c []byte, ebn encryptionBlockNumber) {
			if ebn == 0 {
				c[0] ^= 1
			}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if emm, ok := err.(ErrBadCiphertext); !ok {
		t.Fatalf("Expected a 'bad ciphertext' error but got %v", err)
	} else if int(emm) != 1 {
		t.Fatalf("Wanted error packet %d but got %d", 1, emm)
	}
}

func testCorruptNonce(t *testing.T, version Version) {
	msg := randomMsg(t, 1024*11)
	teo := testEncryptionOptions{
		blockSize: 1024,
		corruptPayloadNonce: func(n Nonce, ebn encryptionBlockNumber) Nonce {
			if ebn == 2 {
				ret := n
				ret[23]++
				return ret
			}
			return n
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if bcte, ok := err.(ErrBadTag); !ok {
		t.Fatalf("Wanted error 'ErrBadTag' but got %v", err)
	} else if int(bcte) != 3 {
		t.Fatalf("wrong packet; wanted %d but got %d", 3, bcte)
	}
}

func testCorruptHeader(t *testing.T, version Version) {
	msg := randomMsg(t, 1024*11)

	badVersion := version
	badVersion.Major++

	// Test bad Header version
	teo := testEncryptionOptions{
		blockSize: 1024,
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Version = badVersion
		},
	}
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	ciphertext, err := testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if ebv, ok := err.(ErrBadVersion); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Version' but got %v", err)
	} else if ebv.received != badVersion {
		t.Fatalf("got wrong version # in error message: %v", ebv.received)
	}

	// Test bad header Tag
	teo = testEncryptionOptions{
		blockSize: 1024,
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Type = MessageTypeAttachedSignature
		},
	}
	ciphertext, err = testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if ebv, ok := err.(ErrWrongMessageType); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Type' but got %v", err)
	} else if ebv.wanted != MessageTypeEncryption {
		t.Fatalf("got wrong wanted in error message: %d", ebv.wanted)
	} else if ebv.received != MessageTypeAttachedSignature {
		t.Fatalf("got wrong received in error message: %d", ebv.received)
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
	ciphertext, err = testSeal(version, msg, sender, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err == nil || err.Error() != "only encoded map or array can be decoded into a struct" {
		t.Fatalf("wanted a msgpack decode error")
	}
}

func testNoSenderKey(t *testing.T, version Version) {
	sender := newBoxKeyBlacklistPublic(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	msg := randomMsg(t, 1024*9)
	ciphertext, err := testSeal(version, msg, sender, receivers, testEncryptionOptions{
		blockSize: 1024,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrNoSenderKey {
		t.Fatalf("Wanted %v but got %v", ErrNoSenderKey, err)
	}
}

func testSealAndOpenTrailingGarbage(t *testing.T, version Version) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(version, plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	buf.Write(ciphertext)
	newEncoder(&buf).Encode(randomMsg(t, 14))
	_, _, err = Open(SingleVersionValidator(version), buf.Bytes(), kr)
	if err != ErrTrailingGarbage {
		t.Fatalf("Wanted 'ErrTrailingGarbage' but got %v", err)
	}
}

func testAnonymousSender(t *testing.T, version Version) {
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(version, plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
}

func testAllAnonymous(t *testing.T, version Version) {
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
	ciphertext, err := Seal(version, plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrNoDecryptionKey {
		t.Fatalf("Got %v but wanted %v", err, ErrNoDecryptionKey)
	}

	var mki *MessageKeyInfo
	mki, _, err = Open(SingleVersionValidator(version), ciphertext, kr.makeIterable())
	if err != nil {
		t.Fatal(err)
	}
	if !mki.SenderIsAnon {
		t.Fatal("sender should be anon")
	}
	if !mki.ReceiverIsAnon {
		t.Fatal("receiver should be anon")
	}
	if !PublicKeyEqual(receivers[5], mki.ReceiverKey.GetPublicKey()) {
		t.Fatal("wrong receiver key")
	}
	if mki.NumAnonReceivers != 8 {
		t.Fatal("wrong number of anon receivers")
	}
	if len(mki.NamedReceivers) > 0 {
		t.Fatal("got named receivers")
	}

	receivers[5] = newHiddenBoxKeyNoInsert(t).GetPublicKey()
	ciphertext, err = Seal(version, plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}

	mki, _, err = Open(SingleVersionValidator(version), ciphertext, kr.makeIterable())
	if err != ErrNoDecryptionKey {
		t.Fatalf("Got %v but wanted %v", err, ErrNoDecryptionKey)
	}

	if mki.SenderIsAnon {
		t.Fatal("that the sender shouldn't be anonymous")
	}
	if mki.ReceiverKey != nil {
		t.Fatal("non-nil receiver key")
	}
	if mki.NumAnonReceivers != 8 {
		t.Fatal("wrong number of anon receivers")
	}
	if len(mki.NamedReceivers) > 0 {
		t.Fatal("got named receivers")
	}

}

func testCorruptEphemeralKey(t *testing.T, version Version) {
	receivers := []BoxPublicKey{newHiddenBoxKey(t).GetPublicKey()}
	plaintext := randomMsg(t, 1024*3)
	teo := testEncryptionOptions{
		corruptHeader: func(eh *EncryptionHeader) {
			eh.Ephemeral = eh.Ephemeral[0 : len(eh.Ephemeral)-1]
		},
	}
	ciphertext, err := testSeal(version, plaintext, nil, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrBadEphemeralKey {
		t.Fatalf("Got %v but wanted %v", err, ErrBadEphemeralKey)
	}
}

func testCiphertextSwapKeys(t *testing.T, version Version) {
	receivers := []BoxPublicKey{
		newBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newBoxKeyNoInsert(t).GetPublicKey(),
	}
	plaintext := randomMsg(t, 1024*3)
	teo := testEncryptionOptions{
		corruptHeader: func(h *EncryptionHeader) {
			h.Receivers[1].PayloadKeyBox, h.Receivers[0].PayloadKeyBox = h.Receivers[0].PayloadKeyBox, h.Receivers[1].PayloadKeyBox
		},
	}
	ciphertext, err := testSeal(version, plaintext, nil, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != errPublicKeyDecryptionFailed {
		t.Fatalf("Got %v but wanted %v", err, errPublicKeyDecryptionFailed)
	}
}

func testEmptyReceiverKID(t *testing.T, version Version) {
	receivers := []BoxPublicKey{
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKey(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
	}
	plaintext := randomMsg(t, 1024*3)
	teo := testEncryptionOptions{
		corruptReceiverKeys: func(keys *receiverKeys, rid int) {
			keys.ReceiverKID = []byte{}
		},
	}
	ciphertext, err := testSeal(version, plaintext, nil, receivers, teo)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrNoDecryptionKey {
		t.Fatalf("Got %v but wanted %v", err, ErrNoDecryptionKey)
	}
}

func testAnonymousThenNamed(t *testing.T, version Version) {
	receivers := []BoxPublicKey{
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
	}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(version, plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != nil {
		t.Fatal(err)
	}
}

func testBadKeyLookup(t *testing.T, version Version) {
	receivers := []BoxPublicKey{
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newBoxKey(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
		newHiddenBoxKeyNoInsert(t).GetPublicKey(),
	}
	plaintext := randomMsg(t, 1024*3)
	ciphertext, err := Seal(version, plaintext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	kr.bad = true
	_, _, err = Open(SingleVersionValidator(version), ciphertext, kr)
	if err != ErrBadLookup {
		t.Fatal(err)
	}
	kr.bad = false
}

func TestCorruptFraming(t *testing.T) {
	// Create a "ciphertext" where header packet is a type other than bytes.
	nonInteger, err := encodeToBytes(42)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Open(CheckKnownMajorVersion, nonInteger, kr)
	if err != ErrFailedToReadHeaderBytes {
		t.Fatal(err)
	}
}

func testNoWriteMessage(t *testing.T, version Version) {
	// We need to make sure the header is written out, even if we never call
	// Write() with any payload bytes.
	receivers := []BoxPublicKey{
		newBoxKey(t).GetPublicKey(),
	}
	var ciphertext bytes.Buffer
	es, err := NewEncryptStream(version, &ciphertext, nil, receivers)
	if err != nil {
		t.Fatal(err)
	}
	// Usually we would call Write() here. But with an empty message, we don't
	// have to!
	err = es.Close()
	if err != nil {
		t.Fatal(err)
	}
	_, plaintext, err := Open(SingleVersionValidator(version), ciphertext.Bytes(), kr)
	if err != nil {
		t.Fatal(err)
	}
	if len(plaintext) != 0 {
		t.Fatal("Expected empty plaintext!")
	}
}

func TestEncryptSinglePacketV1(t *testing.T) {
	sender := boxSecretKey{
		key: RawBoxKey{0x08},
	}
	receivers := []BoxPublicKey{boxPublicKey{key: RawBoxKey{0x1}}}

	plaintext := make([]byte, encryptionBlockSize)
	ciphertext, err := Seal(Version1(), plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(ciphertext))

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	var block encryptionBlockV1

	// Payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	// Empty footer payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	// Nothing else.
	_, err = mps.Read(&block)
	if err != io.EOF {
		t.Fatalf("err=%v != io.EOF", err)
	}
}

func TestEncryptSinglePacketV2(t *testing.T) {
	sender := boxSecretKey{
		key: RawBoxKey{0x08},
	}
	receivers := []BoxPublicKey{boxPublicKey{key: RawBoxKey{0x1}}}

	plaintext := make([]byte, encryptionBlockSize)
	ciphertext, err := Seal(Version2(), plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(ciphertext))

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	var block encryptionBlockV2

	// Payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	if !block.IsFinal {
		t.Fatal("IsFinal unexpectedly not set")
	}

	// Nothing else.
	_, err = mps.Read(&block)
	if err != io.EOF {
		t.Fatalf("err=%v != io.EOF", err)
	}
}

func TestEncryptSubsequenceV1(t *testing.T) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}

	plaintext := make([]byte, 2*encryptionBlockSize)
	ciphertext, err := Seal(Version1(), plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(ciphertext))

	// These truncated ciphertexts will have the first payload
	// packet, the second payload packet, and neither payload
	// packet, respectively.
	truncatedCiphertext1 := bytes.NewBuffer(nil)
	truncatedCiphertext2 := bytes.NewBuffer(nil)
	truncatedCiphertext3 := bytes.NewBuffer(nil)
	encoder1 := newEncoder(truncatedCiphertext1)
	encoder2 := newEncoder(truncatedCiphertext2)
	encoder3 := newEncoder(truncatedCiphertext3)

	encode := func(e encoder, i interface{}) {
		err = e.Encode(i)
		if err != nil {
			t.Fatal(err)
		}
	}

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, headerBytes)
	encode(encoder2, headerBytes)
	encode(encoder3, headerBytes)

	var block encryptionBlockV1

	// Payload packet 1.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, block)

	// Payload packet 2.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder2, block)

	// Empty footer payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, block)
	encode(encoder2, block)
	encode(encoder3, block)

	validator := SingleVersionValidator(Version1())
	_, _, err = Open(validator, truncatedCiphertext1.Bytes(), kr)
	expectedErr := ErrBadTag(2)
	if err != expectedErr {
		t.Errorf("err=%v != %v for truncatedCiphertext1", err, expectedErr)
	}

	_, _, err = Open(validator, truncatedCiphertext2.Bytes(), kr)
	expectedErr = ErrBadTag(1)
	if err != expectedErr {
		t.Errorf("err=%v != %v for truncatedCiphertext2", err, expectedErr)
	}

	_, _, err = Open(validator, truncatedCiphertext3.Bytes(), kr)
	expectedErr = ErrBadTag(1)
	if err != expectedErr {
		t.Errorf("err=%v != %v for truncatedCiphertext3", err, expectedErr)
	}
}

func TestEncryptSubsequenceV2(t *testing.T) {
	sender := newBoxKey(t)
	receivers := []BoxPublicKey{newBoxKey(t).GetPublicKey()}

	plaintext := make([]byte, 2*encryptionBlockSize)
	ciphertext, err := Seal(Version2(), plaintext, sender, receivers)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(ciphertext))

	// These truncated ciphertexts will have the first payload
	// packet and the second payload packet, respectively.
	truncatedCiphertext1 := bytes.NewBuffer(nil)
	truncatedCiphertext2 := bytes.NewBuffer(nil)
	encoder1 := newEncoder(truncatedCiphertext1)
	encoder2 := newEncoder(truncatedCiphertext2)

	encode := func(e encoder, i interface{}) {
		err = e.Encode(i)
		if err != nil {
			t.Fatal(err)
		}
	}

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, headerBytes)
	encode(encoder2, headerBytes)

	var block encryptionBlockV2

	// Payload packet 1.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	block.IsFinal = true
	encode(encoder1, block)

	// Payload packet 2.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	block.IsFinal = true
	encode(encoder2, block)

	for i, truncatedCiphertext := range []*bytes.Buffer{truncatedCiphertext1, truncatedCiphertext2} {
		validator := SingleVersionValidator(Version2())
		_, _, err = Open(validator, truncatedCiphertext.Bytes(), kr)
		expectedErr := ErrBadTag(1)
		if err != expectedErr {
			t.Errorf("err=%v != %v for truncatedCiphertext%d", err, expectedErr, i+1)
		}
	}
}

func TestEncrypt(t *testing.T) {
	tests := []func(*testing.T, Version){
		testNewEncryptStreamShuffledReaders,
		testEmptyEncryptionOneReceiver,
		testSmallEncryptionOneReceiver,
		testMediumEncryptionOneReceiver,
		testBiggishEncryptionOneReceiver,
		testRealEncryptorSmall,
		testRealEncryptorBig,
		testRoundTripMedium6Receivers,
		testRoundTripSmall6Receivers,
		testReceiverNotFound,
		testTruncation,
		testMediumEncryptionOneReceiverSmallReads,
		testMediumEncryptionOneReceiverSmallishReads,
		testMediumEncryptionOneReceiverMediumReads,
		testSealAndOpenSmall,
		testSealAndOpenBig,
		testSealAndOpenTwoReceivers,
		testRepeatedKey,
		testEmptyReceivers,
		testCorruptHeaderNonce,
		testCorruptHeaderNonceR5,
		testCorruptPayloadKeyBoxR5,
		testCorruptPayloadKeyPlaintext,
		testCorruptSenderSecretboxPlaintext,
		testCorruptSenderSecretboxCiphertext,
		testMissingFooter,
		testCorruptEncryption,
		testCorruptButAuthenticPayloadBox,
		testCorruptNonce,
		testCorruptHeader,
		testNoSenderKey,
		testSealAndOpenTrailingGarbage,
		testAnonymousSender,
		testAllAnonymous,
		testCorruptEphemeralKey,
		testCiphertextSwapKeys,
		testEmptyReceiverKID,
		testAnonymousThenNamed,
		testBadKeyLookup,
		testNoWriteMessage,
	}
	runTestsOverVersions(t, "test", tests)
}
