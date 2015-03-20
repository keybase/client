package libkb

import (
	"golang.org/x/crypto/openpgp"
)

// ScanKeys finds pgp decryption keys in SKB and also if there is
// one stored on the server.  It satisfies the openpgp.KeyRing
// interface.
type ScanKeys struct {
}

// enforce ScanKeys implements openpgp.KeyRing:
var _ openpgp.KeyRing = &ScanKeys{}

func NewScanKeys(u *User) (*ScanKeys, error) {
	if u == nil {
		return nil, ErrNilUser
	}
	ring, err := G.LoadSKBKeyring(u.GetName())
	if err != nil {
		return nil, err
	}
	_ = ring
	return &ScanKeys{}, nil
}

// KeysById returns the set of keys that have the given key id.
func (s *ScanKeys) KeysById(id uint64) []openpgp.Key {
	return nil
}

// KeysByIdAndUsage returns the set of keys with the given id
// that also meet the key usage given by requiredUsage.
// The requiredUsage is expressed as the bitwise-OR of
// packet.KeyFlag* values.
func (s *ScanKeys) KeysByIdUsage(id uint64, requiredUsage byte) []openpgp.Key {
	return nil
}

// DecryptionKeys returns all private keys that are valid for
// decryption.
func (s *ScanKeys) DecryptionKeys() []openpgp.Key {
	return nil
}
