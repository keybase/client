package chat

import (
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
	Encrypt(plaintext io.Reader) (ciphertext io.Reader)

	// EncryptKey returns the ephemeral key that was used during Encrypt.
	EncryptKey() []byte

	// VerifyKey returns the public portion of the signing key that
	// can be used for signature verification.
	VerifyKey() []byte
}

type Decrypter interface {
	// Decrypt takes a ciphertext reader and a key and returns a
	// plaintext reader.
	Decrypt(ciphertext io.Reader, encKey, verifyKey []byte) (plaintext io.Reader)
}

// PassThrough implements Encrypter and Decrypter.  It does no encryption
// or decryption.
type PassThrough struct{}

func NewPassThrough() *PassThrough {
	return &PassThrough{}
}

func (p *PassThrough) EncryptedLen(size int) int {
	return size
}

func (p *PassThrough) Encrypt(r io.Reader) io.Reader {
	return r
}

func (p *PassThrough) EncryptKey() []byte {
	return nil
}

func (p *PassThrough) VerifyKey() []byte {
	return nil
}

func (p *PassThrough) Decrypt(r io.Reader, encKey, verifyKey []byte) io.Reader {
	return r
}

var nonce = &[signencrypt.NonceSize]byte{
	0x10, 0x10, 0x10, 0x10, 0x20, 0x20, 0x20, 0x20,
	0x30, 0x30, 0x30, 0x30, 0x40, 0x40, 0x40, 0x40,
}

type SignEncrypter struct {
	encKey    signencrypt.SecretboxKey
	signKey   signencrypt.SignKey
	verifyKey signencrypt.VerifyKey
}

func NewSignEncrypter() (*SignEncrypter, error) {
	enc, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return nil, err
	}
	sign, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return nil, err
	}

	var encKey [signencrypt.SecretboxKeySize]byte
	copy(encKey[:], (*enc.Private)[:])
	var signKey [ed25519.PrivateKeySize]byte
	copy(signKey[:], (*sign.Private)[:])
	var verifyKey [ed25519.PublicKeySize]byte
	copy(verifyKey[:], sign.Public[:])

	res := SignEncrypter{
		encKey:    &encKey,
		signKey:   &signKey,
		verifyKey: &verifyKey,
	}

	return &res, nil
}

func (s *SignEncrypter) EncryptedLen(size int) int {
	return signencrypt.GetSealedSize(size)
}

func (s *SignEncrypter) Encrypt(r io.Reader) io.Reader {
	return signencrypt.NewEncodingReader(s.encKey, s.signKey, nonce, r)
}

func (s *SignEncrypter) EncryptKey() []byte {
	return []byte((*s.encKey)[:])
}

func (s *SignEncrypter) VerifyKey() []byte {
	return []byte((*s.verifyKey)[:])
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
