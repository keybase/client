package triplesec

import (
	"fmt"
)

type CorruptionError struct {
	msg string
}

func (e CorruptionError) Error() string {
	return "Triplesec corruption: " + e.msg
}

type VersionError struct {
	v Version
}

func (e VersionError) Error() string {
	return fmt.Sprintf("Unknown version: %v", e.v)
}

type BadPassphraseError struct{}

func (e BadPassphraseError) Error() string {
	return "Bad passphrase (or inflight message tampering)"
}
