package signencrypt

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"strings"
	"testing"

	"golang.org/x/crypto/nacl/secretbox"

	"github.com/agl/ed25519"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

var plaintextInputs = []string{
	"",
	"1",
	"short",
	strings.Repeat("long", 1000000),
}

func zeroSecretboxKey() SecretboxKey {
	var key [SecretboxKeySize]byte // all zeroes
	return &key
}

func zeroNonce() Nonce {
	var nonce [NonceSize]byte // all zeroes
	return &nonce
}

func zeroChunkNonce(chunkNum uint64) SecretboxNonce {
	return makeChunkNonce(zeroNonce(), chunkNum)
}

func zeroVerifyKey() VerifyKey {
	var key [ed25519.PublicKeySize]byte
	// Generated from libsodium's crypto_sign_seed_keypair with a zero seed.
	copy(key[:], ";j'\xbc\xce\xb6\xa4-b\xa3\xa8\xd0*o\rse2\x15w\x1d\xe2C\xa6:\xc0H\xa1\x8bY\xda)")
	return &key
}

func zeroSignKey() SignKey {
	var key [ed25519.PrivateKeySize]byte
	// Generated from libsodium's crypto_sign_seed_keypair with a zero seed.
	copy(key[:], "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00;j'\xbc\xce\xb6\xa4-b\xa3\xa8\xd0*o\rse2\x15w\x1d\xe2C\xa6:\xc0H\xa1\x8bY\xda)")
	return &key
}

func testingPrefix() libkb.SignaturePrefix {
	return libkb.SignaturePrefixTesting
}

func zeroEncoder() *Encoder {
	return NewEncoder(zeroSecretboxKey(), zeroSignKey(), testingPrefix(), zeroNonce())
}

func zeroDecoder() *Decoder {
	return NewDecoder(zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), zeroNonce())
}

func zeroSealWhole(plaintext []byte) []byte {
	return SealWhole(plaintext, zeroSecretboxKey(), zeroSignKey(), testingPrefix(), zeroNonce())
}

func zeroOpenWhole(plaintext []byte) ([]byte, error) {
	return OpenWhole(plaintext, zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), zeroNonce())
}

func assertErrorType(t *testing.T, err error, expectedType ErrorType) {
	if err == nil {
		t.Fatal("expected an error, but error was nil")
	}
	concreteError, ok := err.(Error)
	if !ok {
		t.Fatal("failed to cast to Error")
	}
	if concreteError.Type != expectedType {
		t.Fatalf("expected error type %d but found %d", expectedType, concreteError.Type)
	}
}

func TestPacketRoundtrips(t *testing.T) {
	for index, input := range plaintextInputs {
		// Vary the chunk number, just for fun.
		chunkNum := uint64(index)
		sealed := sealPacket(
			[]byte(input),
			zeroSecretboxKey(),
			zeroSignKey(),
			testingPrefix(),
			zeroChunkNonce(chunkNum))

		opened, err := openPacket(
			sealed,
			zeroSecretboxKey(),
			zeroVerifyKey(),
			testingPrefix(),
			zeroChunkNonce(chunkNum))
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal([]byte(input), opened) {
			t.Fatal("opened bytes don't equal the input")
		}

		if len(sealed) != getPacketLen(len(input)) {
			t.Fatalf("Expected len %d but found %d", getPacketLen(len(input)), len(sealed))
		}
	}
}

func TestWholeRoundtrips(t *testing.T) {
	for _, input := range plaintextInputs {
		sealed := zeroSealWhole([]byte(input))
		opened, err := zeroOpenWhole(sealed)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal([]byte(input), opened) {
			t.Fatal("opened bytes don't equal the input")
		}

		if len(sealed) != GetSealedSize(len(input)) {
			t.Fatalf("Expected len %d but found %d", GetSealedSize(len(input)), len(sealed))
		}
	}
}

func TestByteAtATimeRoundtrips(t *testing.T) {
	for _, input := range plaintextInputs {
		encoder := zeroEncoder()
		var sealed []byte
		for i := 0; i < len(input); i++ {
			output := encoder.Write([]byte{input[i]})
			sealed = append(sealed, output...)
		}
		lastOutput := encoder.Finish()
		sealed = append(sealed, lastOutput...)

		var opened []byte
		decoder := zeroDecoder()
		for i := 0; i < len(sealed); i++ {
			output, err := decoder.Write([]byte{sealed[i]})
			if err != nil {
				t.Fatal(err)
			}
			opened = append(opened, output...)
		}
		lastOutput, err := decoder.Finish()
		if err != nil {
			t.Fatal(err)
		}
		opened = append(opened, lastOutput...)
		if !bytes.Equal([]byte(input), opened) {
			t.Fatal("opened bytes don't equal the input")
		}

		if len(sealed) != GetSealedSize(len(input)) {
			t.Fatalf("Expected len %d but found %d", GetSealedSize(len(input)), len(sealed))
		}
	}
}

