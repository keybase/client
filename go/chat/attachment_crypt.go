package chat

import (
	"crypto/rand"
	"errors"
	"io"

	"github.com/agl/ed25519"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/libkb"
)

type Encrypter interface {
	// EncryptedLen returns the number of bytes that the ciphertext of
	// size plaintext bytes will be.
	EncryptedLen(size int) int

	// Encrypt takes a plaintext reader and returns a ciphertext reader.
	// It generates new keys every time it is called.
	Encrypt(plaintext io.Reader) (ciphertext io.Reader, err error)

	// EncryptKey returns the ephemeral key that was used during Encrypt.
	EncryptKey() []byte

	// VerifyKey returns the public portion of the signing key that
	// can be used for signature verification.
	VerifyKey() []byte
}

type Decrypter interface {
	// Decrypt takes a ciphertext reader, encryption and verify keys.
	// It returns a plaintext reader.
	Decrypt(ciphertext io.Reader, encKey, verifyKey []byte) (plaintext io.Reader)
}

var nonce signencrypt.Nonce

func init() {
	var n [signencrypt.NonceSize]byte
	copy(n[:], "kbchatattachment")
	nonce = &n
}

type SignEncrypter struct {
	encKey    signencrypt.SecretboxKey
	signKey   signencrypt.SignKey
	verifyKey signencrypt.VerifyKey
}

func NewSignEncrypter() *SignEncrypter {
	return &SignEncrypter{}
}

func (s *SignEncrypter) EncryptedLen(size int) int {
	return signencrypt.GetSealedSize(size)
}

func (s *SignEncrypter) Encrypt(r io.Reader) (io.Reader, error) {
	if err := s.makeKeys(); err != nil {
		return nil, err
	}
	return signencrypt.NewEncodingReader(s.encKey, s.signKey, nonce, r), nil
}

func (s *SignEncrypter) EncryptKey() []byte {
	return []byte((*s.encKey)[:])
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
	return signencrypt.NewDecodingReader(&xencKey, &xverifyKey, nonce, r)
}
