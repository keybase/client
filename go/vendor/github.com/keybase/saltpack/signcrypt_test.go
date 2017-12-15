// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"io/ioutil"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/ed25519"
	"golang.org/x/crypto/poly1305"
)

type testConstResolver struct {
	hardcodedReceivers []ReceiverSymmetricKey
}

var _ SymmetricKeyResolver = (*testConstResolver)(nil)

func (r *testConstResolver) ResolveKeys(identifiers [][]byte) ([]*SymmetricKey, error) {
	ret := []*SymmetricKey{}
	for _, ident := range identifiers {
		var key *SymmetricKey
		for _, receiver := range r.hardcodedReceivers {
			if bytes.Equal(receiver.Identifier, ident) {
				key = &receiver.Key
				break
			}
		}
		ret = append(ret, key)
	}
	return ret, nil
}

func makeEmptyKeyring(t *testing.T) *keyring {
	keyring := newKeyring()
	keyring.iterable = true
	return keyring
}

func makeKeyringWithOneKey(t *testing.T) (*keyring, []BoxPublicKey) {
	keyring := makeEmptyKeyring(t)
	keyring.iterable = true
	receiverBoxSecretKey, err := keyring.CreateEphemeralKey()
	require.NoError(t, err)
	keyring.insert(receiverBoxSecretKey)
	receiverBoxKeys := []BoxPublicKey{receiverBoxSecretKey.GetPublicKey()}
	return keyring, receiverBoxKeys
}

func makeSigningKey(t *testing.T, keyring *keyring) *sigPrivKey {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	k := &sigPrivKey{
		public:  newSigPubKey(pub),
		private: priv,
	}
	keyring.insertSigningKey(k)
	return k
}

func makeResolverWithOneKey(t *testing.T) (SymmetricKeyResolver, []ReceiverSymmetricKey) {
	var sharedSymmetricKey SymmetricKey // zeros
	receiver := ReceiverSymmetricKey{
		Key:        sharedSymmetricKey,
		Identifier: []byte("dummy identifier"),
	}
	receivers := []ReceiverSymmetricKey{receiver}
	resolver := &testConstResolver{hardcodedReceivers: receivers}
	return resolver, receivers
}

func TestSigncryptionBoxKeyHelloWorld(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)

	senderSigningPrivKey := makeSigningKey(t, keyring)

	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	senderPub, opened, err := SigncryptOpen(sealed, keyring, nil)
	require.NoError(t, err)

	require.Equal(t, senderSigningPrivKey.GetPublicKey(), senderPub)

	require.Equal(t, msg, opened)
}

func TestSigncryptionResolvedKeyHelloWorld(t *testing.T) {
	msg := []byte("hello world")
	keyring := makeEmptyKeyring(t)

	resolver, receivers := makeResolverWithOneKey(t)

	senderSigningPrivKey := makeSigningKey(t, keyring)

	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, nil, receivers)
	require.NoError(t, err)

	senderPub, opened, err := SigncryptOpen(sealed, keyring, resolver)
	require.NoError(t, err)

	require.Equal(t, senderSigningPrivKey.GetPublicKey(), senderPub)

	require.Equal(t, msg, opened)
}

func TestSigncryptionAnonymousSenderHelloWorld(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)

	sealed, err := SigncryptSeal(msg, keyring, nil /* senderSigningPrivKey */, receiverBoxKeys, nil)
	require.NoError(t, err)

	senderPub, opened, err := SigncryptOpen(sealed, keyring, nil)
	require.NoError(t, err)

	// A nil sender means anonymous mode.
	require.Nil(t, senderPub)

	require.Equal(t, msg, opened)
}

func TestSigncryptionEmptyCiphertext(t *testing.T) {
	keyring, _ := makeKeyringWithOneKey(t)

	emptyMessage := []byte("")
	_, _, err := SigncryptOpen(emptyMessage, keyring, nil)
	require.Equal(t, ErrFailedToReadHeaderBytes, err)
}

func TestSigncryptionMultiPacket(t *testing.T) {
	msg := make([]byte, encryptionBlockSize*2)
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)

	senderSigningPrivKey := makeSigningKey(t, keyring)

	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	senderPub, opened, err := SigncryptOpen(sealed, keyring, nil)
	require.NoError(t, err)

	require.Equal(t, senderSigningPrivKey.GetPublicKey(), senderPub)

	require.Equal(t, msg, opened)
}

func getHeaderLen(t *testing.T, sealed []byte) int {
	// Assert the MessagePack bin8 type.
	require.Equal(t, byte(0xc4), sealed[0])
	// Grab the bin length.
	bin8Len := int(sealed[1])
	// Account for the leading two bytes.
	headerLen := bin8Len + 2
	return headerLen
}

