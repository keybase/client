// This is a construction for encrypting and signing a message, using a
// symmetric encryption key and a signing keypair, in a way that supports safe
// streaming decryption. We need this for chat attachments because we've chosen
// to use signing keys for authenticity in chat, and we don't want one
// participant to be able to modify another's attachment, even with an evil
// server's help. It's *almost* enough that we record the hash of the
// attachment along with the symmetric key used to encrypt it, but that by
// itself doesn't allow safe streaming decryption. Instead, we use this
// construction to sign each chunk of the attachment as we encrypt it. (Note
// that it's still possible for a sender with the server's help to modify their
// *own* attachments after the fact, if clients aren't checking the hash. This
// isn't perfect, but it's better than any participant being able to do it.)
//
// This file has 100% test coverage. Please keep it that way :-)
//
// Seal inputs:
// - plaintext bytes (streaming is fine)
// - a crypto_secretbox symmetric key
// - a crypto_sign private key
// - a globally unique (with respect to these keys) 16-byte nonce
//
// Seal steps:
// 1) Chunk the message into chunks exactly one megabyte long (2^20 bytes), with
//    exactly one short chunk at the end, which might be zero bytes.
// 2) Compute the SHA512 hash of each plaintext chunk.
// 3) Concatenate the 16-byte nonce above with the 8-byte unsigned big-endian
//    chunk number, where the first chunk is zero. This is the 24-byte chunk
//    nonce.
// 4) Concatenate five things:
//    - a signature prefix string which must contain no null bytes.
//      for example "Keybase-Chat-Attachment-1"
//    - a null byte terminator for the prefix string
//    - the encryption key (why?! read below)
//    - the chunk nonce from #3
//    - the hash from #2.
// 5) Sign the concatenation from #4, giving a detached 64-byte crypto_sign
//    signature.
// 6) Concatenate the signature from #5 + the plaintext chunk.
// 7) Encrypt the concatenation from #6 with the crypto_secretbox key and the
//    chunk nonce from #3.
// 8) Concatenate all the ciphertexts from #7 into the output.
//
// Open inputs:
// - ciphertext bytes (streaming is fine)
// - the same crypto_secretbox symmetric key
// - the corresponding crypto_sign public key
// - the same nonce
//
// Open steps:
// 1) Chop the input stream into chunks of exactly (2^20 + 80) bytes, with
//    exactly one short chunk at the end. If this short chunk is less than 80
//    bytes (the size of an Ed25519 signature and a Poly1305 authenticator put
//    together), return a truncation error.
// 2) Decrypt each input chunk with the crypto_secretbox key and chunk nonce as
//    in seal step #7.
// 3) Split each decrypted chunk into a 64-byte signature and the following
//    plaintext.
// 4) Hash that plaintext and make the concatenation from seal step #4.
// 5) Verify the signature against that concatenation.
// 6) Emit each verified plaintext chunk as output.
//
// Design Notes:
//
// Combining signing and encryption is surprisingly tricky! See
// http://world.std.com/~dtd/sign_encrypt/sign_encrypt7.html for lots of
// details about the issues that come up. (Note that "encryption" in that
// paper refers mostly to RSA encryption like PGP's, which doesn't involve
// a sender key the way Diffie-Hellman / NaCl's crypto_box does. This makes
// me appreciate just how many problems the crypto_box construction is
// solving.)
//
// Many of these issues probably don't apply to chat attachments (yet?!),
// because recipients will know what keys to use ahead of time. But there
// are other places where we use signing+encryption that have different
// properties, and I want to be able to use this design as a reference. The
// short version of the problem is that both encrypt-then-sign and
// sign-then-encrypt have to worry about what happens when someone reuses
// the inner layer with a new outer layer.
//
// Encrypt-then-sign has a "sender impersonation" problem. The
// man-in-the-middle can re-sign an encrypted payload with their own key
// and claim authorship of the message. If the message itself contains
// secrets, like in an auth protocol for example, the MITM can fake knowing
// those secrets. (Also, encrypt-then-sign has the more obvious downside
// that encryption is hiding only the contents of a signature and not its
// author.)
//
// Sign-then-encrypt has a "surreptitious forwarding" problem. A recipient
// can re-encrypt the signed payload to another unintended recipient.
// Recipients must not rely on the encryption layer to mean that the sender
// intended the message for them. In fact PGP is vulnerable to this attack,
// unless the user/application understands the very subtle difference
// between "I can read this" and "this was written to me".
//
// So, simply using encryption and signing together isn't good enough! The
// paper linked above mentions a few different solutions, but in general
// the fix is that the inner layer needs to assert something about the
// outer layer, so that the outer layer can't be changed without the inner
// key. We could simply include the outer key verbatim inside the inner
// layer, but a better approach is to mix the outer key into the inner
// crypto, so that it's impossible to forget to check it.
//
// We prefer sign-then-encrypt, because hiding the author of the signature
// is a feature. That means the inner signing layer needs to assert the
// encryption key. We do this by including the encryption key as
// "associated data" that gets signed along with the plaintext. Since we
// already need to do that with a nonce and a chunk number, including the
// the encryption key is easy. We don't need to worry about whether the
// signature might leak the encryption key either, because the signature
// gets encrypted.
//
// Apart from these signing gymnastics, all the large-encrypted-message
// considerations from https://www.imperialviolet.org/2015/05/16/aeads.html
// apply here. Namely we use a chunk number to prevent reordering, and we
// require a short chunk at the end to detect truncation. A globally unique
// nonce (for encryption *and* signing) prevents chunk swapping in between
// messages, and is required for encryption in any case. (It's expected
// that the chat client will pass in all zeroes for the nonce, because both
// keys are one-time-use. That's up to the client. G-d help us if we ever
// reuse those keys.) We also follow the "prefix signatures with an ASCII
// context string and a null byte" recommendation from
// https://www.ietf.org/mail-archive/web/tls/current/msg14734.html.

