package main

import (
	"bytes"
	"encoding/base64"
	"fmt"

	"github.com/stellar/go/xdr"
)

func main() {
	testSimplePayXdr := "AAAAAIZwdxjifxbKDipFfJfcqqsvQHqTQO+J0Xah0s6ZoQ9KAAAAZAAS4TkAAAAHAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAAufsQ3NXM+PMUejBlXuujVyQvKVfYDFV8Nvz32vVFLLwAAAAAAAAAAFloLwAAAAAAAAAAAA=="
	fmt.Println(encodedSimplePayment() == testSimplePayXdr)
	testChangeTrustXdr := "AAAAAHN+b9x5HwmNAmIgPPfK5P/YZFHjQkwp3njikB8qNRyXAAAAZAFb5rMAAAAlAAAAAAAAAAAAAAABAAAAAAAAAAYAAAABV0hBVAAAAABzfm/ceR8JjQJiIDz3yuT/2GRR40JMKd544pAfKjUcl3//////////AAAAAAAAAAA="
	fmt.Println(testChangeTrustXdr == encodeChangeTrust())
}

func decode(encoded string) xdr.TransactionEnvelope {
	var txEnv xdr.TransactionEnvelope
	err := xdr.SafeUnmarshalBase64(encoded, &txEnv)
	if err != nil {
		panic(err)
	}
	return txEnv
}

func encodeChangeTrust() string {
	var err error
	var tx xdr.Transaction
	var txSourceAccount, issuerAccount xdr.AccountId
	txSourceAccount.SetAddress("GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB")
	issuerAccount.SetAddress("GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB")
	tx.SourceAccount = txSourceAccount
	tx.Fee = 100
	tx.SeqNum = 97925473392132133

	var opBody xdr.OperationBody
	var assetCode [4]byte
	copy(assetCode[:], "WHAT")
	opBody.ChangeTrustOp = &xdr.ChangeTrustOp{
		Line: xdr.Asset{
			Type: xdr.AssetTypeAssetTypeCreditAlphanum4,
			AlphaNum4: &xdr.AssetAlphaNum4{
				AssetCode: assetCode,
				Issuer:    issuerAccount,
			},
		},
		Limit: 9223372036854775807,
	}
	opBody.Type = xdr.OperationTypeChangeTrust

	var operation xdr.Operation
	operation.SourceAccount = nil
	operation.Body = opBody
	tx.Operations = []xdr.Operation{operation}

	var txEnv xdr.TransactionEnvelope
	txEnv.Tx = tx
	var buf bytes.Buffer
	_, err = xdr.Marshal(&buf, txEnv)
	if err != nil {
		panic(err)
	}
	encoded := base64.StdEncoding.EncodeToString(buf.Bytes())
	return encoded
}

func encodedSimplePayment() string {
	var err error
	var tx xdr.Transaction
	var sourceAccount, targetAccount xdr.AccountId
	sourceAccount.SetAddress("GCDHA5YY4J7RNSQOFJCXZF64VKVS6QD2SNAO7CORO2Q5FTUZUEHUVDGI")
	targetAccount.SetAddress("GC47WEG42XGPR4YUPIYGKXXLUNLSILZJK7MAYVL4G36PPWXVIUWLYJNL")
	tx.SourceAccount = sourceAccount
	tx.Fee = 100
	tx.SeqNum = 5314184510177287

	var opBody xdr.OperationBody
	opBody.PaymentOp = &xdr.PaymentOp{
		Destination: targetAccount,
		Asset: xdr.Asset{
			Type: xdr.AssetTypeAssetTypeNative,
		},
		Amount: 1500000000,
	}
	opBody.Type = xdr.OperationTypePayment

	var operation xdr.Operation
	// var badOperationSourceAccount xdr.AccountId
	// badOperationSourceAccount.SetAddress("")
	// operation.SourceAccount = &badOperationSourceAccount
	operation.SourceAccount = nil
	operation.Body = opBody
	tx.Operations = []xdr.Operation{operation}

	var txEnv xdr.TransactionEnvelope
	txEnv.Tx = tx
	var buf bytes.Buffer
	_, err = xdr.Marshal(&buf, txEnv)
	if err != nil {
		panic(err)
	}
	encoded := base64.StdEncoding.EncodeToString(buf.Bytes())
	return encoded
}