// This test checks that we throw io.ErrUnexpectedEOF if we reach the end of
// the stream without having seen a proper termination packet.
func TestSigncryptionTruncatedAtPacketBoundary(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)

	senderSigningPrivKey := makeSigningKey(t, keyring)

	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// Truncate to just the header packet.
	headerLen := getHeaderLen(t, sealed)
	truncated := sealed[0:headerLen]

	_, _, err = SigncryptOpen(truncated, keyring, nil)
	require.Equal(t, io.ErrUnexpectedEOF, err)
}

func getPayloadPacketLen(plaintextLen int) int {
	var bytesOverhead int
	if plaintextLen < 1<<8 {
		bytesOverhead = 2
	} else if plaintextLen < 1<<16 {
		bytesOverhead = 3
	} else {
		bytesOverhead = 5
	}
	listOverhead := 1 // fixarray
	boolOverhead := 1 // for IsFinal flag
	return plaintextLen + ed25519.SignatureSize + poly1305.TagSize + bytesOverhead + listOverhead + boolOverhead
}

func TestSigncryptionPacketSwappingWithinMessage(t *testing.T) {
	msg := make([]byte, encryptionBlockSize*2)
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// Extract the header and packets, and assert they're the length we expect
	// them to be (one full encryption block + signature + poly1305 + msgpack
	// overhead).
	headerLen := getHeaderLen(t, sealed)
	packetLen := getPayloadPacketLen(encryptionBlockSize)
	packet2Start := headerLen + packetLen
	require.Equal(t, headerLen+2*packetLen, len(sealed), "sealed bytes aren't the length we expected")
	header := sealed[:headerLen]
	packet1 := sealed[headerLen:packet2Start]
	packet2 := sealed[packet2Start:]

	// Assert that swapping packets 1 and 2 fails to decrypt. (Start with a
	// fresh slice to avoid confusing overwrites.)
	swapped_sealed := append([]byte{}, header...)
	swapped_sealed = append(swapped_sealed, packet2...)
	swapped_sealed = append(swapped_sealed, packet1...)
	_, _, err = SigncryptOpen(swapped_sealed, keyring, nil)
	require.Equal(t, ErrBadCiphertext(1), err)
}

func TestSigncryptionSinglePacket(t *testing.T) {
	msg := make([]byte, encryptionBlockSize)
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)

	senderSigningPrivKey := makeSigningKey(t, keyring)

	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	mps := newMsgpackStream(bytes.NewReader(sealed))

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	require.NoError(t, err)

	var block signcryptionBlock

	// Payload packet.
	_, err = mps.Read(&block)
	require.NoError(t, err)

	// Nothing else.
	_, err = mps.Read(&block)
	require.Equal(t, io.EOF, err)
}

func testSigncryptionSubsequence(t *testing.T, anon bool) {
	msg := make([]byte, 2*encryptionBlockSize)
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)

	var senderSigningPrivKey SigningSecretKey
	if !anon {
		senderSigningPrivKey = makeSigningKey(t, keyring)
	}

	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	mps := newMsgpackStream(bytes.NewReader(sealed))

	// These truncated ciphertexts will have the first payload
	// packet and the second payload packet, respectively.
	truncatedCiphertext1 := bytes.NewBuffer(nil)
	truncatedCiphertext2 := bytes.NewBuffer(nil)
	encoder1 := newEncoder(truncatedCiphertext1)
	encoder2 := newEncoder(truncatedCiphertext2)

	encode := func(e encoder, i interface{}) {
		err = e.Encode(i)
		require.NoError(t, err)
	}

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	require.NoError(t, err)

	encode(encoder1, headerBytes)
	encode(encoder2, headerBytes)

	var block signcryptionBlock

	// Payload packet 1.
	_, err = mps.Read(&block)
	require.NoError(t, err)

	block.IsFinal = true
	encode(encoder1, block)

	// Payload packet 2.
	_, err = mps.Read(&block)
	require.NoError(t, err)

	block.IsFinal = true
	encode(encoder2, block)

	_, _, err = SigncryptOpen(truncatedCiphertext1.Bytes(), keyring, nil)
	require.Equal(t, ErrBadCiphertext(1), err)

	_, _, err = SigncryptOpen(truncatedCiphertext2.Bytes(), keyring, nil)
	require.Equal(t, ErrBadCiphertext(1), err)
}