package signencrypt

import (
	"bytes"
	"crypto/sha512"
	"encoding/binary"
	"fmt"
	"io"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/go-crypto/ed25519"
	"golang.org/x/crypto/nacl/secretbox"
)

type Nonce *[NonceSize]byte
type SecretboxKey *[SecretboxKeySize]byte
type SecretboxNonce *[SecretboxNonceSize]byte
type SignKey *[ed25519.PrivateKeySize]byte
type VerifyKey *[ed25519.PublicKeySize]byte

const NonceSize = 16
const SecretboxKeySize = 32
const SecretboxNonceSize = 24
const DefaultPlaintextChunkLength int64 = 1 << 20

// ===================================
// single packet encoding and decoding
// ===================================

func makeChunkNonce(nonce Nonce, chunkNum uint64) SecretboxNonce {
	var ret [SecretboxNonceSize]byte
	copy(ret[0:16], nonce[:])
	var chunkNumBytes [8]byte
	binary.BigEndian.PutUint64(chunkNumBytes[:], chunkNum)
	copy(ret[16:24], chunkNumBytes[:])
	return &ret
}

func makeSignatureInput(plaintext []byte, encKey SecretboxKey, signaturePrefix kbcrypto.SignaturePrefix, chunkNonce SecretboxNonce) []byte {
	// Check that the prefix does not include any null bytes.
	if bytes.IndexByte([]byte(signaturePrefix), 0x00) != -1 {
		panic(fmt.Sprintf("signature prefix contains null byte: %q", signaturePrefix))
	}

	chunkHash := sha512.Sum512(plaintext)
	var ret []byte
	ret = append(ret, signaturePrefix...)
	// We follow the "prefix signatures with an ASCII context string and a null byte" recommendation from
	// https://www.ietf.org/mail-archive/web/tls/current/msg14734.html.
	ret = append(ret, 0x00)
	ret = append(ret, encKey[:]...)
	ret = append(ret, chunkNonce[:]...)
	ret = append(ret, chunkHash[:]...)
	return ret
}

