package xdr

import (
	"fmt"
)

// ToAsset converts `a` to a proper xdr.Asset
func (a AllowTrustOpAsset) ToAsset(issuer AccountId) (ret Asset) {
	var err error

	switch a.Type {
	case AssetTypeAssetTypeCreditAlphanum4:

		ret, err = NewAsset(AssetTypeAssetTypeCreditAlphanum4, AssetAlphaNum4{
			AssetCode: a.MustAssetCode4(),
			Issuer:    issuer,
		})
	case AssetTypeAssetTypeCreditAlphanum12:
		ret, err = NewAsset(AssetTypeAssetTypeCreditAlphanum12, AssetAlphaNum12{
			AssetCode: a.MustAssetCode12(),
			Issuer:    issuer,
		})
	default:
		err = fmt.Errorf("Unexpected type for AllowTrustOpAsset: %d", a.Type)
	}

	if err != nil {
		panic(err)
	}
	return
}