func TestReaderWrapperRoundtrips(t *testing.T) {
	for _, input := range plaintextInputs {
		inputBuffer := bytes.NewBuffer([]byte(input))
		encodingReader := NewEncodingReader(
			zeroSecretboxKey(),
			zeroSignKey(),
			testingPrefix(),
			zeroNonce(),
			inputBuffer)
		encoded, err := ioutil.ReadAll(encodingReader)
		if err != nil {
			t.Fatalf("errors shouldn't be possible for encoding: %s", err)
		}
		encodedBuffer := bytes.NewBuffer(encoded)
		decodingReader := NewDecodingReader(
			zeroSecretboxKey(),
			zeroVerifyKey(),
			testingPrefix(),
			zeroNonce(),
			encodedBuffer)
		decoded, err := ioutil.ReadAll(decodingReader)
		if err != nil {
			t.Fatalf("error during decoding: %s", err)
		}
		if !bytes.Equal([]byte(input), decoded) {
			t.Fatal("decoded bytes don't equal the input")
		}
		if len(encoded) != GetSealedSize(len(input)) {
			t.Fatalf("Expected encoded len %d but found %d", GetSealedSize(len(input)), len(encoded))
		}
	}
}

func TestBadSecretbox(t *testing.T) {
	// Test several different cases. First, a secretbox that's too short to even
	// contain an authenticator (just one byte for the secretbox).
	shortPacket := []byte{0xc6, 0, 0, 0, 1, 42}
	_, err := openPacket(shortPacket, zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), zeroChunkNonce(0))
	assertErrorType(t, err, BadSecretbox)

	// Then also test a secretbox that's long enough to be real, but has an
	// invalid authenticator (just a bunch of constant bytes).
	badAuthenticatorPacket := []byte{0xc6, 0, 0, 0, 100}
	for i := 0; i < 100; i++ {
		badAuthenticatorPacket = append(badAuthenticatorPacket, 42)
	}
	_, err = openPacket(badAuthenticatorPacket, zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), zeroChunkNonce(0))
	assertErrorType(t, err, BadSecretbox)

	// Test a correct packet opened with the wrong chunk number.
	var rightChunkNum uint64 = 5
	var wrongChunkNum uint64 = 6
	correctPacket := sealPacket([]byte{}, zeroSecretboxKey(), zeroSignKey(), testingPrefix(), zeroChunkNonce(rightChunkNum))
	_, err = openPacket(correctPacket, zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), zeroChunkNonce(wrongChunkNum))
	assertErrorType(t, err, BadSecretbox)
}

func TestShortSignature(t *testing.T) {
	// Signatures are 64 bytes, so this slice is too short to be one.
	shortSignedChunk := []byte{1, 2, 3, 4, 5, 6, 7}
	var chunkNum uint64 = 999
	chunkNonce := makeChunkNonce(zeroNonce(), chunkNum)
	packet := secretbox.Seal(nil, shortSignedChunk, chunkNonce, zeroSecretboxKey())
	_, err := openPacket(packet, zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), zeroChunkNonce(chunkNum))
	assertErrorType(t, err, ShortSignature)
}

func TestInvalidSignature(t *testing.T) {
	// A chunk that's long enough to contain a signature, but isn't valid (just
	// a bunch of zeroes).
	invalidSignedChunk := bytes.Repeat([]byte{42}, 100)
	var chunkNum uint64 = 999
	chunkNonce := makeChunkNonce(zeroNonce(), chunkNum)
	packet := secretbox.Seal(nil, invalidSignedChunk, chunkNonce, zeroSecretboxKey())
	_, err := openPacket(packet, zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), zeroChunkNonce(chunkNum))
	assertErrorType(t, err, BadSignature)
}

func TestErrorsReturnedFromDecoder(t *testing.T) {
	// We need bad bytes long enough to trigger an open. This indirectly tests
	// that the exact packet length is enough for that.
	badPacket := bytes.Repeat([]byte{0}, getPacketLen(DefaultPlaintextChunkLength))
	decoder := zeroDecoder()
	_, err := decoder.Write(badPacket)
	assertErrorType(t, err, BadSecretbox)

	// Make sure we get the same error again for any subsequent writes, even
	// empty ones.
	_, err = decoder.Write([]byte{})
	assertErrorType(t, err, BadSecretbox)

	// And also for Finish().
	_, err = decoder.Finish()
	assertErrorType(t, err, BadSecretbox)

	// And make sure we get the same error independently for an all at once
	// decode.
	_, err = zeroOpenWhole(badPacket)
	assertErrorType(t, err, BadSecretbox)
}