func getPacketLen(plaintextChunkLen int64) int64 {
	return plaintextChunkLen + secretbox.Overhead + ed25519.SignatureSize
}

func getPlaintextPacketLen(cipherChunkLen int64) int64 {
	return cipherChunkLen - (secretbox.Overhead + ed25519.SignatureSize)
}

func sealPacket(plaintext []byte, encKey SecretboxKey, signKey SignKey, signaturePrefix kbcrypto.SignaturePrefix, nonce SecretboxNonce) []byte {
	signatureInput := makeSignatureInput(plaintext, encKey, signaturePrefix, nonce)
	signature := ed25519.Sign(signKey[:], signatureInput)
	signedChunk := append(signature[:], plaintext...)
	packet := secretbox.Seal(nil, signedChunk, nonce, encKey)
	return packet
}

func openPacket(packet []byte, encKey SecretboxKey, verifyKey VerifyKey, signaturePrefix kbcrypto.SignaturePrefix, nonce SecretboxNonce) ([]byte, error) {
	signedChunk, secretboxValid := secretbox.Open(nil, packet, nonce, encKey)
	if !secretboxValid {
		return nil, NewError(BadSecretbox, "secretbox failed to open")
	}
	// Avoid panicking on signatures that are too short.
	if len(signedChunk) < ed25519.SignatureSize {
		return nil, NewError(ShortSignature, "signature too short")
	}
	signature := signedChunk[0:ed25519.SignatureSize]
	plaintext := signedChunk[ed25519.SignatureSize:]
	signatureInput := makeSignatureInput(plaintext, encKey, signaturePrefix, nonce)
	signatureValid := ed25519.Verify(verifyKey[:], signatureInput, signature)
	if !signatureValid {
		return nil, NewError(BadSignature, "signature failed to verify")
	}
	return plaintext, nil
}

// ===================
// incremental encoder
// ===================

type Encoder struct {
	encKey            SecretboxKey
	signKey           SignKey
	signaturePrefix   kbcrypto.SignaturePrefix
	nonce             Nonce
	buf               []byte
	chunkNum          uint64
	plaintextChunkLen int64
}

func NewEncoder(encKey SecretboxKey, signKey SignKey, signaturePrefix kbcrypto.SignaturePrefix, nonce Nonce) *Encoder {
	return &Encoder{
		encKey:            encKey,
		signKey:           signKey,
		signaturePrefix:   signaturePrefix,
		nonce:             nonce,
		buf:               nil,
		chunkNum:          0,
		plaintextChunkLen: DefaultPlaintextChunkLength,
	}
}

func (e *Encoder) sealOnePacket(plaintextChunkLen int64) []byte {
	// Note that this function handles the `plaintextChunkLen == 0` case.
	if plaintextChunkLen > int64(len(e.buf)) {
		panic("encoder tried to seal a packet that was too big")
	}
	plaintextChunk := e.buf[0:plaintextChunkLen]
	chunkNonce := makeChunkNonce(e.nonce, e.chunkNum)
	packet := sealPacket(plaintextChunk, e.encKey, e.signKey, e.signaturePrefix, chunkNonce)
	e.buf = e.buf[plaintextChunkLen:]
	e.chunkNum++
	return packet
}

// Write plaintext bytes into the encoder. If any output bytes are ready,
// return them. Callers must call Finish() when they're done, so that any
// remaining input bytes can be written out as a short (or empty) chunk.
// Otherwise you will both lose data and cause truncation errors on
// decoding.
func (e *Encoder) Write(plaintext []byte) []byte {
	e.buf = append(e.buf, plaintext...)
	var output []byte
	// If buf is big enough to make new packets, make as many as we can.
	for int64(len(e.buf)) >= e.plaintextChunkLen {
		packet := e.sealOnePacket(e.plaintextChunkLen)
		output = append(output, packet...)
	}
	return output
}

