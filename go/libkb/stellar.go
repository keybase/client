package libkb

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stellar/go/strkey"
)

func MakeNaclSigningKeyPairFromStellarAccountID(accountID keybase1.StellarAccountID) (res NaclSigningKeyPair, err error) {
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

func MakeNaclSigningKeyPairFromStellarSecretKey(sec keybase1.StellarSecretKey) (res NaclSigningKeyPair, err error) {
	byteSlice, err := strkey.Decode(strkey.VersionByteSeed, sec.String())
	if err != nil {
		return res, err
	}
	return MakeNaclSigningKeyPairFromSecretBytes(byteSlice)
}

// Make the "stellar" section of an API arg.
// Modifies `serverArg`.
func AddWalletServerArg(serverArg JSONPayload, bundleEncB64 string, bundleVisB64 string, formatVersion int) {
	section := make(JSONPayload)
	section["encrypted"] = bundleEncB64
	section["visible"] = bundleVisB64
	section["version"] = formatVersion
	serverArg["stellar"] = section
}
