package stellarnet

import "github.com/stellar/go/keypair"

// NewKeyPair creates a new random stellar keypair.
func NewKeyPair() (*keypair.Full, error) {
	return keypair.Random()
}

// SeedStr is a string representation of a private stellar key.
type SeedStr string

// AddressStr is a string representation of a public stellar key.
type AddressStr string

// NewSeedStr ensures that s is a valid stellar seed.
func NewSeedStr(s string) (SeedStr, error) {
	// parse s to make sure it is a valid seed
	kp, err := keypair.Parse(s)
	if err != nil {
		return "", err
	}

	switch kp.(type) {
	case *keypair.Full:
		return SeedStr(s), nil
	case *keypair.FromAddress:
		return "", ErrAddressNotSeed
	}

	return "", ErrUnknownKeypairType
}

func (s SeedStr) String() string {
	return "DONOTLOGDONOTLOGDONOTLOGDONOTLOGDONOTLOGDONOTLOGDONOTLOG"
}

// SecureNoLogString returns a native string representation of SeedStr.
// It should not be logged or persisted anywhere.
func (s SeedStr) SecureNoLogString() string {
	return string(s)
}

// NewAddressStr ensures that s is a valid stellar address.
func NewAddressStr(s string) (AddressStr, error) {
	// parse s to make sure it is a valid address
	kp, err := keypair.Parse(s)
	if err != nil {
		return "", err
	}

	switch kp.(type) {
	case *keypair.FromAddress:
		return AddressStr(s), nil
	case *keypair.Full:
		return "", ErrSeedNotAddress
	}

	return "", ErrUnknownKeypairType
}

func (s AddressStr) String() string { return string(s) }
