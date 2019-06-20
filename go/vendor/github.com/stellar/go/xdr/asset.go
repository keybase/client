package xdr

import (
	"errors"
	"fmt"
	"strings"

	"github.com/stellar/go/strkey"
)

// This file contains helpers for working with xdr.Asset structs

// MustNewNativeAsset returns a new native asset, panicking if it can't.
func MustNewNativeAsset() Asset {
	a := Asset{}
	err := a.SetNative()
	if err != nil {
		panic(err)
	}
	return a
}

// MustNewCreditAsset returns a new general asset, panicking if it can't.
func MustNewCreditAsset(code string, issuer string) Asset {
	a := Asset{}
	accountID := AccountId{}
	accountID.SetAddress(issuer)
	err := a.SetCredit(code, accountID)
	if err != nil {
		panic(err)
	}
	return a
}

// SetCredit overwrites `a` with a credit asset using `code` and `issuer`.  The
// asset type (CreditAlphanum4 or CreditAlphanum12) is chosen automatically
// based upon the length of `code`.
func (a *Asset) SetCredit(code string, issuer AccountId) error {
	length := len(code)
	var typ AssetType
	var body interface{}

	switch {
	case length >= 1 && length <= 4:
		newbody := AssetAlphaNum4{Issuer: issuer}
		copy(newbody.AssetCode[:], []byte(code)[:length])
		typ = AssetTypeAssetTypeCreditAlphanum4
		body = newbody
	case length >= 5 && length <= 12:
		newbody := AssetAlphaNum12{Issuer: issuer}
		copy(newbody.AssetCode[:], []byte(code)[:length])
		typ = AssetTypeAssetTypeCreditAlphanum12
		body = newbody
	default:
		return errors.New("Asset code length is invalid")
	}

	newa, err := NewAsset(typ, body)
	if err != nil {
		return err
	}
	*a = newa
	return nil
}

// SetNative overwrites `a` with the native asset type
func (a *Asset) SetNative() error {
	newa, err := NewAsset(AssetTypeAssetTypeNative, nil)
	if err != nil {
		return err
	}
	*a = newa
	return nil
}

// ToAllowTrustOpAsset for Asset converts the Asset to a corresponding XDR
// "allow trust" asset, used by the XDR allow trust operation.
func (a *Asset) ToAllowTrustOpAsset(code string) (AllowTrustOpAsset, error) {
	length := len(code)

	switch {
	case length >= 1 && length <= 4:
		var bytecode [4]byte
		byteArray := []byte(code)
		copy(bytecode[:], byteArray[0:length])
		return NewAllowTrustOpAsset(AssetTypeAssetTypeCreditAlphanum4, bytecode)
	case length >= 5 && length <= 12:
		var bytecode [12]byte
		byteArray := []byte(code)
		copy(bytecode[:], byteArray[0:length])
		return NewAllowTrustOpAsset(AssetTypeAssetTypeCreditAlphanum12, bytecode)
	default:
		return AllowTrustOpAsset{}, errors.New("Asset code length is invalid")
	}
}

// String returns a display friendly form of the asset
func (a Asset) String() string {
	var t, c, i string

	a.MustExtract(&t, &c, &i)

	if a.Type == AssetTypeAssetTypeNative {
		return t
	}

	return fmt.Sprintf("%s/%s/%s", t, c, i)
}

// Equals returns true if `other` is equivalent to `a`
func (a Asset) Equals(other Asset) bool {
	if a.Type != other.Type {
		return false
	}
	switch a.Type {
	case AssetTypeAssetTypeNative:
		return true
	case AssetTypeAssetTypeCreditAlphanum4:
		l := a.MustAlphaNum4()
		r := other.MustAlphaNum4()
		return l.AssetCode == r.AssetCode && l.Issuer.Equals(r.Issuer)
	case AssetTypeAssetTypeCreditAlphanum12:
		l := a.MustAlphaNum12()
		r := other.MustAlphaNum12()
		return l.AssetCode == r.AssetCode && l.Issuer.Equals(r.Issuer)
	default:
		panic(fmt.Errorf("Unknown asset type: %v", a.Type))
	}
}

// Extract is a helper function to extract information from an xdr.Asset
// structure.  It extracts the asset's type to the `typ` input parameter (which
// must be either a *string or *xdr.AssetType).  It also extracts the asset's
// code and issuer to `code` and `issuer` respectively if they are of type
// *string and the asset is non-native
func (a Asset) Extract(typ interface{}, code interface{}, issuer interface{}) error {
	switch typ := typ.(type) {
	case *AssetType:
		*typ = a.Type
	case *string:
		switch a.Type {
		case AssetTypeAssetTypeNative:
			*typ = "native"
		case AssetTypeAssetTypeCreditAlphanum4:
			*typ = "credit_alphanum4"
		case AssetTypeAssetTypeCreditAlphanum12:
			*typ = "credit_alphanum12"
		}
	default:
		return errors.New("can't extract type")
	}

	if code != nil {
		switch code := code.(type) {
		case *string:
			switch a.Type {
			case AssetTypeAssetTypeCreditAlphanum4:
				an := a.MustAlphaNum4()
				*code = strings.TrimRight(string(an.AssetCode[:]), "\x00")
			case AssetTypeAssetTypeCreditAlphanum12:
				an := a.MustAlphaNum12()
				*code = strings.TrimRight(string(an.AssetCode[:]), "\x00")
			}
		default:
			return errors.New("can't extract code")
		}
	}

	if issuer != nil {
		switch issuer := issuer.(type) {
		case *string:
			switch a.Type {
			case AssetTypeAssetTypeCreditAlphanum4:
				an := a.MustAlphaNum4()
				raw := an.Issuer.MustEd25519()
				*issuer = strkey.MustEncode(strkey.VersionByteAccountID, raw[:])
			case AssetTypeAssetTypeCreditAlphanum12:
				an := a.MustAlphaNum12()
				raw := an.Issuer.MustEd25519()
				*issuer = strkey.MustEncode(strkey.VersionByteAccountID, raw[:])
			}
		default:
			return errors.New("can't extract issuer")
		}
	}

	return nil
}

// MustExtract behaves as Extract, but panics if an error occurs.
func (a Asset) MustExtract(typ interface{}, code interface{}, issuer interface{}) {
	err := a.Extract(typ, code, issuer)

	if err != nil {
		panic(err)
	}
}
