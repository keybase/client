package attachment

import (
	"bytes"
	"strings"
	"testing"

	"golang.org/x/crypto/nacl/secretbox"

	"github.com/agl/ed25519"
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

func zeroAttachmentNonce() AttachmentNonce {
	var nonce [AttachmentNonceSize]byte // all zeroes
	return &nonce
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

func zeroEncoder() *AttachmentEncoder {
	return NewAttachmentEncoder(zeroSecretboxKey(), zeroSignKey(), zeroAttachmentNonce())
}

func zeroDecoder() *AttachmentDecoder {
	return NewAttachmentDecoder(zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
}

func zeroSealWhole(plaintext []byte) []byte {
	return SealWholeAttachment(plaintext, zeroSecretboxKey(), zeroSignKey(), zeroAttachmentNonce())
}

func zeroOpenWhole(plaintext []byte) ([]byte, error) {
	return OpenWholeAttachment(plaintext, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
}

func assertErrorType(t *testing.T, err error, expectedType AttachmentCryptoErrorType) {
	if err == nil {
		t.Fatal("expected an error, but error was nil")
	}
	concreteError, ok := err.(AttachmentCryptoError)
	if !ok {
		t.Fatal("failed to cast to AttachmentCryptoError")
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
			chunkNum,
			zeroSecretboxKey(),
			zeroSignKey(),
			zeroAttachmentNonce())

		opened, err := openPacket(
			sealed,
			chunkNum,
			zeroSecretboxKey(),
			zeroVerifyKey(),
			zeroAttachmentNonce())
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal([]byte(input), opened) {
			t.Fatal("opened bytes don't equal the input")
		}

		// We hardcode the bin32 MessagePack format to make our packet sizes
		// predictable. Make sure that's working.
		if len(sealed) != getPacketLen(len(input)) {
			t.Fatalf("Expected len %d but found %d", getPacketLen(len(input)), len(sealed))
		}
	}
}

func TestWholeAttachmentRoundtrips(t *testing.T) {
	for _, input := range plaintextInputs {
		sealed := zeroSealWhole([]byte(input))
		opened, err := zeroOpenWhole(sealed)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal([]byte(input), opened) {
			t.Fatal("opened bytes don't equal the input")
		}

		// We hardcode the bin32 MessagePack format and use a fixed chunk size
		// to make our sealed size predictable. Make sure that's working.
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

		// We hardcode the bin32 MessagePack format and use a fixed chunk size
		// to make our sealed size predictable. Make sure that's working.
		if len(sealed) != GetSealedSize(len(input)) {
			t.Fatalf("Expected len %d but found %d", GetSealedSize(len(input)), len(sealed))
		}
	}
}

func TestMessagePackTooShort(t *testing.T) {
	// Expects 4 length bytes, but there are only 3.
	badPacket := []byte{0xc6, 0, 0, 0}
	_, err := openPacket(badPacket, 0, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, ShortMessagePackObject)
}

func TestMessagePackWrongFormat(t *testing.T) {
	// Expects 0xc6 as the first byte.
	badPacket := []byte{0xc5, 0, 0, 0, 0}
	_, err := openPacket(badPacket, 0, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, WrongMessagePackFormat)
}

func TestMessagePackWrongLength(t *testing.T) {
	// Expects encoded length to match the number of trailing bytes, but we've
	// encoded a length of 1 and there are 2 bytes following.
	badPacket := []byte{0xc6, 0, 0, 0, 1, 42, 42}
	_, err := openPacket(badPacket, 0, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, WrongMessagePackLength)
}

func TestBadSecretbox(t *testing.T) {
	// Test several different cases. First, a secretbox that's too short to even
	// contain an authenticator (just one byte for the secretbox).
	shortPacket := []byte{0xc6, 0, 0, 0, 1, 42}
	_, err := openPacket(shortPacket, 0, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, BadSecretbox)

	// Then also test a secretbox that's long enough to be real, but has an
	// invalid authenticator (just a bunch of constant bytes).
	badAuthenticatorPacket := []byte{0xc6, 0, 0, 0, 100}
	for i := 0; i < 100; i++ {
		badAuthenticatorPacket = append(badAuthenticatorPacket, 42)
	}
	_, err = openPacket(badAuthenticatorPacket, 0, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, BadSecretbox)

	// Test a correct packet opened with the wrong chunk number.
	var rightChunkNum uint64 = 5
	var wrongChunkNum uint64 = 6
	correctPacket := sealPacket([]byte{}, rightChunkNum, zeroSecretboxKey(), zeroSignKey(), zeroAttachmentNonce())
	_, err = openPacket(correctPacket, wrongChunkNum, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, BadSecretbox)
}

func TestShortSignature(t *testing.T) {
	// Signatures are 64 bytes, so this slice is too short to be one.
	shortSignedChunk := []byte{1, 2, 3, 4, 5, 6, 7}
	var chunkNum uint64 = 999
	chunkNonce := makeChunkNonce(zeroAttachmentNonce(), chunkNum)
	ciphertextChunk := secretbox.Seal(nil, shortSignedChunk, chunkNonce, zeroSecretboxKey())
	packet := packCiphertext(ciphertextChunk)
	_, err := openPacket(packet, chunkNum, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, ShortSignature)
}

func TestInvalidSignature(t *testing.T) {
	// A chunk that's long enough to contain a signature, but isn't valid (just
	// a bunch of zeroes).
	invalidSignedChunk := bytes.Repeat([]byte{42}, 100)
	var chunkNum uint64 = 999
	chunkNonce := makeChunkNonce(zeroAttachmentNonce(), chunkNum)
	ciphertextChunk := secretbox.Seal(nil, invalidSignedChunk, chunkNonce, zeroSecretboxKey())
	packet := packCiphertext(ciphertextChunk)
	_, err := openPacket(packet, chunkNum, zeroSecretboxKey(), zeroVerifyKey(), zeroAttachmentNonce())
	assertErrorType(t, err, BadSignature)
}

func TestErrorsReturnedFromDecoder(t *testing.T) {
	// We need bad bytes long enough to trigger an open. This indirectly tests
	// that the exact packet length is enough for that.
	badPacket := bytes.Repeat([]byte{0}, getPacketLen(DefaultPlaintextChunkLength))
	decoder := zeroDecoder()
	_, err := decoder.Write(badPacket)
	assertErrorType(t, err, WrongMessagePackFormat)

	// Make sure we get the same error again for any subsequent writes, even
	// empty ones.
	_, err = decoder.Write([]byte{})
	assertErrorType(t, err, WrongMessagePackFormat)

	// And also for Finish().
	_, err = decoder.Finish()
	assertErrorType(t, err, WrongMessagePackFormat)

	// And make sure we get the same error independently for an all at once
	// decode.
	_, err = zeroOpenWhole(badPacket)
	assertErrorType(t, err, WrongMessagePackFormat)
}

func TestErrorsReturnedFromDecoderDuringFinish(t *testing.T) {
	// There are two errors that might have to be returned by
	// OpenWholeAttachment. This tests the second path, where an error occurs
	// first during Finish().
	badSealed := zeroSealWhole([]byte("foobar"))
	badSealed[len(badSealed)-1]++
	_, err := zeroOpenWhole(badSealed)
	assertErrorType(t, err, BadSecretbox)
}

func TestCoverageHacks(t *testing.T) {
	// Deliberately hit lines that don't/can't come up in normal execution.
	err := NewAttachmentError(BadSecretbox, "blah blah blah")
	_ = err.Error()
}
