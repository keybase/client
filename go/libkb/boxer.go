package libkb

// TODO: Probably need to add Boxer interface, too.

type Unboxer interface {
	// Decrypts the given data, which is assumed to have been
	// boxed with the peer's private key and our public key.
	Unbox(boxedData []byte, nonce [24]byte, peersPublicKey [32]byte) ([]byte, bool)
}
