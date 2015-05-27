package libkb

type BytesSigner interface {
	// Sign to a binary signature (which doesn't include the
	// message) and return it, along with a verifier.
	SignToBytes(msg []byte) (sig []byte, verifier BytesVerifier, err error)
}

type BytesVerifier interface {
	// Return the KID of the verifying key. Named
	// GetVerifyingKid() to avoid colliding with
	// GenericKey.GetKid().
	GetVerifyingKid() KID

	// Verify that the given signature is valid and is for the
	// given message.
	VerifyBytes(sig, msg []byte) (err error)
}
