# Changelog

All notable changes to this project will be documented in this
file.  This project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

* Dropped support for Go 1.10, 1.11.

## [v1.4.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.4.0) - 2019-08-09

* Add `BuildChallengeTx` function for building [SEP-10](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) challenge transaction([#1466](https://github.com/stellar/go/issues/1466)).
* Add `VerifyChallengeTx` method for verifying [SEP-10](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) challenge transaction([#1530](https://github.com/stellar/go/issues/1530)).
* Add `TransactionFromXDR` function for building `txnbuild.Transaction` struct from a  base64 XDR transaction envelope[#1329](https://github.com/stellar/go/issues/1329).
* Fix bug that allowed multiple calls to `Transaction.Build` increment the number of operations in a transaction [#1448](https://github.com/stellar/go/issues/1448).
* Add `Transaction.SignWithKeyString` helper method for signing transactions using secret keys as strings.([#1564](https://github.com/stellar/go/issues/1564))


## [v1.3.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.3.0) - 2019-07-08

* Add support for getting the hex-encoded transaction hash with `Transaction.HashHex` method.
* `TransactionEnvelope` is now available after building a transaction(`Transaction.Build`). Previously, this was only available after signing a transaction. ([#1376](https://github.com/stellar/go/pull/1376)) 
* Add support for getting the `TransactionEnvelope` struct with `Transaction.TxEnvelope` method ([#1415](https://github.com/stellar/go/issues/1415)).
* `AllowTrust` operations no longer requires the asset issuer, only asset code is required ([#1330](https://github.com/stellar/go/issues/1330)).
* `Transaction.SetDefaultFee` method is deprecated and will be removed in the next major release ([#1221](https://github.com/stellar/go/issues/1221)).
* `Transaction.TransactionFee` method has been added to get the fee that will be paid for a transaction.
* `Transaction.SignHashX` method adds support for signing transactions with hash(x) signature types.

## [v1.2.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.2.0) - 2019-05-16

* In addition to account responses from horizon, transactions and operations can now be built with txnbuild.SimpleAccount structs constructed locally ([#1266](https://github.com/stellar/go/issues/1266)). 
* Added `MaxTrustlineLimit` which represents the maximum value for a trustline limit ([#1265](https://github.com/stellar/go/issues/1265)).
* ChangeTrust operation with no `Limit` field set now defaults to `MaxTrustlineLimit` ([#1265](https://github.com/stellar/go/issues/1265)).
* Add support for building `ManageBuyOffer` operation ([#1165](https://github.com/stellar/go/issues/1165)).
* Fix bug in ChangeTrust operation builder ([1296](https://github.com/stellar/go/issues/1296)).

## [v1.1.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.1.0) - 2019-02-02

* Support for multiple signatures ([#1198](https://github.com/stellar/go/pull/1198))

## [v1.0.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.0) - 2019-04-26

* Initial release