// Finish writes out any remaining buffered input bytes (possibly zero bytes)
// as a short chunk. This should only be called once, and after that you can't
// use this encoder again.
func (e *Encoder) Finish() []byte {
	if int64(len(e.buf)) >= e.plaintextChunkLen {
		panic("encoder buffer has more bytes than expected")
	}
	packet := e.sealOnePacket(int64(len(e.buf)))
	return packet
}

func (e *Encoder) ChangePlaintextChunkLenForTesting(plaintextChunkLen int64) {
	e.plaintextChunkLen = plaintextChunkLen
}

// ===================
// incremental decoder
// ===================

type Decoder struct {
	encKey          SecretboxKey
	verifyKey       VerifyKey
	signaturePrefix kbcrypto.SignaturePrefix
	nonce           Nonce
	buf             []byte
	chunkNum        uint64
	err             error
	packetLen       int64
}

func NewDecoder(encKey SecretboxKey, verifyKey VerifyKey, signaturePrefix kbcrypto.SignaturePrefix, nonce Nonce) *Decoder {
	return &Decoder{
		encKey:          encKey,
		verifyKey:       verifyKey,
		signaturePrefix: signaturePrefix,
		nonce:           nonce,
		buf:             nil,
		chunkNum:        0,
		err:             nil,
		packetLen:       getPacketLen(DefaultPlaintextChunkLength),
	}
}

func (d *Decoder) setChunkNum(num uint64) {
	d.chunkNum = num
}

func (d *Decoder) openOnePacket(packetLen int64) ([]byte, error) {
	if packetLen > int64(len(d.buf)) {
		panic("decoder tried to open a packet that was too big")
	}
	packet := d.buf[0:packetLen]
	chunkNonce := makeChunkNonce(d.nonce, d.chunkNum)
	plaintext, err := openPacket(packet, d.encKey, d.verifyKey, d.signaturePrefix, chunkNonce)
	if err != nil {
		return nil, err
	}
	d.buf = d.buf[packetLen:]
	d.chunkNum++
	return plaintext, nil
}

// Write ciphertext bytes into the decoder. If any packets are ready to
// open, open them and either return their plaintext bytes as output or any
// error that comes up. Callers must call Finish() when they're done, to
// decode the final short packet and check for truncation. If Write ever
// returns an error, subsequent calls to Write will always return the same
// error.
func (d *Decoder) Write(ciphertext []byte) ([]byte, error) {
	// If we've ever seen an error, just return that again.
	if d.err != nil {
		return nil, d.err
	}
	d.buf = append(d.buf, ciphertext...)
	// If buf is big enough to open new packets, open as many as we can.
	// We assume that every packet other than the last (which we handle in
	// Finish) is the same length, which makes this loop very simple.
	var output []byte
	for int64(len(d.buf)) >= d.packetLen {
		var plaintext []byte
		plaintext, d.err = d.openOnePacket(d.packetLen)
		if d.err != nil {
			return nil, d.err
		}
		output = append(output, plaintext...)
	}
	return output, nil
}

// Finish decodes any remaining bytes as a short (or empty) packet. This
// produces the final bytes of the plaintext, and implicitly checks for
// truncation. This should only be called once, and after that you can't use
// this decoder again.
func (d *Decoder) Finish() ([]byte, error) {
	// If we've ever seen an error, just return that again.
	if d.err != nil {
		return nil, d.err
	}
	if int64(len(d.buf)) >= d.packetLen {
		panic("decoder buffer has more bytes than expected")
	}
	// If we've been truncated at a packet boundary, this open will fail on a
	// simple length check. If we've been truncated in the middle of a packet,
	// this open will fail to validate.
	var plaintext []byte
	plaintext, d.err = d.openOnePacket(int64(len(d.buf)))
	return plaintext, d.err
}

