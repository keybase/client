package libkb

import (
	"golang.org/x/crypto/openpgp"
)

// ScanKeys finds pgp decryption keys in SKB and also if there is
// one stored on the server.  It satisfies the openpgp.KeyRing
// interface.
type ScanKeys struct {
	keys openpgp.EntityList
}

// enforce ScanKeys implements openpgp.KeyRing:
var _ openpgp.KeyRing = &ScanKeys{}

func NewScanKeys(u *User, ui SecretUI) (*ScanKeys, error) {
	if u == nil {
		return nil, ErrNilUser
	}
	ring, err := G.LoadSKBKeyring(u.GetName())
	if err != nil {
		return nil, err
	}
	synced, err := u.GetSyncedSecretKey()
	if err != nil {
		return nil, err
	}
	sk := &ScanKeys{}
	if err := sk.extractKeys(ring, synced, ui); err != nil {
		return nil, err
	}
	return sk, nil
}

func (s *ScanKeys) Count() int {
	return len(s.keys)
}

// KeysById returns the set of keys that have the given key id.
func (s *ScanKeys) KeysById(id uint64) []openpgp.Key {
	return s.keys.KeysById(id)
}

// KeysByIdAndUsage returns the set of keys with the given id
// that also meet the key usage given by requiredUsage.
// The requiredUsage is expressed as the bitwise-OR of
// packet.KeyFlag* values.
func (s *ScanKeys) KeysByIdUsage(id uint64, requiredUsage byte) []openpgp.Key {
	return s.keys.KeysByIdUsage(id, requiredUsage)
}

// DecryptionKeys returns all private keys that are valid for
// decryption.
func (s *ScanKeys) DecryptionKeys() []openpgp.Key {
	return s.keys.DecryptionKeys()
}

func (s *ScanKeys) extractKeys(ring *SKBKeyringFile, synced *SKB, ui SecretUI) error {
	if err := s.extractKey(synced, ui); err != nil {
		return err
	}

	for _, b := range ring.Blocks {
		if err := s.extractKey(b, ui); err != nil {
			return err
		}
	}

	return nil
}

func (s *ScanKeys) extractKey(skb *SKB, ui SecretUI) error {
	if skb == nil {
		return nil
	}
	k, err := skb.PromptAndUnlock("", "", ui)
	if err != nil {
		return err
	}
	bundle, ok := k.(*PgpKeyBundle)
	if ok {
		s.keys = append(s.keys, (*openpgp.Entity)(bundle))
	} else {
		G.Log.Debug("not pgp key: %T", k)
	}
	return nil
}
