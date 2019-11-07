package effects

import (
	"encoding/json"
	"time"

	"github.com/stellar/go/protocols/horizon/base"
	"github.com/stellar/go/support/render/hal"
)

// Peter 30-04-2019: this is copied from the history package "github.com/stellar/go/services/horizon/internal/db2/history"
// Could not import this because internal package imports must share the same path prefix as the importer.
// Maybe this should be housed here and imported into internal packages?

// EffectType is the numeric type for an effect
type EffectType int

const (
	// account effects

	// EffectAccountCreated effects occur when a new account is created
	EffectAccountCreated EffectType = 0 // from create_account

	// EffectAccountRemoved effects occur when one account is merged into another
	EffectAccountRemoved EffectType = 1 // from merge_account

	// EffectAccountCredited effects occur when an account receives some currency
	EffectAccountCredited EffectType = 2 // from create_account, payment, path_payment, merge_account

	// EffectAccountDebited effects occur when an account sends some currency
	EffectAccountDebited EffectType = 3 // from create_account, payment, path_payment, create_account

	// EffectAccountThresholdsUpdated effects occur when an account changes its
	// multisig thresholds.
	EffectAccountThresholdsUpdated EffectType = 4 // from set_options

	// EffectAccountHomeDomainUpdated effects occur when an account changes its
	// home domain.
	EffectAccountHomeDomainUpdated EffectType = 5 // from set_options

	// EffectAccountFlagsUpdated effects occur when an account changes its
	// account flags, either clearing or setting.
	EffectAccountFlagsUpdated EffectType = 6 // from set_options

	// EffectAccountInflationDestinationUpdated effects occur when an account changes its
	// inflation destination.
	EffectAccountInflationDestinationUpdated EffectType = 7 // from set_options

	// signer effects

	// EffectSignerCreated occurs when an account gains a signer
	EffectSignerCreated EffectType = 10 // from set_options

	// EffectSignerRemoved occurs when an account loses a signer
	EffectSignerRemoved EffectType = 11 // from set_options

	// EffectSignerUpdated occurs when an account changes the weight of one of its
	// signers.
	EffectSignerUpdated EffectType = 12 // from set_options

	// trustline effects

	// EffectTrustlineCreated occurs when an account trusts an anchor
	EffectTrustlineCreated EffectType = 20 // from change_trust

	// EffectTrustlineRemoved occurs when an account removes struct by setting the
	// limit of a trustline to 0
	EffectTrustlineRemoved EffectType = 21 // from change_trust

	// EffectTrustlineUpdated occurs when an account changes a trustline's limit
	EffectTrustlineUpdated EffectType = 22 // from change_trust, allow_trust

	// EffectTrustlineAuthorized occurs when an anchor has AUTH_REQUIRED flag set
	// to true and it authorizes another account's trustline
	EffectTrustlineAuthorized EffectType = 23 // from allow_trust

	// EffectTrustlineDeauthorized occurs when an anchor revokes access to a asset
	// it issues.
	EffectTrustlineDeauthorized EffectType = 24 // from allow_trust

	// trading effects

	// EffectOfferCreated occurs when an account offers to trade an asset
	EffectOfferCreated EffectType = 30 // from manage_offer, creat_passive_offer

	// EffectOfferRemoved occurs when an account removes an offer
	EffectOfferRemoved EffectType = 31 // from manage_offer, creat_passive_offer, path_payment

	// EffectOfferUpdated occurs when an offer is updated by the offering account.
	EffectOfferUpdated EffectType = 32 // from manage_offer, creat_passive_offer, path_payment

	// EffectTrade occurs when a trade is initiated because of a path payment or
	// offer operation.
	EffectTrade EffectType = 33 // from manage_offer, creat_passive_offer, path_payment

	// data effects

	// EffectDataCreated occurs when an account gets a new data field
	EffectDataCreated EffectType = 40 // from manage_data

	// EffectDataRemoved occurs when an account removes a data field
	EffectDataRemoved EffectType = 41 // from manage_data

	// EffectDataUpdated occurs when an account changes a data field's value
	EffectDataUpdated EffectType = 42 // from manage_data

	// EffectSequenceBumped occurs when an account bumps their sequence number
	EffectSequenceBumped EffectType = 43 // from bump_sequence
)