func (d *Decoder) ChangePlaintextChunkLenForTesting(plaintextChunkLen int64) {
	d.packetLen = getPacketLen(plaintextChunkLen)
}

// ===============================================
// Reader-based wrappers for encoding and decoding
// ===============================================

type codec interface {
	Write([]byte) ([]byte, error)
	Finish() ([]byte, error)
}

// The incremental encoder never returns errors, so its type signatures are
// different than the decoder's. This struct trivially wraps them to fit the
// codec signature.
type encoderCodecShim struct {
	*Encoder
}

func (s *encoderCodecShim) Write(b []byte) ([]byte, error) {
	return s.Encoder.Write(b), nil
}

func (s *encoderCodecShim) Finish() ([]byte, error) {
	return s.Encoder.Finish(), nil
}

var _ codec = (*Decoder)(nil)
var _ codec = (*encoderCodecShim)(nil)

type codecReadWrapper struct {
	codec       codec
	innerReader io.Reader
	outputBuf   []byte
	codecErr    error
	innerEOF    bool
}

var _ io.Reader = (*codecReadWrapper)(nil)

func (r *codecReadWrapper) Read(callerBuf []byte) (int, error) {
	// Crypto errors are unrecoverable. If we've ever seen one, just keep
	// returning it.
	if r.codecErr != nil {
		return 0, r.codecErr
	}
	// While we need more data, keep reading from the inner reader.
	for !r.innerEOF && len(r.outputBuf) == 0 {
		var readBuf [4096]byte
		n, ioErr := r.innerReader.Read(readBuf[:])
		// Always handle the bytes we read, regardless of errors, in accordance
		// with https://golang.org/pkg/io/#Reader.
		if n > 0 {
			var newOutput []byte
			newOutput, r.codecErr = r.codec.Write(readBuf[0:n])
			// For codec errors, short circuit and never read again.
			if r.codecErr != nil {
				return 0, r.codecErr
			}
			r.outputBuf = append(r.outputBuf, newOutput...)
		}
		// Now handle EOF or other errors.
		if ioErr == io.EOF {
			// When we see EOF we finish the internal codec. We won't run this
			// loop anymore, but we might still need to return bytes from our
			// own buffer for many subsequent reads. Also nil out the codec and
			// the inner reader, since we shouldn't touch them again.
			r.innerEOF = true
			var finalOutput []byte
			finalOutput, r.codecErr = r.codec.Finish()
			// For codec errors, short circuit and never read again.
			if r.codecErr != nil {
				return 0, r.codecErr
			}
			r.outputBuf = append(r.outputBuf, finalOutput...)
			r.codec = nil
			r.innerReader = nil
		} else if ioErr != nil {
			// If we have a real IO error, short circuit and return it. This
			// reader remains valid, though, and the caller is allowed to
			// retry.
			return 0, ioErr
		}
	}
	// Now, if we have any buffered data, return as much of that as we can.
	if len(r.outputBuf) > 0 {
		copied := copy(callerBuf, r.outputBuf)
		r.outputBuf = r.outputBuf[copied:]
		return copied, nil
	}
	// Otherwise return EOF.
	return 0, io.EOF
}

// NewEncodingReader creates a new streaming encoder.
// The signaturePrefix argument must not contain the null container.
func NewEncodingReader(encKey SecretboxKey, signKey SignKey, signaturePrefix kbcrypto.SignaturePrefix, nonce Nonce, innerReader io.Reader) io.Reader {
	return &codecReadWrapper{
		innerReader: innerReader,
		codec:       &encoderCodecShim{NewEncoder(encKey, signKey, signaturePrefix, nonce)},
	}
}

