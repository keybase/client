# Horizon Protocol Changelog

Any changes to the Horizon Public API should be included in this doc.

## SDK support

We started tracking SDK support at version 0.12.3. Support for 0.12.3 means that SDK can correctly:

* Send requests using all available query params / POST params / headers,
* Parse all fields in responses structs and headers.

For each new version we will only track changes from the previous version.

## Changes

### 0.15.0

#### SDKs with full support

- [JS SDK 0.10.2](https://github.com/stellar/js-stellar-sdk/releases/tag/v0.10.2)
- [Java SDK 0.4.0](https://github.com/stellar/java-stellar-sdk/releases/tag/0.4.0)

#### Changes

* Assets stats are disabled by default. This can be changed using an environment variable (`ENABLE_ASSET_STATS=true`) or
CLI parameter (`--enable-asset-stats=true`). Please note that it has a negative impact on a DB and ingestion time.
* In ["Offers for Account"](https://www.stellar.org/developers/horizon/reference/endpoints/offers-for-account.html),
`last_modified_time` field  endpoint can be `null` when ledger data is not available (has not been ingested yet).
* ["Trades for Offer"](https://www.stellar.org/developers/horizon/reference/endpoints/trades-for-offer.html) endpoint
will query for trades that match the given offer on either side of trades, rather than just the "sell" offer.
Offer IDs are now [synthetic](https://www.stellar.org/developers/horizon/reference/resources/trade.html#synthetic-offer-ids).
* New `/operation_fee_stats` endpoint includes fee stats for the last 5 ledgers.
* ["Trades"](https://www.stellar.org/developers/horizon/reference/endpoints/trades.html) endpoint can now be streamed.
* In ["Trade Aggregations"](https://www.stellar.org/developers/horizon/reference/endpoints/trade_aggregations.html) endpoint,
`offset` parameter has been added.
* Account flags now display `auth_immutable` value.
* Rate limiting in streams has been changed to be more fair. Now 1 *credit* has to be *paid* every time there's a new ledger
instead of per request.

| Resource                            | Changes                                  | Go SDK <sup>1</sup> | JS SDK | Java SDK |
|:------------------------------------|:-----------------------------------------|:--------------------|:-------|:---------|
| `GET /assets`                       | Disabled by default.                     | +                   | 0.10.2 | 0.4.0    |
| `GET /accounts/{account_id}/offers` | `last_modified_time` field can be `null` | -                   | 0.10.2 | 0.4.0    |
| `GET /offers/{offer_id}/trades`     | Query fields and syntetic IDs            | -                   | 0.10.2 | 0.4.0    |
| `GET /trades` SSE                   | Can be streamed                          | -                   | -      | 0.4.0    |
| `GET /operation_fee_stats`          | New endpoint                             | -                   | -      | 0.4.0    |
| `GET /trade_aggregations`           | New `offset` parameter                   | -                   | -      | 0.4.0    |
| `GET /accounts/{account_id}`        | Displaying `auth_immutable` flag         | -                   | 0.10.2 | 0.4.0    |

### 0.14.0

#### SDKs with full support

- [JS SDK 0.10.2](https://github.com/stellar/js-stellar-sdk/releases/tag/v0.10.2)
- [Java SDK 0.3.1](https://github.com/stellar/java-stellar-sdk/releases/tag/0.3.1)

#### Changes

* New [`bump_sequence`](https://www.stellar.org/developers/horizon/reference/resources/operation.html#bump-sequence) operation.
* New `sequence_bumped` effect.
* New fields in Account > Balances collection: `buying_liabilities` and `selling_liabilities`.
* Offer resource `last_modified` field removed, replaced by `last_modified_ledger` and `last_modified_time`.
* Trade aggregations endpoint accepts only specific time ranges now (1/5/15 minutes, 1 hour, 1 day, 1 week).
* Horizon now sends `Cache-Control: no-cache, no-store, max-age=0` HTTP header for all responses.

| Resource                                    | Changes                                    | Go SDK <sup>1</sup> | JS SDK | Java SDK |
|:--------------------------------------------|:-------------------------------------------|:--------------------|:-------|:---------|
| `GET /accounts/{account_id}`                | Liabilities fields in Balances collection. | +                   | 0.10.2 | 0.3.1    |
| `GET /accounts/{account_id}/effects`        | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |
| `GET /accounts/{account_id}/effects` SSE    | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |
| `GET /accounts/{account_id}/offers`         | `last_modified` field removed              | -                   | 0.10.2 | 0.3.1    |
| `GET /accounts/{account_id}/operations`     | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /accounts/{account_id}/operations` SSE | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /effects`                              | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |
| `GET /effects` SSE                          | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |
| `GET /ledgers/{ledger_id}/operations`       | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /ledgers/{ledger_id}/operations` SSE   | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /ledgers/{ledger_id}/effects`          | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |
| `GET /ledgers/{ledger_id}/effects` SSE      | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |
| `GET /operations`                           | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /operations` SSE                       | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /operations/{op_id}`                   | `bump_sequence` operation                  | +                   | 0.10.2 | 0.3.1    |
| `GET /trades_aggregations`                  | Only specific time ranges allowed          | +                   | 0.10.2 | 0.3.1    |
| `GET /transactions/{tx_id}/operations`      | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /transactions/{tx_id}/operations` SSE  | `bump_sequence` operation                  | -                   | 0.10.2 | 0.3.1    |
| `GET /transactions/{tx_id}/effects`         | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |
| `GET /transactions/{tx_id}/effects` SSE     | `sequence_bumped` effect                   | -                   | 0.10.2 | 0.3.1    |

### 0.13.0

#### SDKs with full support

- [JS SDK 0.8.2](https://github.com/stellar/js-stellar-sdk/releases/tag/v0.8.2)
- [Java SDK 0.2.1](https://github.com/stellar/java-stellar-sdk/releases/tag/0.2.1)

#### Changes

- `amount` field in `/assets` is now a String (to support Stellar amounts larger than `int64`).
- Effect resource contains a new `created_at` field.

| Resource                                 | Changes                                      | Go SDK <sup>1</sup> | JS SDK             | Java SDK |
|:-----------------------------------------|:---------------------------------------------|:--------------------|:-------------------|:---------|
| `GET /assets`                            | `amount` can be larger than `MAX_INT64`/10^7 | +                   | 0.8.2 <sup>2</sup> | 0.2.0    |
| `GET /ledgers/{ledger_id}/effects`       | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /ledgers/{ledger_id}/effects` SSE   | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /accounts/{account_id}/effects`     | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /accounts/{account_id}/effects` SSE | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /transactions/{tx_id}/effects`      | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /transactions/{tx_id}/effects` SSE  | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /operations/{op_id}/effects`        | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /operations/{op_id}/effects` SSE    | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /effects`                           | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |
| `GET /effects` SSE                       | `created_at` field added                     | +                   | 0.8.2 <sup>2</sup> | 0.2.1    |

### 0.12.3

#### SDKs with full support

- [JS SDK 0.8.2](https://github.com/stellar/js-stellar-sdk/releases/tag/v0.8.2)
- [Java SDK 0.2.1](https://github.com/stellar/java-stellar-sdk/releases/tag/0.2.1)

#### Changes

| Resource                                      | Go SDK <sup>1</sup>            | JS SDK | Java SDK                                          |
|:----------------------------------------------|:-------------------------------|:-------|:--------------------------------------------------|
| `GET /`                                       | +<br />(some `_links` missing) | -      | 0.2.1                                             |
| `GET /metrics`                                | -                              | -      | -                                                 |
| `GET /ledgers`                                | -                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers` SSE                            | +                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers/{ledger_id}`                    | -                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers/{ledger_id}/transactions`       | -                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers/{ledger_id}/transactions` SSE   | -                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers/{ledger_id}/operations`         | -                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers/{ledger_id}/operations` SSE     | -                              | 0.8.2  | 0.2.1                                             |
| `GET /ledgers/{ledger_id}/payments`           | -                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers/{ledger_id}/payments` SSE       | -                              | 0.8.2  | 0.2.0                                             |
| `GET /ledgers/{ledger_id}/effects`            | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /ledgers/{ledger_id}/effects` SSE        | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /accounts/{account_id}`                  | +                              | 0.8.2  | 0.2.0                                             |
| `GET /accounts/{account_id}/transactions`     | -                              | 0.8.2  | 0.2.0                                             |
| `GET /accounts/{account_id}/transactions` SSE | -                              | 0.8.2  | 0.2.0                                             |
| `GET /accounts/{account_id}/operations`       | -                              | 0.8.2  | 0.2.0                                             |
| `GET /accounts/{account_id}/operations` SSE   | -                              | 0.8.2  | 0.2.1                                             |
| `GET /accounts/{account_id}/payments`         | -                              | 0.8.2  | 0.2.0                                             |
| `GET /accounts/{account_id}/payments` SSE     | -                              | 0.8.2  | 0.2.0                                             |
| `GET /accounts/{account_id}/effects`          | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /accounts/{account_id}/effects` SSE      | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /accounts/{account_id}/offers`           | +                              | 0.8.2  | 0.2.0                                             |
| `GET /accounts/{account_id}/trades`           | -                              | 0.8.2  | 0.2.1                                             |
| `GET /accounts/{account_id}/data/{key}`       | -                              | -      | -                                                 |
| `POST /transactions`                          | -                              | 0.8.2  | 0.2.0                                             |
| `GET /transactions`                           | +                              | 0.8.2  | 0.2.0                                             |
| `GET /transactions` SSE                       | +                              | 0.8.2  | 0.2.0                                             |
| `GET /transactions/{tx_id}`                   | +                              | 0.8.2  | 0.2.0                                             |
| `GET /transactions/{tx_id}/operations`        | -                              | 0.8.2  | 0.2.0                                             |
| `GET /transactions/{tx_id}/operations` SSE    | -                              | 0.8.2  | 0.2.1                                             |
| `GET /transactions/{tx_id}/payments`          | -                              | 0.8.2  | 0.2.0                                             |
| `GET /transactions/{tx_id}/payments` SSE      | -                              | 0.8.2  | 0.2.0                                             |
| `GET /transactions/{tx_id}/effects`           | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /transactions/{tx_id}/effects` SSE       | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /operations`                             | -                              | 0.8.2  | 0.2.0                                             |
| `GET /operations` SSE                         | -                              | 0.8.2  | 0.2.1                                             |
| `GET /operations/{op_id}`                     | -                              | 0.8.2  | 0.2.0                                             |
| `GET /operations/{op_id}/effects`             | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /operations/{op_id}/effects` SSE         | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /payments`                               | -                              | 0.8.2  | 0.2.0                                             |
| `GET /payments` SSE                           | +                              | 0.8.2  | 0.2.0                                             |
| `GET /effects`                                | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /effects` SSE                            | -                              | 0.8.2  | 0.2.0<br />(no support for data, inflation types) |
| `GET /trades`                                 | +                              | 0.8.2  | 0.2.0<br />(no `price` field)                     |
| `GET /trades_aggregations`                    | +                              | 0.8.2  | 0.2.0                                             |
| `GET /offers/{offer_id}/trades`               | -                              | 0.8.2  | 0.2.1                                             |
| `GET /order_book`                             | +                              | 0.8.2  | 0.2.0                                             |
| `GET /order_book` SSE                         | -                              | 0.8.2  | 0.2.1                                             |
| `GET /paths`                                  | -                              | 0.8.2  | 0.2.0                                             |
| `GET /assets`                                 | -                              | 0.8.2  | 0.2.0                                             |

<sup>1</sup> We don't do proper versioning for GO SDK yet. `+` means implemented in `master` branch.

<sup>2</sup> Native JSON support in JS, no changes needed.
