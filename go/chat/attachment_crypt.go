package chat

import "io"

type Encrypter interface {
	// EncryptedLen returns the number of bytes that the ciphertext of
	// size plaintext bytes will be.
	EncryptedLen(size int) int

	// Encrypt takes a plaintext reader and returns a ciphertext reader.
	Encrypt(plaintext io.Reader) (ciphertext io.Reader)

	// Key returns the ephemeral key that was used during Encrypt.
	Key() []byte
}

type Decrypter interface {
	// Decrypt takes a ciphertext reader and a key and returns a
	// plaintext reader.
	Decrypt(ciphertext io.Reader, key []byte) (plaintext io.Reader, err error)
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

func (p *PassThrough) Key() []byte {
	return nil
}

func (p *PassThrough) Decrypt(r io.Reader, key []byte) (io.Reader, error) {
	return r, nil
}
