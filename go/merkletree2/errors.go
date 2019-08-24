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
