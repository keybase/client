package libkb

type Boxer interface {
	// Encrypts the given data with the peer's public key and our
	// private key.
	Box(data []byte, nonce [24]byte, peersPublicKey [32]byte) []byte
}

type Unboxer interface {
	// Decrypts the given data, which is assumed to have been
	// boxed with the peer's private key and our public key.
	Unbox(boxedData []byte, nonce [24]byte, peersPublicKey [32]byte) ([]byte, bool)
}