func TestSigncryptionSubsequence(t *testing.T) {
	t.Run("anon=false", func(t *testing.T) {
		testSigncryptionSubsequence(t, false)
	})
	t.Run("anon=true", func(t *testing.T) {
		testSigncryptionSubsequence(t, true)
	})
}

func TestSigncryptionPacketSwappingBetweenMessages(t *testing.T) {
	msg := make([]byte, encryptionBlockSize*2)
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed1, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)
	// Another sealed version of the same message. This will generate a second
	// set of ephemeral keys, and the payload packets should not be compatible
	// with the first message. (At least, not in this sanity check test.
	// Hopefully the design is secure against more creative attacks.)
	sealed2, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// Extract the header and packets, and assert they're the length we expect
	// them to be (one full encryption block + signature + poly1305 + msgpack
	// overhead).
	headerLen1 := getHeaderLen(t, sealed1)
	headerLen2 := getHeaderLen(t, sealed2)
	require.Equal(t, headerLen1, headerLen2, "expected the messages to have the same header len")
	payload1 := sealed1[headerLen1:]
	payload2 := sealed2[headerLen2:]

	// Assemble the swapped messages. Again make copies of the slices to avoid
	// confusing overwrites.
	swapped1 := append([]byte{}, sealed1[:headerLen1]...)
	swapped1 = append(swapped1, payload2...)
	swapped2 := append([]byte{}, sealed2[:headerLen2]...)
	swapped2 = append(swapped2, payload1...)

	// Both should fail to decrypt.
	_, _, err = SigncryptOpen(swapped1, keyring, nil)
	require.Equal(t, ErrBadCiphertext(1), err)
	_, _, err = SigncryptOpen(swapped2, keyring, nil)
	require.Equal(t, ErrBadCiphertext(1), err)
}

func TestSigncryptionStream(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	_, reader, err := NewSigncryptOpenStream(bytes.NewBuffer(sealed), keyring, nil)

	// Read out all the bytes one at a time, to exercise the buffering logic.
	output := []byte{}
	for {
		buffer := make([]byte, 1)
		n, err := reader.Read(buffer)
		output = append(output, buffer[:n]...)
		if err == io.EOF {
			break
		}
		require.NoError(t, err)
		require.True(t, n > 0)
	}
	require.Equal(t, msg, output)
}

func TestSigncryptionStreamWithError(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// Break the final packet.
	sealed[len(sealed)-1] ^= 1

	_, reader, err := NewSigncryptOpenStream(bytes.NewBuffer(sealed), keyring, nil)

	// Try to read the whole thing. This should return an error.
	_, err = ioutil.ReadAll(reader)
	require.Equal(t, ErrBadCiphertext(1), err)

	// Do it again. Should get the same error.
	_, err = ioutil.ReadAll(reader)
	require.Equal(t, ErrBadCiphertext(1), err)
}

func TestSigncryptionInvalidMessagepack(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// Truncate the header right in the middle. This should lead to a
	// MessagePack error. However, doctor up the length of the bin8 object, so
	// that it's the *second* decode that fails.
	truncated := sealed[:10]
	truncated[1] = 8

	_, _, err = SigncryptOpen(truncated, keyring, nil)
	require.Equal(t, io.ErrUnexpectedEOF, err)
}

func TestSigncryptionBoxKeyHeaderDecryptionError(t *testing.T) {
	msg := []byte("hello world")
	keyring := makeEmptyKeyring(t)
	resolver, receivers := makeResolverWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, nil, receivers)
	require.NoError(t, err)

	// The recipient secretbox is the very last thing in the header. Flip the
	// last byte of it to break it.
	sealed[getHeaderLen(t, sealed)-1] ^= 1

	_, _, err = SigncryptOpen(sealed, keyring, resolver)
	require.Equal(t, ErrDecryptionFailed, err)
}

// As above, but the symmetric recipient type.
func TestSigncryptionResolvedKeyHeaderDecryptionError(t *testing.T) {
	msg := []byte("hello world")
	keyring := makeEmptyKeyring(t)
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// The recipient secretbox is the very last thing in the header. Flip the
	// last byte of it to break it.
	sealed[getHeaderLen(t, sealed)-1] ^= 1

	_, _, err = SigncryptOpen(sealed, keyring, nil)
	require.Equal(t, ErrDecryptionFailed, err)
}

// Create a broken resolver to exercise the error path.
type BrokenResolver struct{}

var _ SymmetricKeyResolver = (*BrokenResolver)(nil)

func (b *BrokenResolver) ResolveKeys(identifiers [][]byte) ([]*SymmetricKey, error) {
	return nil, fmt.Errorf("garbage error foo")
}

