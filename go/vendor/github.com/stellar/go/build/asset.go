package build

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// MustXDR is the panicky version of ToXDR
func (a Asset) MustXDR() xdr.Asset {
	ret, err := a.ToXDR()
	if err != nil {
		panic(err)
	}
	return ret
}

// ToXDR creates xdr.Asset object from build.Asset object
func (a Asset) ToXDR() (xdr.Asset, error) {
	if a.Native {
		return xdr.NewAsset(xdr.AssetTypeAssetTypeNative, nil)
	}

	var issuer xdr.AccountId
	err := setAccountId(a.Issuer, &issuer)
	if err != nil {
		return xdr.Asset{}, err
	}

	length := len(a.Code)
	switch {
	case length >= 1 && length <= 4:
		var codeArray [4]byte
		byteArray := []byte(a.Code)
		copy(codeArray[:], byteArray[0:length])
		asset := xdr.AssetAlphaNum4{AssetCode: codeArray, Issuer: issuer}
		return xdr.NewAsset(xdr.AssetTypeAssetTypeCreditAlphanum4, asset)
	case length >= 5 && length <= 12:
		var codeArray [12]byte
		byteArray := []byte(a.Code)
		copy(codeArray[:], byteArray[0:length])
		asset := xdr.AssetAlphaNum12{AssetCode: codeArray, Issuer: issuer}
		return xdr.NewAsset(xdr.AssetTypeAssetTypeCreditAlphanum12, asset)
	default:
		return xdr.Asset{}, errors.New("Asset code length is invalid")
	}
}
