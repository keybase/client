// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/binary"
	"fmt"

	"github.com/keybase/go-codec/codec"
	"golang.org/x/crypto/poly1305"
)

// maxReceiverCount is the maximum number of receivers allowed
// for a single encrypted saltpack message, which is the maximum length
// of a msgpack array.
const maxReceiverCount = (1 << 32) - 1

// encryptionBlockNumber describes which block number we're at in the sequence
// of encrypted blocks. Each encrypted block of course fits into a packet.
type encryptionBlockNumber uint64

func codecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

func (e encryptionBlockNumber) check() error {
	if e >= encryptionBlockNumber(0xffffffffffffffff) {
		return ErrPacketOverflow
	}
	return nil
}

// assertEndOfStream reads from stream, and converts a nil error into
// ErrTrailingGarbage. Thus, it always returns a non-nil error. This
// should be used in a context where io.EOF is expected, and anything
// else is an error.
func assertEndOfStream(stream *msgpackStream) error {
	var i interface{}
	_, err := stream.Read(&i)
	if err == nil {
		err = ErrTrailingGarbage
	}
	return err
}

type headerHash [sha512.Size]byte

func attachedSignatureInput(version Version, headerHash headerHash, payloadChunk []byte, seqno packetSeqno, isFinal bool) []byte {
	hasher := sha512.New()
	hasher.Write(headerHash[:])
	binary.Write(hasher, binary.BigEndian, seqno)
	switch version.Major {
	case 1:
	// Nothing to do.
	case 2:
		var isFinalByte byte
		if isFinal {
			isFinalByte = 1
		}
		hasher.Write([]byte{isFinalByte})
	default:
		panic(ErrBadVersion{version})
	}
	hasher.Write(payloadChunk)

	var buf bytes.Buffer
	buf.Write([]byte(signatureAttachedString))
	buf.Write(hasher.Sum(nil))

	return buf.Bytes()
}

func detachedSignatureInput(headerHash headerHash, plaintext []byte) []byte {
	hasher := sha512.New()
	hasher.Write(headerHash[:])
	hasher.Write(plaintext)

	return detachedSignatureInputFromHash(hasher.Sum(nil))
}

func detachedSignatureInputFromHash(plaintextAndHeaderHash []byte) []byte {
	var buf bytes.Buffer
	buf.Write([]byte(signatureDetachedString))
	buf.Write(plaintextAndHeaderHash)

	return buf.Bytes()
}

func copyEqualSize(out, in []byte) {
	if len(out) != len(in) {
		panic(fmt.Sprintf("len(out)=%d != len(in)=%d", len(out), len(in)))
	}
	copy(out, in)
}

func copyEqualSizeStr(out []byte, in string) {
	if len(out) != len(in) {
		panic(fmt.Sprintf("len(out)=%d != len(in)=%d", len(out), len(in)))
	}
	copy(out, in)
}

func sliceToByte24(in []byte) [24]byte {
	var out [24]byte
	copyEqualSize(out[:], in)
	return out
}

func stringToByte24(in string) [24]byte {
	var out [24]byte
	copyEqualSizeStr(out[:], in)
	return out
}

func sliceToByte32(in []byte) [32]byte {
	var out [32]byte
	copyEqualSize(out[:], in)
	return out
}

func sliceToByte64(in []byte) [64]byte {
	var out [64]byte
	copyEqualSize(out[:], in)
	return out
}

type macKey [cryptoAuthKeyBytes]byte

type payloadHash [sha512.Size]byte

type payloadAuthenticator [cryptoAuthBytes]byte

func (pa payloadAuthenticator) Equal(other payloadAuthenticator) bool {
	return hmac.Equal(pa[:], other[:])
}

func computePayloadAuthenticator(macKey macKey, payloadHash payloadHash) payloadAuthenticator {
	// Equivalent to crypto_auth, but using Go's builtin HMAC. Truncates
	// SHA512, instead of calling SHA512/256, which has different IVs.
	authenticatorDigest := hmac.New(sha512.New, macKey[:])
	authenticatorDigest.Write(payloadHash[:])
	fullMAC := authenticatorDigest.Sum(nil)
	return sliceToByte32(fullMAC[:cryptoAuthBytes])
}

func computeMACKeySingle(secret BoxSecretKey, public BoxPublicKey, nonce Nonce) macKey {
	macKeyBox := secret.Box(public, nonce, make([]byte, cryptoAuthKeyBytes))
	return sliceToByte32(macKeyBox[poly1305.TagSize : poly1305.TagSize+cryptoAuthKeyBytes])
}