// Create a resolver that returns nothing, to exercise a different error.
type EmptyResolver struct{}

var _ SymmetricKeyResolver = (*EmptyResolver)(nil)

func (e *EmptyResolver) ResolveKeys(identifiers [][]byte) ([]*SymmetricKey, error) {
	return nil, nil
}

func TestSigncryptionBadResolvers(t *testing.T) {
	msg := []byte("hello world")
	keyring := makeEmptyKeyring(t)
	_, receivers := makeResolverWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, nil, receivers)
	require.NoError(t, err)

	// Check that errors from the resolver get forwarded.
	_, _, err = SigncryptOpen(sealed, keyring, &BrokenResolver{})
	require.Equal(t, "garbage error foo", err.Error())

	// Check the case where the resolver returns the wrong number of keys.
	_, _, err = SigncryptOpen(sealed, keyring, &EmptyResolver{})
	require.Equal(t, ErrWrongNumberOfKeys, err)
}

// Create a resolver that returns nil for every key.
type NilResolver struct{}

var _ SymmetricKeyResolver = (*NilResolver)(nil)

func (n *NilResolver) ResolveKeys(identifiers [][]byte) ([]*SymmetricKey, error) {
	return make([]*SymmetricKey, len(identifiers)), nil
}

func TestSigncryptionNoMatchingReceivers(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// Use a new keyring and an always-nil resolver, to guarantee no matching keys.
	newKeyring, _ := makeKeyringWithOneKey(t)
	_, _, err = SigncryptOpen(sealed, newKeyring, &NilResolver{})
	require.Equal(t, ErrNoDecryptionKey, err)
}

func messWithHeader(t *testing.T, sealed []byte, messFunc func(*SigncryptionHeader)) []byte {
	headerLen := getHeaderLen(t, sealed)
	// Strip off the bin8 overhead.
	header := sealed[2:headerLen]
	rest := sealed[headerLen:]
	var decodedHeader SigncryptionHeader
	err := decodeFromBytes(&decodedHeader, header)
	require.NoError(t, err)
	messFunc(&decodedHeader)
	newHeader, err := encodeToBytes(&decodedHeader)
	require.NoError(t, err)
	newHeaderBytes, err := encodeToBytes(&newHeader)
	require.NoError(t, err)
	return append(newHeaderBytes, rest...)
}

func TestSigncryptionBadSenderSecretbox(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	badSealed := messWithHeader(t, sealed, func(hdr *SigncryptionHeader) {
		hdr.SenderSecretbox[0] ^= 1
	})

	_, _, err = SigncryptOpen(badSealed, keyring, nil)
	require.Equal(t, ErrBadSenderKeySecretbox, err)
}

func TestSigncryptionWrongMessageType(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	badSealed := messWithHeader(t, sealed, func(hdr *SigncryptionHeader) {
		hdr.Type = MessageTypeAttachedSignature // as opposed to MessageTypeSigncryption
	})

	_, _, err = SigncryptOpen(badSealed, keyring, nil)
	require.Equal(t, ErrWrongMessageType{wanted: MessageTypeSigncryption, received: MessageTypeAttachedSignature}, err)
}

func TestSigncryptionCrazyMessageVersion(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	badSealed := messWithHeader(t, sealed, func(hdr *SigncryptionHeader) {
		hdr.Version = Version{Major: 999}
	})

	_, _, err = SigncryptOpen(badSealed, keyring, nil)
	require.Equal(t, ErrBadVersion{received: Version{Major: 999}}, err)
}

// Make a keyring that always returns the wrong signing key. This will cause
// signature validation errors.
type RandomSigningKeysKeyring struct {
	keyring
}

var _ (Keyring) = (*RandomSigningKeysKeyring)(nil)

func (r *RandomSigningKeysKeyring) LookupSigningPublicKey(kid []byte) SigningPublicKey {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		panic(err)
	}
	return newSigPubKey(pub)
}

func TestSigncryptionInvalidSignature(t *testing.T) {
	msg := []byte("hello world")
	keyring, receiverBoxKeys := makeKeyringWithOneKey(t)
	senderSigningPrivKey := makeSigningKey(t, keyring)
	sealed, err := SigncryptSeal(msg, keyring, senderSigningPrivKey, receiverBoxKeys, nil)
	require.NoError(t, err)

	// Use the RandomSigningKeysKeyring to make signature verification fail.
	_, _, err = SigncryptOpen(sealed, &RandomSigningKeysKeyring{*keyring}, nil)
	require.Equal(t, ErrBadSignature, err)
}