func TestErrorsReturnedFromDecoderDuringFinish(t *testing.T) {
	// There are two errors that might have to be returned by OpenWhole. This
	// tests the second path, where an error occurs first during Finish().
	badSealed := zeroSealWhole([]byte("foobar"))
	// Flip the very last bit.
	badSealed[len(badSealed)-1] ^= 1
	_, err := zeroOpenWhole(badSealed)
	assertErrorType(t, err, BadSecretbox)
}

func throwawayBuffer() []byte {
	var buf [4096]byte
	return buf[:]
}

// Similar to TestErrorsReturnedFromDecoder above, but for the reader.
func TestErrorsReturnedFromDecodingReader(t *testing.T) {
	badPacket := bytes.Repeat([]byte{0}, getPacketLen(DefaultPlaintextChunkLength))
	reader := NewDecodingReader(
		zeroSecretboxKey(),
		zeroVerifyKey(),
		testingPrefix(),
		zeroNonce(),
		bytes.NewBuffer(badPacket))
	n, err := reader.Read(throwawayBuffer())
	require.Equal(t, n, 0)
	assertErrorType(t, err, BadSecretbox)

	// Make sure we get the same error again for any subsequent reads, even
	// empty ones.
	n, err = reader.Read(throwawayBuffer())
	require.Equal(t, n, 0)
	assertErrorType(t, err, BadSecretbox)
}

// Similar to TestErrorsReturnedFromDecoderDuringFinish above, but for the reader.
func TestErrorsReturnedFromReadingDecoderDuringFinish(t *testing.T) {
	badSealed := zeroSealWhole([]byte("foobar"))
	// Flip the very last bit.
	badSealed[len(badSealed)-1] ^= 1
	reader := NewDecodingReader(
		zeroSecretboxKey(),
		zeroVerifyKey(),
		testingPrefix(),
		zeroNonce(),
		bytes.NewBuffer(badSealed))
	n, err := reader.Read(throwawayBuffer())
	require.Equal(t, n, 0)
	assertErrorType(t, err, BadSecretbox)
}

func TestReencryptedPacketFails(t *testing.T) {
	// Make sure that a packet can't be (legitimately) decrypted and then
	// (illegitimately) reencrypted for another symmetric key, or with any
	// other modified encryption metadata. This isn't proof that someone can't
	// break the format in some clever way, but it's a sanity check that we're
	// preventing at least the attacks we think we are.

	// First create a valid packet.
	var originalChunkNum uint64 // = 0, but lint doesn't let us write it :p
	originalNonce := zeroNonce()
	originalEncryptionKey := zeroSecretboxKey()
	originalSignKey := zeroSignKey()
	originalVerifyKey := zeroVerifyKey()
	packet := sealPacket([]byte("foo"), originalEncryptionKey, originalSignKey, testingPrefix(), makeChunkNonce(originalNonce, originalChunkNum))

	// Now strip off the outer layer of encryption, as a recipient would.
	originalChunkNonce := makeChunkNonce(originalNonce, originalChunkNum)
	unboxedSig, valid := secretbox.Open(nil, packet, originalChunkNonce, originalEncryptionKey)
	if !valid {
		t.Fatal("expected this secretbox to open cleanly")
	}

	// Here's the attack: reencrypt the packet under a *different* key.
	newEncryptionKey := zeroSecretboxKey()
	newEncryptionKey[0] = 42
	rekeyedPacket := secretbox.Seal(nil, unboxedSig, originalChunkNonce, newEncryptionKey)

	// This new packet will have a bad secretbox if someone tries to decrypt it
	// with the old key, of course.
	_, err := openPacket(rekeyedPacket, originalEncryptionKey, originalVerifyKey, testingPrefix(), makeChunkNonce(originalNonce, originalChunkNum))
	assertErrorType(t, err, BadSecretbox)

	// And here's the part we really care about: If someone tries to decrypt
	// the packet with the *new* key, unboxing will succeed, but it should now
	// give a bad *signature* error. This is the whole point of asserting the
	// symmetric key inside the sig.
	_, err = openPacket(rekeyedPacket, newEncryptionKey, originalVerifyKey, testingPrefix(), makeChunkNonce(originalNonce, originalChunkNum))
	assertErrorType(t, err, BadSignature)

	// Another test along the same lines: it should also be a signature error if the chunk number changes.
	var newChunkNum uint64 = 1
	newChunkNumNonce := makeChunkNonce(originalNonce, newChunkNum)
	renumberedPacket := secretbox.Seal(nil, unboxedSig, newChunkNumNonce, originalEncryptionKey)
	_, err = openPacket(renumberedPacket, originalEncryptionKey, originalVerifyKey, testingPrefix(), makeChunkNonce(originalNonce, newChunkNum))
	assertErrorType(t, err, BadSignature)

	// And: it should be a signature error if the caller's nonce changes.
	newNonce := zeroNonce()
	newNonce[0] = 42
	newChunkNonce := makeChunkNonce(newNonce, originalChunkNum)
	renoncedPacket := secretbox.Seal(nil, unboxedSig, newChunkNonce, originalEncryptionKey)
	_, err = openPacket(renoncedPacket, originalEncryptionKey, originalVerifyKey, testingPrefix(), makeChunkNonce(newNonce, originalChunkNum))
	assertErrorType(t, err, BadSignature)
}

