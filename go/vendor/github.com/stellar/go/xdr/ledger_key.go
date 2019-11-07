package xdr

import (
	"fmt"
	"strings"
)

// LedgerKey implements the `Keyer` interface
func (key *LedgerKey) LedgerKey() LedgerKey {
	return *key
}

// Equals returns true if `other` is equivalent to `key`
func (key *LedgerKey) Equals(other LedgerKey) bool {
	if key.Type != other.Type {
		return false
	}

	switch key.Type {
	case LedgerEntryTypeAccount:
		l := key.MustAccount()
		r := other.MustAccount()
		return l.AccountId.Equals(r.AccountId)
	case LedgerEntryTypeData:
		l := key.MustData()
		r := other.MustData()
		return l.AccountId.Equals(r.AccountId) && l.DataName == r.DataName
	case LedgerEntryTypeOffer:
		l := key.MustOffer()
		r := other.MustOffer()
		return l.SellerId.Equals(r.SellerId) && l.OfferId == r.OfferId
	case LedgerEntryTypeTrustline:
		l := key.MustTrustLine()
		r := other.MustTrustLine()
		return l.AccountId.Equals(r.AccountId) && l.Asset.Equals(r.Asset)
	default:
		panic(fmt.Errorf("Unknown ledger key type: %v", key.Type))
	}
}

// SetAccount mutates `key` such that it represents the identity of `account`
func (key *LedgerKey) SetAccount(account AccountId) error {
	data := LedgerKeyAccount{account}
	nkey, err := NewLedgerKey(LedgerEntryTypeAccount, data)
	if err != nil {
		return err
	}

	*key = nkey
	return nil
}

// SetData mutates `key` such that it represents the identity of the
// data entry owned by `account` and for `name`.
func (key *LedgerKey) SetData(account AccountId, name string) error {
	data := LedgerKeyData{account, String64(name)}
	nkey, err := NewLedgerKey(LedgerEntryTypeData, data)
	if err != nil {
		return err
	}

	*key = nkey
	return nil
}

// SetOffer mutates `key` such that it represents the identity of the
// data entry owned by `account` and for offer `id`.
func (key *LedgerKey) SetOffer(account AccountId, id uint64) error {
	data := LedgerKeyOffer{account, Int64(id)}
	nkey, err := NewLedgerKey(LedgerEntryTypeOffer, data)
	if err != nil {
		return err
	}

	*key = nkey
	return nil
}

// SetTrustline mutates `key` such that it represents the identity of the
// trustline owned by `account` and for `asset`.
func (key *LedgerKey) SetTrustline(account AccountId, line Asset) error {
	data := LedgerKeyTrustLine{account, line}
	nkey, err := NewLedgerKey(LedgerEntryTypeTrustline, data)
	if err != nil {
		return err
	}

	*key = nkey
	return nil
}

// MarshalBinaryCompress marshals LedgerKey to []byte but unlike
// MarshalBinary() it removes all unnecessary bytes, exploting the fact
// that XDR is padding data to 4 bytes in union discriminants etc.
// It's primary use is in ingest/io.StateReader that keep LedgerKeys in
// memory so this function decrease memory requirements.
//
// Warning, do not use UnmarshalBinary() on data encoded using this method!
//
// Optimizations:
// - Writes a single byte for union discriminants vs 4 bytes.
// - Removes type and code padding for Asset.
func (key LedgerKey) MarshalBinaryCompress() ([]byte, error) {
	m := []byte{byte(key.Type)}

	switch key.Type {
	case LedgerEntryTypeAccount:
		account, err := key.Account.AccountId.MarshalBinaryCompress()
		if err != nil {
			return nil, err
		}
		m = append(m, account...)
	case LedgerEntryTypeTrustline:
		account, err := key.TrustLine.AccountId.MarshalBinaryCompress()
		if err != nil {
			return nil, err
		}
		m = append(m, account...)
		asset, err := key.TrustLine.Asset.MarshalBinaryCompress()
		if err != nil {
			return nil, err
		}
		m = append(m, asset...)
	case LedgerEntryTypeOffer:
		seller, err := key.Offer.SellerId.MarshalBinaryCompress()
		if err != nil {
			return nil, err
		}
		m = append(m, seller...)
		offer, err := key.Offer.OfferId.MarshalBinary()
		if err != nil {
			return nil, err
		}
		m = append(m, offer...)
	case LedgerEntryTypeData:
		account, err := key.Data.AccountId.MarshalBinaryCompress()
		if err != nil {
			return nil, err
		}
		m = append(m, account...)
		dataName := []byte(strings.TrimRight(string(key.Data.DataName), "\x00"))
		m = append(m, dataName...)
	default:
		panic("Unknown type")
	}

	return m, nil
}
