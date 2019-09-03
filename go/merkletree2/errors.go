package merkletree2

import "fmt"

// InvalidConfigError happens when trying to construct an invalid tree configuration.
type InvalidConfigError struct {
	reason string
}

func (e InvalidConfigError) Error() string {
	return fmt.Sprintf("Invalid Config Error: %s", e.reason)
}

// NewInvalidConfigError returns a new error
func NewInvalidConfigError(reason string) InvalidConfigError {
	return InvalidConfigError{reason: reason}
}

// InvalidKeyError is returned when trying to use a key of the wrong length in a tree.
type InvalidKeyError struct{}

func (e InvalidKeyError) Error() string {
	return fmt.Sprintf("Invalid Key (has the wrong length).")
}

// NewInvalidKeyError returns a new error
func NewInvalidKeyError() InvalidKeyError {
	return InvalidKeyError{}
}

// ProofVerificationFailedError is returned when a merkle tree proof verification fails.
type ProofVerificationFailedError struct {
	reason error
}

func (e ProofVerificationFailedError) Error() string {
	return fmt.Sprintf("Proof Verification Error: %s", e.reason)
}

// NewProofVerificationFailedError returns a new error
func NewProofVerificationFailedError(reason error) ProofVerificationFailedError {
	return ProofVerificationFailedError{reason: reason}
}

// KeyNotFoundError is returned when trying to fetch a key which is not part of
// the tree at a specific Seqno.
type KeyNotFoundError struct{}

func (e KeyNotFoundError) Error() string {
	return fmt.Sprintf("Key not found.")
}

// NewKeyNotFoundError returns a new error
func NewKeyNotFoundError() KeyNotFoundError {
	return KeyNotFoundError{}
}

// InvalidSeqnoError is returned when trying to lookup a record with an invalid
// Seqno
type InvalidSeqnoError struct {
	s      Seqno
	reason error
}

func (e InvalidSeqnoError) Error() string {
	return fmt.Sprintf("Invalid Seqno Error (Seqno: %v): %s", e.s, e.reason)
}

// NewInvalidConfigError returns a new error
func NewInvalidSeqnoError(s Seqno, reason error) InvalidSeqnoError {
	return InvalidSeqnoError{s: s, reason: reason}
}