func TestTruncatedFails(t *testing.T) {
	// Another sanity check test. This isn't proof that truncation is always
	// detectable, but it exercises the simplest cases.

	// One full packet's worth and then a little bit more.
	plaintext := bytes.Repeat([]byte{0}, DefaultPlaintextChunkLength+42)
	sealed := zeroSealWhole(plaintext)

	// Try truncating in the middle of a packet.
	truncated := sealed[:999]
	_, err := zeroOpenWhole(truncated)
	assertErrorType(t, err, BadSecretbox)

	// And try truncating at the first packet boundary. We still expect a
	// BadSecretbox error, because secretbox.Open will fail on an empty slice.
	packetLen := getPacketLen(DefaultPlaintextChunkLength)
	truncated = sealed[:packetLen]
	_, err = zeroOpenWhole(truncated)
	assertErrorType(t, err, BadSecretbox)
}

func TestPacketSwapInOneMessageFails(t *testing.T) {
	// Another sanity check test. This isn't proof that swapping is always
	// detectable, but it exercises the simplest cases.

	// Two full packets' worth.
	plaintext := bytes.Repeat([]byte{0}, DefaultPlaintextChunkLength*2)
	sealed := zeroSealWhole(plaintext)

	// Swap the first two packets. Make sure to make *copies* of both packets,
	// or else the second swap will be a no-op.
	packetLen := getPacketLen(DefaultPlaintextChunkLength)
	packet1 := append([]byte{}, sealed[:packetLen]...)
	packet2 := append([]byte{}, sealed[packetLen:2*packetLen]...)
	copy(sealed, packet2)
	copy(sealed[packetLen:], packet1)

	// This should break both decoding.
	_, err := zeroOpenWhole(sealed)
	assertErrorType(t, err, BadSecretbox)
}

func TestPacketSwapBetweenMessagesFails(t *testing.T) {
	// Another sanity check test. This isn't proof that swapping is always
	// detectable, but it exercises the simplest cases.

	// One full packet's worth and then a little bit more.
	plaintext1 := bytes.Repeat([]byte{1}, DefaultPlaintextChunkLength+42)
	sealed1 := zeroSealWhole(plaintext1)

	// Encrypt another same plaintext with a different nonce. (If we used the
	// same nonce, packet swapping *would* be possible, not to mention all the
	// crypto would be ruined.)
	plaintext2 := bytes.Repeat([]byte{2}, DefaultPlaintextChunkLength+42)
	var nonce2 [16]byte
	nonce2[0] = 42
	sealed2 := SealWhole(plaintext2, zeroSecretboxKey(), zeroSignKey(), testingPrefix(), &nonce2)

	// Swap the first packet between them. Make sure to make *copies* and not
	// just slices, or else the second swap will be a no-op.
	packetLen := getPacketLen(DefaultPlaintextChunkLength)
	firstPacket1 := append([]byte{}, sealed1[:packetLen]...)
	firstPacket2 := append([]byte{}, sealed2[:packetLen]...)
	copy(sealed1, firstPacket2)
	copy(sealed2, firstPacket1)

	// This should break both messages.
	_, err := zeroOpenWhole(sealed1)
	assertErrorType(t, err, BadSecretbox)
	_, err = OpenWhole(sealed2, zeroSecretboxKey(), zeroVerifyKey(), testingPrefix(), &nonce2)
	assertErrorType(t, err, BadSecretbox)
}

