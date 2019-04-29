package libkb

import (
	"encoding/base32"
	"errors"
	"fmt"
	"regexp"
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
func ParseStellarSecretKey(secStr string) (stellar1.SecretKey, stellar1.AccountID, *keypair.Full, error) {
	secStr = strings.ToUpper(secStr)
	if len(secStr) != 56 {
		return "", "", nil, fmt.Errorf("Stellar secret key must be 56 chars long: was %v", len(secStr))
	}
	_, err := base32.StdEncoding.DecodeString(secStr)
	if err != nil {
		return "", "", nil, fmt.Errorf("invalid characters in Stellar secret key")
	}
	kp, err := keypair.Parse(secStr)
	if err != nil {
		return "", "", nil, fmt.Errorf("invalid Stellar secret key: %v", err)
	}
	switch kp := kp.(type) {
	case *keypair.FromAddress:
		return "", "", nil, errors.New("unexpected Stellar account ID, expected secret key")
	case *keypair.Full:
		return stellar1.SecretKey(kp.Seed()), stellar1.AccountID(kp.Address()), kp, nil
	default:
		return "", "", nil, fmt.Errorf("invalid Stellar secret key")
	}
}

// ParseStellarAccountID parses an account ID and returns it.
// Returns helpful error messages than can be shown to users.
func ParseStellarAccountID(idStr string) (stellar1.AccountID, error) {
	idStr = strings.ToUpper(idStr)
	if len(idStr) != 56 {
		return "", NewInvalidStellarAccountIDError(fmt.Sprintf("Stellar account ID must be 56 chars long: was %v", len(idStr)))
	}
	_, err := base32.StdEncoding.DecodeString(idStr)
	if err != nil {
		return "", NewInvalidStellarAccountIDError("invalid characters in Stellar account ID")
	}
	kp, err := keypair.Parse(idStr)
	if err != nil {
		return "", NewInvalidStellarAccountIDError(fmt.Sprintf("invalid Stellar account ID key: %s", err))
	}
	switch kp := kp.(type) {
	case *keypair.FromAddress:
		return stellar1.AccountID(kp.Address()), nil
	case *keypair.Full:
		return "", NewInvalidStellarAccountIDError("unexpected Stellar secret key, expected account ID")
	default:
		return "", NewInvalidStellarAccountIDError("invalid keypair type")
	}
}

// SimplifyAmount
// Amount must be a decimal amount like "1.0" or "50"
// Strip trailing zeros after a "."
// Example: "1.0010000" -> "1.001"
// Example: "1.0000000" -> "1"
func StellarSimplifyAmount(amount string) string {
	sides := strings.Split(amount, ".")
	if len(sides) != 2 {
		return amount
	}
	simpleRight := strings.TrimRight(sides[1], "0")
	if strings.Contains(sides[0], ",") {
		// If integer part has the thousands separator (comma), always
		// print the fractional part with at least two digits - this
		// is to ensure that thousands separator is not confused with
		// decimal point.
		for len(simpleRight) < 2 {
			simpleRight = simpleRight + "0"
		}
	} else if len(simpleRight) == 0 {
		return sides[0]
	}
	return sides[0] + "." + simpleRight
}

var assetCodePattern = regexp.MustCompile(`^[a-zA-Z0-9]{1,12}$`)

func ParseStellarAssetCode(codeStr string) (res stellar1.AssetCode, err error) {
	if len(codeStr) < 1 && len(codeStr) > 12 {
		return res, fmt.Errorf("asset code must be between 1 and 12 characters long")
	}
	if !assetCodePattern.MatchString(codeStr) {
		return res, fmt.Errorf("asset code must contain alphanumeric characters only")
	}
	fmt.Printf("%s parsed\n", codeStr)
	return stellar1.AssetCode(codeStr), nil
}