func sum512Truncate256(in []byte) [32]byte {
	// Consistent with computePayloadAuthenticator in that it
	// truncates SHA512 instead of calling SHA512/256, which has
	// different IVs.
	sum512 := sha512.Sum512(in)
	return sliceToByte32(sum512[:32])
}

func computePayloadHash(version Version, headerHash headerHash, nonce Nonce, ciphertext []byte, isFinal bool) payloadHash {
	payloadDigest := sha512.New()
	payloadDigest.Write(headerHash[:])
	payloadDigest.Write(nonce[:])
	switch version.Major {
	case 1:
	// Nothing to do.
	case 2:
		var isFinalByte byte
		if isFinal {
			isFinalByte = 1
		}
		payloadDigest.Write([]byte{isFinalByte})
	default:
		panic(ErrBadVersion{version})
	}
	payloadDigest.Write(ciphertext)
	h := payloadDigest.Sum(nil)
	return sliceToByte64(h)
}

func computeSigncryptionSignatureInput(headerHash headerHash, nonce Nonce, isFinal bool, chunkPlaintext []byte) []byte {
	signatureInput := []byte(signatureEncryptedString)
	// This is a bit redundant, as the nonce already contains part
	// of the header hash and the isFinal flag. However, we
	// truncate the header hash pretty severely for the nonce, so
	// it seems a bit safer to be redundant.
	signatureInput = append(signatureInput, headerHash[:]...)
	signatureInput = append(signatureInput, nonce[:]...)
	var isFinalByte byte
	if isFinal {
		isFinalByte = 1
	}
	signatureInput = append(signatureInput, isFinalByte)
	plaintextHash := sha512.Sum512(chunkPlaintext)
	signatureInput = append(signatureInput, plaintextHash[:]...)
	return signatureInput
}

func hashHeader(headerBytes []byte) headerHash {
	return sha512.Sum512(headerBytes)
}

// VersionValidator is a function that takes a version and returns nil
// if it's a valid version, and an error otherwise.
type VersionValidator func(version Version) error

// CheckKnownMajorVersion returns nil if the given version has a known
// major version. You probably want to use this with NewDecryptStream,
// unless you want to restrict to specific versions only.
func CheckKnownMajorVersion(version Version) error {
	for _, knownVersion := range KnownVersions() {
		if version.Major == knownVersion.Major {
			return nil
		}
	}
	return ErrBadVersion{version}
}

// SingleVersionValidator returns a VersionValidator that returns nil
// if its given version is equal to desiredVersion.
func SingleVersionValidator(desiredVersion Version) VersionValidator {
	return func(version Version) error {
		if version == desiredVersion {
			return nil
		}

		return ErrBadVersion{version}
	}
}

func checkChunkState(version Version, chunkLen int, blockIndex uint64, isFinal bool) error {
	switch version.Major {
	case 1:
		// For V1, we derive isFinal from the chunk length, so
		// if there's a mismatch, that's a bug and not a
		// stream error.
		if (chunkLen == 0) != isFinal {
			panic(fmt.Sprintf("chunkLen=%d and isFinal=%t", chunkLen, isFinal))
		}

	case 2:
		// TODO: Ideally, we'd have tests exercising this case.
		if (chunkLen == 0) && (blockIndex != 0 || !isFinal) {
			return ErrUnexpectedEmptyBlock
		}

	default:
		panic(ErrBadVersion{version})
	}

	return nil
}

// assertEncodedChunkState sanity-checks some encoded chunk parameters.
func assertEncodedChunkState(version Version, encodedChunk []byte, encodingOverhead int, blockIndex uint64, isFinal bool) {
	if len(encodedChunk) < encodingOverhead {
		panic("encodedChunk is too small")
	}

	err := checkChunkState(version, len(encodedChunk)-encodingOverhead, blockIndex, isFinal)
	if err != nil {
		panic(err)
	}
}

// checkDecodedChunkState sanity-checks some decoded chunk
// parameters. A returned error means there's something wrong with the
// decoded stream.
func checkDecodedChunkState(version Version, chunk []byte, seqno packetSeqno, isFinal bool) error {
	// The first decoded block has seqno 1, since the header bytes
	// are decoded first.
	return checkChunkState(version, len(chunk), uint64(seqno-1), isFinal)
}