// This type returns a random error the first time you Read from it, and then
// defers to the inner reader for every read after that.
type FakeIOErrorReader struct {
	inner                io.Reader
	returnedErrorAlready bool
}

var _ io.Reader = (*FakeIOErrorReader)(nil)

var fakeErrorString = "random error for the first read"

func (f *FakeIOErrorReader) Read(buf []byte) (int, error) {
	if !f.returnedErrorAlready {
		f.returnedErrorAlready = true
		return 0, fmt.Errorf(fakeErrorString)
	}
	return f.inner.Read(buf)
}

func TestTransientIOErrorsInReaderWrappers(t *testing.T) {
	// If our DecodingReader gets a decryption error, it'll give up and fail
	// forever. But if either reader gets an IO error from its inner reader, it
	// should be willing to retry. Simulate this case on both ends, with a
	// FakeIOErrorReader that returns a Read error one time and then returns
	// real bytes on subsequent calls.

	plaintext := []byte("foo")
	plaintextBuf := bytes.NewBuffer(plaintext)
	fakePlaintextErrorReader := &FakeIOErrorReader{inner: plaintextBuf}
	encodingReader := NewEncodingReader(
		zeroSecretboxKey(),
		zeroSignKey(),
		testingPrefix(),
		zeroNonce(),
		fakePlaintextErrorReader)

	// The first read is an error.
	n, err := encodingReader.Read(throwawayBuffer())
	if n != 0 {
		t.Fatalf("Expected 0 bytes, but received %d", n)
	}
	if err.Error() != fakeErrorString {
		t.Fatalf("Expected a fake error, but found: %s", err)
	}

	// Subsequent reads should succeed.
	encoded, err := ioutil.ReadAll(encodingReader)
	if err != nil {
		t.Fatalf("no more errors expected during encoding, but found: %s", err)
	}

	// Similar test for the decoder.
	encodedBuffer := bytes.NewBuffer(encoded)
	fakeCiphertextErrorReader := &FakeIOErrorReader{inner: encodedBuffer}
	decodingReader := NewDecodingReader(
		zeroSecretboxKey(),
		zeroVerifyKey(),
		testingPrefix(),
		zeroNonce(),
		fakeCiphertextErrorReader)

	// Again, the first read is an error.
	n, err = decodingReader.Read(throwawayBuffer())
	if n != 0 {
		t.Fatalf("Expected 0 bytes, but received %d", n)
	}
	if err.Error() != fakeErrorString {
		t.Fatalf("Expected a fake error, but found: %s", err)
	}

	// And again, subsequent reads should succeed.
	decoded, err := ioutil.ReadAll(decodingReader)
	if err != nil {
		t.Fatalf("no more errors expected during decoding, but found: %s", err)
	}
	if !bytes.Equal(plaintext, decoded) {
		t.Fatal("decoded bytes don't equal the input")
	}
}

func shouldPanic(t *testing.T, f func()) {
	defer func() {
		err := recover()
		require.NotNil(t, err)
	}()
	f()
}

func TestCoverageHacks(t *testing.T) {
	// Deliberately hit lines that don't/can't come up in normal execution.

	err := NewError(BadSecretbox, "blah blah blah")
	_ = err.Error()

	encoder := Encoder{}
	encoder.ChangePlaintextChunkLenForTesting(42)
	// Try to seal a packet longer than the internal buffer.
	shouldPanic(t, func() {
		encoder.sealOnePacket(999)
	})
	// Try to Finish with too much data in the buffer.
	encoder.buf = bytes.Repeat([]byte{0}, 999)
	shouldPanic(t, func() {
		encoder.Finish()
	})

	decoder := Decoder{}
	decoder.ChangePlaintextChunkLenForTesting(42)
	// Try to open a packet longer than the internal buffer.
	shouldPanic(t, func() {
		decoder.openOnePacket(999)
	})
	// Try to Finish with too much data in the buffer.
	decoder.buf = bytes.Repeat([]byte{0}, 999)
	shouldPanic(t, func() {
		decoder.Finish()
	})
}

func TestPrefixDifference(t *testing.T) {
	// Test that different prefixes fail verification
	for index, input := range plaintextInputs {
		// Vary the chunk number, just for fun.
		chunkNum := uint64(index)
		sealed := sealPacket(
			[]byte(input),
			zeroSecretboxKey(),
			zeroSignKey(),
			testingPrefix(),
			zeroChunkNonce(chunkNum))

		_, err := openPacket(
			sealed,
			zeroSecretboxKey(),
			zeroVerifyKey(),
			testingPrefix()+"other",
			zeroChunkNonce(chunkNum))

		assertErrorType(t, err, BadSignature)
	}
}