func NewDecodingReader(encKey SecretboxKey, verifyKey VerifyKey, signaturePrefix kbcrypto.SignaturePrefix, nonce Nonce, innerReader io.Reader) io.Reader {
	return &codecReadWrapper{
		innerReader: innerReader,
		codec:       NewDecoder(encKey, verifyKey, signaturePrefix, nonce),
	}
}

// =============================
// chunk helpers
// =============================

type chunkSpec struct {
	index                  int64
	ptStart, ptEnd         int64
	cipherStart, cipherEnd int64
}

func chunkFromIndex(index int64) (res chunkSpec) {
	res.index = index
	res.ptStart = res.index * DefaultPlaintextChunkLength
	res.ptEnd = res.ptStart + DefaultPlaintextChunkLength
	res.cipherStart = res.index * getPacketLen(DefaultPlaintextChunkLength)
	res.cipherEnd = res.cipherStart + getPacketLen(DefaultPlaintextChunkLength)
	return res
}

func getChunksInRange(plaintextBegin, plaintextEnd, plaintextLen int64) (res []chunkSpec) {
	beginChunk := chunkFromIndex(plaintextBegin / DefaultPlaintextChunkLength)
	endChunk := chunkFromIndex(plaintextEnd / DefaultPlaintextChunkLength)
	cipherLen := GetSealedSize(plaintextLen)
	for i := beginChunk.index; i <= endChunk.index; i++ {
		res = append(res, chunkFromIndex(i))
	}
	if res[len(res)-1].ptEnd >= plaintextLen {
		res[len(res)-1].ptEnd = plaintextLen
	}
	if res[len(res)-1].cipherEnd >= cipherLen {
		res[len(res)-1].cipherEnd = cipherLen
	}
	return res
}

// =============================
// all-at-once wrapper functions
// =============================

func GetSealedSize(plaintextLen int64) int64 {
	// All the full packets.
	fullChunks := plaintextLen / DefaultPlaintextChunkLength
	totalLen := fullChunks * getPacketLen(DefaultPlaintextChunkLength)
	// Exactly one short packet, even if it's empty.
	remainingPlaintext := plaintextLen % DefaultPlaintextChunkLength
	totalLen += getPacketLen(remainingPlaintext)
	return totalLen
}

func GetPlaintextSize(cipherLen int64) int64 {
	fullChunks := cipherLen / getPacketLen(DefaultPlaintextChunkLength)
	totalLen := fullChunks * DefaultPlaintextChunkLength
	remainingCiphertext := cipherLen % getPacketLen(DefaultPlaintextChunkLength)
	totalLen += getPlaintextPacketLen(remainingCiphertext)
	return totalLen
}

// SealWhole seals all at once using the streaming encoding.
func SealWhole(plaintext []byte, encKey SecretboxKey, signKey SignKey, signaturePrefix kbcrypto.SignaturePrefix, nonce Nonce) []byte {
	encoder := NewEncoder(encKey, signKey, signaturePrefix, nonce)
	output := encoder.Write(plaintext)
	output = append(output, encoder.Finish()...)
	return output
}

func OpenWhole(sealed []byte, encKey SecretboxKey, verifyKey VerifyKey, signaturePrefix kbcrypto.SignaturePrefix, nonce Nonce) ([]byte, error) {
	decoder := NewDecoder(encKey, verifyKey, signaturePrefix, nonce)
	output, err := decoder.Write(sealed)
	if err != nil {
		return nil, err
	}
	moreOutput, err := decoder.Finish()
	if err != nil {
		return nil, err
	}
	return append(output, moreOutput...), nil
}

// ======
// errors
// ======

type ErrorType int

const (
	BadSecretbox ErrorType = iota
	ShortSignature
	BadSignature
)

type Error struct {
	Type    ErrorType
	Message string
}

func NewError(errorType ErrorType, message string, args ...interface{}) error {
	return Error{
		Type:    errorType,
		Message: fmt.Sprintf(message, args...),
	}
}

func (e Error) Error() string {
	return e.Message
}