// Peter 30-04-2019: this is copied from the resourcadapter package
// "github.com/stellar/go/services/horizon/internal/resourceadapter"
// Could not import this because internal package imports must share the same path prefix as the importer.

// EffectTypeNames stores a map of effect type ID and names
var EffectTypeNames = map[EffectType]string{
	EffectAccountCreated:                     "account_created",
	EffectAccountRemoved:                     "account_removed",
	EffectAccountCredited:                    "account_credited",
	EffectAccountDebited:                     "account_debited",
	EffectAccountThresholdsUpdated:           "account_thresholds_updated",
	EffectAccountHomeDomainUpdated:           "account_home_domain_updated",
	EffectAccountFlagsUpdated:                "account_flags_updated",
	EffectAccountInflationDestinationUpdated: "account_inflation_destination_updated",
	EffectSignerCreated:                      "signer_created",
	EffectSignerRemoved:                      "signer_removed",
	EffectSignerUpdated:                      "signer_updated",
	EffectTrustlineCreated:                   "trustline_created",
	EffectTrustlineRemoved:                   "trustline_removed",
	EffectTrustlineUpdated:                   "trustline_updated",
	EffectTrustlineAuthorized:                "trustline_authorized",
	EffectTrustlineDeauthorized:              "trustline_deauthorized",
	EffectOfferCreated:                       "offer_created",
	EffectOfferRemoved:                       "offer_removed",
	EffectOfferUpdated:                       "offer_updated",
	EffectTrade:                              "trade",
	EffectDataCreated:                        "data_created",
	EffectDataRemoved:                        "data_removed",
	EffectDataUpdated:                        "data_updated",
	EffectSequenceBumped:                     "sequence_bumped",
}

// Base provides the common structure for any effect resource effect.
type Base struct {
	Links struct {
		Operation hal.Link `json:"operation"`
		Succeeds  hal.Link `json:"succeeds"`
		Precedes  hal.Link `json:"precedes"`
	} `json:"_links"`

	ID              string    `json:"id"`
	PT              string    `json:"paging_token"`
	Account         string    `json:"account"`
	Type            string    `json:"type"`
	TypeI           int32     `json:"type_i"`
	LedgerCloseTime time.Time `json:"created_at"`
}

// PagingToken implements `hal.Pageable` and Effect
func (b Base) PagingToken() string {
	return b.PT
}

type AccountCreated struct {
	Base
	StartingBalance string `json:"starting_balance"`
}

type AccountCredited struct {
	Base
	base.Asset
	Amount string `json:"amount"`
}

type AccountDebited struct {
	Base
	base.Asset
	Amount string `json:"amount"`
}

type AccountThresholdsUpdated struct {
	Base
	LowThreshold  int32 `json:"low_threshold"`
	MedThreshold  int32 `json:"med_threshold"`
	HighThreshold int32 `json:"high_threshold"`
}

type AccountHomeDomainUpdated struct {
	Base
	HomeDomain string `json:"home_domain"`
}

type AccountFlagsUpdated struct {
	Base
	AuthRequired  *bool `json:"auth_required_flag,omitempty"`
	AuthRevokable *bool `json:"auth_revokable_flag,omitempty"`
}

type SequenceBumped struct {
	Base
	NewSeq int64 `json:"new_seq"`
}

type SignerCreated struct {
	Base
	Weight    int32  `json:"weight"`
	PublicKey string `json:"public_key"`
	Key       string `json:"key"`
}

type SignerRemoved struct {
	Base
	Weight    int32  `json:"weight"`
	PublicKey string `json:"public_key"`
	Key       string `json:"key"`
}

type SignerUpdated struct {
	Base
	Weight    int32  `json:"weight"`
	PublicKey string `json:"public_key"`
	Key       string `json:"key"`
}

type TrustlineCreated struct {
	Base
	base.Asset
	Limit string `json:"limit"`
}

type TrustlineRemoved struct {
	Base
	base.Asset
	Limit string `json:"limit"`
}

type TrustlineUpdated struct {
	Base
	base.Asset
	Limit string `json:"limit"`
}

