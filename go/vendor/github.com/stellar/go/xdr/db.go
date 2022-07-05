package xdr

import (
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/lib/pq"
)

// This file contains implementations of the sql.Scanner interface for stellar xdr types

// Scan reads from src into an AccountFlags
func (t *AccountFlags) Scan(src interface{}) error {
	val, ok := src.(int64)
	if !ok {
		return errors.New("Invalid value for xdr.AccountFlags")
	}

	*t = AccountFlags(val)
	return nil
}

// Scan reads from src into an AssetType
func (t *AssetType) Scan(src interface{}) error {
	val, ok := src.(int64)
	if !ok {
		return errors.New("Invalid value for xdr.AssetType")
	}

	*t = AssetType(val)
	return nil
}

// Scan reads from src into an Asset
func (t *Asset) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an Int64
func (t *Int64) Scan(src interface{}) error {
	val, ok := src.(int64)
	if !ok {
		return errors.New("Invalid value for xdr.Int64")
	}

	*t = Int64(val)
	return nil
}

// Scan reads from a src into an xdr.Price
func (t *Price) Scan(src interface{}) error {
	// assuming the price is represented as a two-element array [n,d]
	arr := pq.Int64Array{}
	err := arr.Scan(src)

	if err != nil {
		return err
	}

	if len(arr) != 2 {
		return errors.New("price array should have exactly 2 elements")
	}

	*t = Price{Int32(arr[0]), Int32(arr[1])}
	return nil
}

// Scan reads from a src into an xdr.Hash
func (t *Hash) Scan(src interface{}) error {
	decodedBytes, err := hex.DecodeString(string(src.([]uint8)))
	if err != nil {
		return err
	}

	var decodedHash Hash
	copy(decodedHash[:], decodedBytes)

	*t = decodedHash

	return nil
}

// Scan reads from src into an LedgerEntryChanges struct
func (t *LedgerEntryChanges) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an LedgerHeader struct
func (t *LedgerHeader) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an ScpEnvelope struct
func (t *ScpEnvelope) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an ScpEnvelope struct
func (t *ScpQuorumSet) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an Thresholds struct
func (t *Thresholds) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an TransactionEnvelope struct
func (t *TransactionEnvelope) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an TransactionMeta struct
func (t *TransactionMeta) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an TransactionResult struct
func (t *TransactionResult) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// Scan reads from src into an TransactionResultPair struct
func (t *TransactionResultPair) Scan(src interface{}) error {
	return safeBase64Scan(src, t)
}

// safeBase64Scan scans from src (which should be either a []byte or string)
// into dest by using `SafeUnmarshalBase64`.
func safeBase64Scan(src, dest interface{}) error {
	var val string
	switch src := src.(type) {
	case []byte:
		val = string(src)
	case string:
		val = src
	default:
		return fmt.Errorf("Invalid value for %T", dest)
	}

	return SafeUnmarshalBase64(val, dest)
}
