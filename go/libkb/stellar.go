package libkb

import (
	"encoding/base32"
	"errors"
	"fmt"
	"strings"

	stellar1 "github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/keypair"
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

// ParseStellarSecretKey parses a secret key and returns it and the AccountID it is the master key of.
// Returns helpful error messages than can be shown to users.
func ParseStellarSecretKey(secStr string) (stellar1.SecretKey, stellar1.AccountID, error) {
	secStr = strings.ToUpper(secStr)
	if len(secStr) != 56 {
		return "", "", fmt.Errorf("stellar secret key must be 56 chars long: was %v", len(secStr))
	}
	_, err := base32.StdEncoding.DecodeString(secStr)
	if err != nil {
		return "", "", fmt.Errorf("invalid characters in stellar secret key")
	}
	kp, err := keypair.Parse(secStr)
	if err != nil {
		return "", "", fmt.Errorf("invalid stellar secret key: %v", err)
	}
	switch kp := kp.(type) {
	case *keypair.FromAddress:
		return "", "", errors.New("unexpected stellar account ID, expected secret key")
	case *keypair.Full:
		return stellar1.SecretKey(kp.Seed()), stellar1.AccountID(kp.Address()), nil
	default:
		return "", "", fmt.Errorf("invalid stellar secret key")
	}
}