type TrustlineAuthorized struct {
	Base
	Trustor   string `json:"trustor"`
	AssetType string `json:"asset_type"`
	AssetCode string `json:"asset_code,omitempty"`
}

type TrustlineDeauthorized struct {
	Base
	Trustor   string `json:"trustor"`
	AssetType string `json:"asset_type"`
	AssetCode string `json:"asset_code,omitempty"`
}

type Trade struct {
	Base
	Seller string `json:"seller"`
	// Action needed in release: horizon-v0.23.0
	OfferID           int64  `json:"offer_id"`
	SoldAmount        string `json:"sold_amount"`
	SoldAssetType     string `json:"sold_asset_type"`
	SoldAssetCode     string `json:"sold_asset_code,omitempty"`
	SoldAssetIssuer   string `json:"sold_asset_issuer,omitempty"`
	BoughtAmount      string `json:"bought_amount"`
	BoughtAssetType   string `json:"bought_asset_type"`
	BoughtAssetCode   string `json:"bought_asset_code,omitempty"`
	BoughtAssetIssuer string `json:"bought_asset_issuer,omitempty"`
}

// Effect contains methods that are implemented by all effect types.
type Effect interface {
	PagingToken() string
	GetType() string
	GetID() string
	GetAccount() string
}

// GetType implements Effect
func (b Base) GetType() string {
	return b.Type
}

// GetID implements Effect
func (b Base) GetID() string {
	return b.ID
}

// GetAccount implements Effect
func (b Base) GetAccount() string {
	return b.Account
}

// EffectsPage contains page of effects returned by Horizon.
type EffectsPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []Effect
	} `json:"_embedded"`
}

// UnmarshalJSON is the custom unmarshal method for EffectsPage
func (effects *EffectsPage) UnmarshalJSON(data []byte) error {
	var effectsPage struct {
		Links    hal.Links `json:"_links"`
		Embedded struct {
			Records []interface{}
		} `json:"_embedded"`
	}

	if err := json.Unmarshal(data, &effectsPage); err != nil {
		return err
	}

	for _, j := range effectsPage.Embedded.Records {
		var b Base
		dataString, err := json.Marshal(j)
		if err != nil {
			return err
		}
		if err = json.Unmarshal(dataString, &b); err != nil {
			return err
		}

		ef, err := UnmarshalEffect(b.Type, dataString)
		if err != nil {
			return err
		}

		effects.Embedded.Records = append(effects.Embedded.Records, ef)
	}

	effects.Links = effectsPage.Links
	return nil
}

// UnmarshalEffect decodes responses to the correct effect struct
func UnmarshalEffect(effectType string, dataString []byte) (effects Effect, err error) {
	switch effectType {
	case EffectTypeNames[EffectAccountCreated]:
		var effect AccountCreated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectAccountCredited]:
		var effect AccountCredited
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectAccountDebited]:
		var effect AccountDebited
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectAccountThresholdsUpdated]:
		var effect AccountThresholdsUpdated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectAccountHomeDomainUpdated]:
		var effect AccountHomeDomainUpdated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectAccountFlagsUpdated]:
		var effect AccountFlagsUpdated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectSequenceBumped]:
		var effect SequenceBumped
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectSignerCreated]:
		var effect SignerCreated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectSignerRemoved]:
		var effect SignerRemoved
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectSignerUpdated]:
		var effect SignerUpdated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectTrustlineAuthorized]:
		var effect TrustlineAuthorized
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectTrustlineCreated]:
		var effect TrustlineCreated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectTrustlineDeauthorized]:
		var effect TrustlineDeauthorized
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectTrustlineRemoved]:
		var effect TrustlineRemoved
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectTrustlineUpdated]:
		var effect TrustlineUpdated
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	case EffectTypeNames[EffectTrade]:
		var effect Trade
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	default:
		var effect Base
		if err = json.Unmarshal(dataString, &effect); err != nil {
			return
		}
		effects = effect
	}
	return
}

// interface implementations
var _ base.Rehydratable = &SignerCreated{}
var _ base.Rehydratable = &SignerRemoved{}
var _ base.Rehydratable = &SignerUpdated{}
