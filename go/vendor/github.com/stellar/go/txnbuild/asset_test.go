package txnbuild

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/stellar/go/xdr"
	"github.com/stretchr/testify/assert"
)

func TestNativeAssetToXDR(t *testing.T) {
	asset := NativeAsset{}

	received, err := asset.ToXDR()
	assert.Nil(t, err)

	expected := xdr.Asset{Type: xdr.AssetTypeAssetTypeNative}
	assert.Equal(t, expected, received, "Empty asset converts to native XDR")
}

func TestAlphaNum4AssetToXDR(t *testing.T) {
	asset := CreditAsset{
		Code:   "USD",
		Issuer: newKeypair0().Address(),
	}
	var xdrAssetCode [4]byte
	copy(xdrAssetCode[:], asset.Code)
	var xdrIssuer xdr.AccountId
	require.NoError(t, xdrIssuer.SetAddress(asset.Issuer))

	received, err := asset.ToXDR()
	assert.Nil(t, err)

	expected := xdr.Asset{Type: xdr.AssetTypeAssetTypeCreditAlphanum4,
		AlphaNum4: &xdr.AssetAlphaNum4{
			AssetCode: xdrAssetCode,
			Issuer:    xdrIssuer,
		}}
	assert.Equal(t, expected, received, "4 digit codes ok")
}

func TestAlphaNum12AssetToXDR(t *testing.T) {
	asset := CreditAsset{
		Code:   "MEGAUSD",
		Issuer: newKeypair0().Address(),
	}
	var xdrAssetCode [12]byte
	copy(xdrAssetCode[:], asset.Code)
	var xdrIssuer xdr.AccountId
	require.NoError(t, xdrIssuer.SetAddress(asset.Issuer))

	received, err := asset.ToXDR()
	assert.Nil(t, err)

	expected := xdr.Asset{Type: xdr.AssetTypeAssetTypeCreditAlphanum12,
		AlphaNum12: &xdr.AssetAlphaNum12{
			AssetCode: xdrAssetCode,
			Issuer:    xdrIssuer,
		}}
	assert.Equal(t, expected, received, "12 digit codes ok")
}

func TestCodeTooShort(t *testing.T) {
	asset := CreditAsset{
		Code:   "",
		Issuer: newKeypair0().Address(),
	}
	var xdrAssetCode [12]byte
	copy(xdrAssetCode[:], asset.Code)
	var xdrIssuer xdr.AccountId
	require.NoError(t, xdrIssuer.SetAddress(asset.Issuer))

	_, err := asset.ToXDR()
	expectedErrMsg := "asset code length must be between 1 and 12 characters: Asset code length is invalid"
	require.EqualError(t, err, expectedErrMsg, "Minimum code length should be enforced")
}

func TestCodeTooLong(t *testing.T) {
	asset := CreditAsset{
		Code:   "THIRTEENCHARS",
		Issuer: newKeypair0().Address(),
	}
	var xdrAssetCode [12]byte
	copy(xdrAssetCode[:], asset.Code)
	var xdrIssuer xdr.AccountId
	require.NoError(t, xdrIssuer.SetAddress(asset.Issuer))

	_, err := asset.ToXDR()
	expectedErrMsg := "asset code length must be between 1 and 12 characters: Asset code length is invalid"
	require.EqualError(t, err, expectedErrMsg, "Maximum code length should be enforced")
}

func TestBadIssuer(t *testing.T) {
	asset := CreditAsset{
		Code:   "USD",
		Issuer: "DOESNTLOOKLIKEANADDRESS",
	}
	var xdrAssetCode [4]byte
	copy(xdrAssetCode[:], asset.Code)
	var xdrIssuer xdr.AccountId
	expectedErrMsg := "base32 decode failed: illegal base32 data at input byte 16"
	require.EqualError(t, xdrIssuer.SetAddress(asset.Issuer), expectedErrMsg, "Issuer address should be validated")
}
