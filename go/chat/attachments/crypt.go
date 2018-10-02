package attachments

import (
	"crypto/rand"
	"errors"
	"io"

	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-crypto/ed25519"
)

type Encrypter interface {
	// EncryptedLen returns the number of bytes that the ciphertext of
	// size plaintext bytes will be.
	EncryptedLen(size int) int

	// Encrypt takes a plaintext reader and returns a ciphertext reader.
	// It generates new keys every time it is called and uses a
	// constant nonce.
	Encrypt(plaintext io.Reader) (ciphertext io.Reader, err error)

	// EncryptWithNonce takes a plaintext reader and returns a ciphertext reader.
	// It generates new keys every time it is called and uses
	// the provided nonce.
	EncryptWithNonce(plaintext io.Reader, nonce signencrypt.Nonce) (ciphertext io.Reader, err error)

	// EncryptResume takes a plaintext reader and a set of keys.  It
	// returns a ciphertext reader.  It *does not* generate new keys
	// but uses the parameter keys.  These keys should *only* be used
	// to encrypt the same plaintext as a previous attempt.
	EncryptResume(r io.Reader, nonce signencrypt.Nonce, encKey signencrypt.SecretboxKey, signKey signencrypt.SignKey, verifyKey signencrypt.VerifyKey) (io.Reader, error)

	// EncryptKey returns the ephemeral key that was used during the
	// last invocation of Encrypt.
	EncryptKey() []byte

	// VerifyKey returns the public portion of the signing key used during
	// the last invocation of Encrypt.  It can be used for signature
	// verification.
	VerifyKey() []byte
}

type Decrypter interface {
	// Decrypt takes a ciphertext reader, encryption and verify keys.
	// It returns a plaintext reader.  It uses the constant nonce.
	Decrypt(ciphertext io.Reader, encKey, verifyKey []byte) (plaintext io.Reader)

	// DecryptWithNonce takes a ciphertext reader, nonce, encryption and verify keys.
	// It returns a plaintext reader.
	DecryptWithNonce(ciphertext io.Reader, nonce signencrypt.Nonce, encKey, verifyKey []byte) (plaintext io.Reader)
}

// The ASCII bytes "kbchatattachment".
var nonceConst signencrypt.Nonce = &[16]byte{0x6b, 0x62, 0x63, 0x68, 0x61, 0x74, 0x61, 0x74, 0x74, 0x61, 0x63, 0x68, 0x6d, 0x65, 0x6e, 0x74}

type SignEncrypter struct {
	encKey    signencrypt.SecretboxKey
	signKey   signencrypt.SignKey
	verifyKey signencrypt.VerifyKey
}

func NewSignEncrypter() *SignEncrypter {
	return &SignEncrypter{}
}

func (s *SignEncrypter) EncryptedLen(size int64) int64 {
	return signencrypt.GetSealedSize(size)
}

func (s *SignEncrypter) Encrypt(r io.Reader) (io.Reader, error) {
	// It is *very* important that Encrypt calls makeKeys() to make
	// new keys every time it runs.  The keys it uses cannot be reused
	// since we are using a constant nonce.
	if err := s.makeKeys(); err != nil {
		return nil, err
	}
	return signencrypt.NewEncodingReader(s.encKey, s.signKey, kbcrypto.SignaturePrefixChatAttachment, nonceConst, r), nil
}

func (s *SignEncrypter) EncryptWithNonce(r io.Reader, nonce signencrypt.Nonce) (io.Reader, error) {
	if err := s.makeKeys(); err != nil {
		return nil, err
	}
	return signencrypt.NewEncodingReader(s.encKey, s.signKey, kbcrypto.SignaturePrefixChatAttachment, nonce, r), nil
}

// EncryptResume is used to create a SignEncrypter to resume an interrupted attachment upload.
// It is *very* important that the keys passed in are not used to encrypt different plaintext
// than their original usage.
func (s *SignEncrypter) EncryptResume(r io.Reader, nonce signencrypt.Nonce, encKey signencrypt.SecretboxKey, signKey signencrypt.SignKey, verifyKey signencrypt.VerifyKey) (io.Reader, error) {
	s.encKey = encKey
	s.signKey = signKey
	s.verifyKey = verifyKey
	return signencrypt.NewEncodingReader(s.encKey, s.signKey, kbcrypto.SignaturePrefixChatAttachment, nonce, r), nil
}

func (s *SignEncrypter) EncryptKey() []byte {
	return []byte((*s.encKey)[:])
}

func (s *SignEncrypter) SignKey() []byte {
	return []byte((*s.signKey)[:])
}

func (s *SignEncrypter) VerifyKey() []byte {
	return []byte((*s.verifyKey)[:])
}

func (s *SignEncrypter) makeKeys() error {
	var encKey [signencrypt.SecretboxKeySize]byte
	n, err := rand.Read(encKey[:])
	if err != nil {
		return err
	}
	if n != signencrypt.SecretboxKeySize {
		return errors.New("failed to rand.Read the correct number of bytes")
	}

	sign, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return err
	}

	var signKey [ed25519.PrivateKeySize]byte
	copy(signKey[:], (*sign.Private)[:])
	var verifyKey [ed25519.PublicKeySize]byte
	copy(verifyKey[:], sign.Public[:])

	s.encKey = &encKey
	s.signKey = &signKey
	s.verifyKey = &verifyKey

	return nil
}

type SignDecrypter struct{}

func NewSignDecrypter() *SignDecrypter {
	return &SignDecrypter{}
}

func (s *SignDecrypter) Decrypt(r io.Reader, encKey, verifyKey []byte) io.Reader {
	var xencKey [signencrypt.SecretboxKeySize]byte
	copy(xencKey[:], encKey)
	var xverifyKey [ed25519.PublicKeySize]byte
	copy(xverifyKey[:], verifyKey)
	return signencrypt.NewDecodingReader(&xencKey, &xverifyKey, kbcrypto.SignaturePrefixChatAttachment, nonceConst, r)
}

func (s *SignDecrypter) DecryptWithNonce(r io.Reader, nonce signencrypt.Nonce, encKey, verifyKey []byte) (plaintext io.Reader) {
	var xencKey [signencrypt.SecretboxKeySize]byte
	copy(xencKey[:], encKey)
	var xverifyKey [ed25519.PublicKeySize]byte
	copy(xverifyKey[:], verifyKey)
	return signencrypt.NewDecodingReader(&xencKey, &xverifyKey, kbcrypto.SignaturePrefixChatAttachment, nonce, r)
}
