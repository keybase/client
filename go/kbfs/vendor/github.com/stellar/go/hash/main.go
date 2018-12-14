package hash

import (
	"crypto/sha256"
)

// Hash returns a 32-byte hash for the provided message using the secure hash
// algorithm chosen for the Stellar network (SHA-256)
func Hash(message []byte) [32]byte {
	return sha256.Sum256(message)
}
