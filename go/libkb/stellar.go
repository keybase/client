package libkb

import (
	stellar1 "github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/strkey"
)

func MakeNaclSigningKeyPairFromStellarAccountID(accountID stellar1.AccountID) (res NaclSigningKeyPair, err error) {
	byteSlice, err := strkey.Decode(strkey.VersionByteAccountID, accountID.String())
	if err != nil {
		return res, err
	}
	bytes32, err := MakeByte32Soft(byteSlice)
	if err != nil {
		return res, err
	}
	return NaclSigningKeyPair{
		Public:  bytes32,
		Private: nil,
	}, nil
}

func MakeNaclSigningKeyPairFromStellarSecretKey(sec stellar1.SecretKey) (res NaclSigningKeyPair, err error) {
	byteSlice, err := strkey.Decode(strkey.VersionByteSeed, sec.SecureNoLogString())
	if err != nil {
		return res, err
	}
	return MakeNaclSigningKeyPairFromSecretBytes(byteSlice)
}
