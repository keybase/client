package txnbuild

import (
	"testing"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newKeypair0() *keypair.Full {
	// Address: GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3
	return newKeypair("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
}

func newKeypair1() *keypair.Full {
	// Address: GAS4V4O2B7DW5T7IQRPEEVCRXMDZESKISR7DVIGKZQYYV3OSQ5SH5LVP
	return newKeypair("SBMSVD4KKELKGZXHBUQTIROWUAPQASDX7KEJITARP4VMZ6KLUHOGPTYW")
}

func newKeypair2() *keypair.Full {
	// Address: GB7BDSZU2Y27LYNLALKKALB52WS2IZWYBDGY6EQBLEED3TJOCVMZRH7H
	return newKeypair("SBZVMB74Z76QZ3ZOY7UTDFYKMEGKW5XFJEB6PFKBF4UYSSWHG4EDH7PY")
}

func newKeypair(seed string) *keypair.Full {
	myKeypair, _ := keypair.Parse(seed)
	return myKeypair.(*keypair.Full)
}

func buildSignEncode(t *testing.T, tx Transaction, kps ...*keypair.Full) string {
	assert.NoError(t, tx.Build())
	assert.NoError(t, tx.Sign(kps...))

	txeBase64, err := tx.Base64()
	assert.NoError(t, err)

	return txeBase64
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}

func checkChallengeTx(txeBase64, anchorName string) (bool, error) {
	var txXDR xdr.TransactionEnvelope
	err := xdr.SafeUnmarshalBase64(txeBase64, &txXDR)
	if err != nil {
		return false, err
	}
	op := txXDR.Tx.Operations[0]
	if (xdr.OperationTypeManageData == op.Body.Type) && (op.Body.ManageDataOp.DataName == xdr.String64(anchorName+" auth")) {
		return true, nil
	}
	return false, errors.New("invalid challenge tx")
}

func unmarshalBase64(txeB64 string) (xdr.TransactionEnvelope, error) {
	var xdrEnv xdr.TransactionEnvelope
	err := xdr.SafeUnmarshalBase64(txeB64, &xdrEnv)
	return xdrEnv, err
}

func TestValidateStellarPublicKey(t *testing.T) {
	validKey := "GDWZCOEQRODFCH6ISYQPWY67L3ULLWS5ISXYYL5GH43W7YFMTLB65PYM"
	err := validateStellarPublicKey(validKey)
	assert.NoError(t, err, "public key should be valid")

	invalidKey := "GDWZCOEQRODFCH6ISYQPWY67L3ULLWS5ISXYYL5GH43W7Y"
	err = validateStellarPublicKey(invalidKey)
	expectedErrMsg := "GDWZCOEQRODFCH6ISYQPWY67L3ULLWS5ISXYYL5GH43W7Y is not a valid stellar public key"
	require.EqualError(t, err, expectedErrMsg, "public key should be invalid")

	invalidKey = ""
	err = validateStellarPublicKey(invalidKey)
	expectedErrMsg = "public key is undefined"
	require.EqualError(t, err, expectedErrMsg, "public key should be invalid")

	invalidKey = "SBCVMMCBEDB64TVJZFYJOJAERZC4YVVUOE6SYR2Y76CBTENGUSGWRRVO"
	err = validateStellarPublicKey(invalidKey)
	expectedErrMsg = "SBCVMMCBEDB64TVJZFYJOJAERZC4YVVUOE6SYR2Y76CBTENGUSGWRRVO is not a valid stellar public key"
	require.EqualError(t, err, expectedErrMsg, "public key should be invalid")
}

func TestValidateStellarAssetWithValidAsset(t *testing.T) {
	nativeAsset := NativeAsset{}
	err := validateStellarAsset(nativeAsset)
	assert.NoError(t, err)

	kp0 := newKeypair0()
	creditAsset := CreditAsset{"XYZ", kp0.Address()}
	err = validateStellarAsset(creditAsset)
	assert.NoError(t, err)
}

func TestValidateStellarAssetWithInValidAsset(t *testing.T) {
	err := validateStellarAsset(nil)
	assert.Error(t, err)
	expectedErrMsg := "asset is undefined"
	require.EqualError(t, err, expectedErrMsg, "An asset is required")

	kp0 := newKeypair0()
	creditAssetNoCode := CreditAsset{Code: "", Issuer: kp0.Address()}
	err = validateStellarAsset(creditAssetNoCode)
	assert.Error(t, err)
	expectedErrMsg = "asset code length must be between 1 and 12 characters"
	require.EqualError(t, err, expectedErrMsg, "An asset code is required")

	creditAssetNoIssuer := CreditAsset{Code: "ABC", Issuer: ""}
	err = validateStellarAsset(creditAssetNoIssuer)
	assert.Error(t, err)
	expectedErrMsg = "asset issuer: public key is undefined"
	require.EqualError(t, err, expectedErrMsg, "An asset issuer is required")
}

func TestValidateAmount(t *testing.T) {
	err := validateAmount(int64(10))
	assert.NoError(t, err)

	err = validateAmount("10")
	assert.NoError(t, err)

	err = validateAmount(int64(0))
	assert.NoError(t, err)

	err = validateAmount("0")
	assert.NoError(t, err)
}

func TestValidateAmountInvalidValue(t *testing.T) {
	err := validateAmount(int64(-10))
	assert.Error(t, err)
	expectedErrMsg := "amount can not be negative"
	require.EqualError(t, err, expectedErrMsg, "should be a valid stellar amount")

	err = validateAmount("-10")
	assert.Error(t, err)
	expectedErrMsg = "amount can not be negative"
	require.EqualError(t, err, expectedErrMsg, "should be a valid stellar amount")

	err = validateAmount(10)
	assert.Error(t, err)
	expectedErrMsg = "could not parse expected numeric value 10"
	require.EqualError(t, err, expectedErrMsg, "should be a valid stellar amount")

	err = validateAmount("abc")
	assert.Error(t, err)
	expectedErrMsg = "invalid amount format: abc"
	require.EqualError(t, err, expectedErrMsg, "should be a valid stellar amount")
}

func TestValidateAllowTrustAsset(t *testing.T) {
	err := validateAllowTrustAsset(nil)
	assert.Error(t, err)
	expectedErrMsg := "asset is undefined"
	require.EqualError(t, err, expectedErrMsg, "An asset is required")

	err = validateAllowTrustAsset(NativeAsset{})
	assert.Error(t, err)
	expectedErrMsg = "native (XLM) asset type is not allowed"
	require.EqualError(t, err, expectedErrMsg, "An asset is required")

	// allow trust asset does not require asset issuer
	atAsset := CreditAsset{Code: "ABCD"}
	err = validateAllowTrustAsset(atAsset)
	assert.NoError(t, err)
}

func TestValidateChangeTrustAsset(t *testing.T) {
	err := validateChangeTrustAsset(nil)
	assert.Error(t, err)
	expectedErrMsg := "asset is undefined"
	require.EqualError(t, err, expectedErrMsg, "An asset is required")

	err = validateChangeTrustAsset(NativeAsset{})
	assert.Error(t, err)
	expectedErrMsg = "native (XLM) asset type is not allowed"
	require.EqualError(t, err, expectedErrMsg, "A custom asset is required")

	kp0 := newKeypair0()
	ctAsset0 := CreditAsset{Issuer: kp0.Address()}
	err = validateChangeTrustAsset(ctAsset0)
	assert.Error(t, err)
	expectedErrMsg = "asset code length must be between 1 and 12 characters"
	require.EqualError(t, err, expectedErrMsg, "asset code is required")

	ctAsset1 := CreditAsset{Code: "ABCD"}
	err = validateChangeTrustAsset(ctAsset1)
	assert.Error(t, err)
	expectedErrMsg = "asset issuer: public key is undefined"
	require.EqualError(t, err, expectedErrMsg, "asset issuer is required")

	ctAsset2 := CreditAsset{Code: "ABCD", Issuer: kp0.Address()}
	err = validateChangeTrustAsset(ctAsset2)
	assert.NoError(t, err)
}

func TestValidatePassiveOfferZeroValues(t *testing.T) {
	cpo := CreatePassiveSellOffer{}
	err := validatePassiveOffer(cpo.Buying, cpo.Selling, cpo.Amount, cpo.Price)
	assert.Error(t, err)
	expectedErrMsg := "Field: Buying, Error: asset is undefined"
	require.EqualError(t, err, expectedErrMsg, "Buying asset is required")
}

func TestValidatePassiveOfferInvalidAmount(t *testing.T) {
	kp0 := newKeypair0()
	buying := CreditAsset{Code: "ABCD", Issuer: kp0.Address()}
	selling := NativeAsset{}
	cpo := CreatePassiveSellOffer{
		Buying:  buying,
		Selling: selling,
		Price:   "1",
		Amount:  "-1",
	}
	err := validatePassiveOffer(cpo.Buying, cpo.Selling, cpo.Amount, cpo.Price)
	assert.Error(t, err)
	expectedErrMsg := "Field: Amount, Error: amount can not be negative"
	require.EqualError(t, err, expectedErrMsg, "valid amount is required")
}

func TestValidatePassiveOfferInvalidPrice(t *testing.T) {
	kp0 := newKeypair0()
	buying := CreditAsset{Code: "ABCD", Issuer: kp0.Address()}
	selling := NativeAsset{}
	cpo := CreatePassiveSellOffer{
		Buying:  buying,
		Selling: selling,
		Price:   "-1",
		Amount:  "10",
	}
	err := validatePassiveOffer(cpo.Buying, cpo.Selling, cpo.Amount, cpo.Price)
	assert.Error(t, err)
	expectedErrMsg := "Field: Price, Error: amount can not be negative"
	require.EqualError(t, err, expectedErrMsg, "valid price is required")
}

func TestValidatePassiveOfferInvalidAsset(t *testing.T) {
	buying := NativeAsset{}
	selling := CreditAsset{Code: "ABCD"}
	cpo := CreatePassiveSellOffer{
		Buying:  buying,
		Selling: selling,
		Price:   "1",
		Amount:  "10",
	}
	err := validatePassiveOffer(cpo.Buying, cpo.Selling, cpo.Amount, cpo.Price)
	assert.Error(t, err)
	expectedErrMsg := "Field: Selling, Error: asset issuer: public key is undefined"
	require.EqualError(t, err, expectedErrMsg, "Selling asset is required")

	kp0 := newKeypair0()
	buying1 := CreditAsset{Issuer: kp0.Address()}
	selling1 := NativeAsset{}
	cpo1 := CreatePassiveSellOffer{
		Buying:  buying1,
		Selling: selling1,
		Price:   "1",
		Amount:  "10",
	}
	err = validatePassiveOffer(cpo1.Buying, cpo1.Selling, cpo1.Amount, cpo1.Price)
	assert.Error(t, err)
	expectedErrMsg = "Field: Buying, Error: asset code length must be between 1 and 12 characters"
	require.EqualError(t, err, expectedErrMsg, "Selling asset is required")
}

func TestValidateOfferManageBuyOffer(t *testing.T) {
	kp0 := newKeypair0()
	buying := CreditAsset{Code: "ABCD", Issuer: kp0.Address()}
	selling := NativeAsset{}
	mbo := ManageBuyOffer{
		Buying:  buying,
		Selling: selling,
		Price:   "1",
		Amount:  "10",
		OfferID: -1,
	}
	err := validateOffer(mbo.Buying, mbo.Selling, mbo.Amount, mbo.Price, mbo.OfferID)
	assert.Error(t, err)
	expectedErrMsg := "Field: OfferID, Error: amount can not be negative"
	require.EqualError(t, err, expectedErrMsg, "valid offerID is required")
}

func TestValidateOfferManageSellOffer(t *testing.T) {
	kp0 := newKeypair0()
	buying := CreditAsset{Code: "ABCD", Issuer: kp0.Address()}
	selling := NativeAsset{}
	mso := ManageSellOffer{
		Buying:  buying,
		Selling: selling,
		Price:   "1",
		Amount:  "10",
		OfferID: -1,
	}
	err := validateOffer(mso.Buying, mso.Selling, mso.Amount, mso.Price, mso.OfferID)
	assert.Error(t, err)
	expectedErrMsg := "Field: OfferID, Error: amount can not be negative"
	require.EqualError(t, err, expectedErrMsg, "valid offerID is required")
}
