# Changelog

All notable changes to this project will be documented in this
file.  This project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

- Dropped support for Go 1.10, 1.11.

## [v1.4.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.4.0) - 2019-08-09

- Add support for querying operation endpoint with `join` parameter [#1521](https://github.com/stellar/go/issues/1521).
- Add support for querying previous and next trade aggregations with `Client.NextTradeAggregationsPage` and `Client.PrevTradeAggregationsPage` methods.


## [v1.3.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.3.0) - 2019-07-08

- Transaction information returned by methods now contain new fields: `FeeCharged` and `MaxFee`. `FeePaid` is deprecated and will be removed in later versions.
- Improved unit test for `Client.FetchTimebounds` method.
- Added `Client.HomeDomainForAccount` helper method for retrieving the home domain of an account.

## [v1.2.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.2.0) - 2019-05-16

- Added support for returning the previous and next set of pages for a horizon response; issue [#985](https://github.com/stellar/go/issues/985). 
- Fixed bug reported in [#1254](https://github.com/stellar/go/issues/1254)  that causes a panic when using horizonclient in goroutines.


## [v1.1.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.1.0) - 2019-05-02

### Added

- `Client.Root()` method for querying the root endpoint of a horizon server.
- Support for returning concrete effect types[#1217](https://github.com/stellar/go/pull/1217)
- Fix when no HTTP client is provided

### Changes

- `Client.Fund()` now returns `TransactionSuccess` instead of a http response pointer.

- Querying the effects endpoint now supports returning the concrete effect type for each effect. This is also supported in streaming mode. See the [docs](https://godoc.org/github.com/stellar/go/clients/horizonclient#Client.Effects) for examples.

## [v1.0.0](https://github.com/stellar/go/releases/tag/horizonclient-v1.0) - 2019-04-26

 * Initial release
