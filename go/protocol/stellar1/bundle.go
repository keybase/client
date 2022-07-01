// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/stellar1/bundle.avdl

package stellar1

import (
	"errors"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type BundleRevision uint64

func (o BundleRevision) DeepCopy() BundleRevision {
	return o
}

type EncryptedBundle struct {
	V   int                           `codec:"v" json:"v"`
	E   []byte                        `codec:"e" json:"e"`
	N   keybase1.BoxNonce             `codec:"n" json:"n"`
	Gen keybase1.PerUserKeyGeneration `codec:"gen" json:"gen"`
}

func (o EncryptedBundle) DeepCopy() EncryptedBundle {
	return EncryptedBundle{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N:   o.N.DeepCopy(),
		Gen: o.Gen.DeepCopy(),
	}
}

type BundleVersion int

const (
	BundleVersion_V1  BundleVersion = 1
	BundleVersion_V2  BundleVersion = 2
	BundleVersion_V3  BundleVersion = 3
	BundleVersion_V4  BundleVersion = 4
	BundleVersion_V5  BundleVersion = 5
	BundleVersion_V6  BundleVersion = 6
	BundleVersion_V7  BundleVersion = 7
	BundleVersion_V8  BundleVersion = 8
	BundleVersion_V9  BundleVersion = 9
	BundleVersion_V10 BundleVersion = 10
)

func (o BundleVersion) DeepCopy() BundleVersion { return o }

var BundleVersionMap = map[string]BundleVersion{
	"V1":  1,
	"V2":  2,
	"V3":  3,
	"V4":  4,
	"V5":  5,
	"V6":  6,
	"V7":  7,
	"V8":  8,
	"V9":  9,
	"V10": 10,
}

var BundleVersionRevMap = map[BundleVersion]string{
	1:  "V1",
	2:  "V2",
	3:  "V3",
	4:  "V4",
	5:  "V5",
	6:  "V6",
	7:  "V7",
	8:  "V8",
	9:  "V9",
	10: "V10",
}

func (e BundleVersion) String() string {
	if v, ok := BundleVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type BundleSecretVersioned struct {
	Version__ BundleVersion            `codec:"version" json:"version"`
	V1__      *BundleSecretUnsupported `codec:"v1,omitempty" json:"v1,omitempty"`
	V2__      *BundleSecretV2          `codec:"v2,omitempty" json:"v2,omitempty"`
	V3__      *BundleSecretUnsupported `codec:"v3,omitempty" json:"v3,omitempty"`
	V4__      *BundleSecretUnsupported `codec:"v4,omitempty" json:"v4,omitempty"`
	V5__      *BundleSecretUnsupported `codec:"v5,omitempty" json:"v5,omitempty"`
	V6__      *BundleSecretUnsupported `codec:"v6,omitempty" json:"v6,omitempty"`
	V7__      *BundleSecretUnsupported `codec:"v7,omitempty" json:"v7,omitempty"`
	V8__      *BundleSecretUnsupported `codec:"v8,omitempty" json:"v8,omitempty"`
	V9__      *BundleSecretUnsupported `codec:"v9,omitempty" json:"v9,omitempty"`
	V10__     *BundleSecretUnsupported `codec:"v10,omitempty" json:"v10,omitempty"`
}

func (o *BundleSecretVersioned) Version() (ret BundleVersion, err error) {
	switch o.Version__ {
	case BundleVersion_V1:
		if o.V1__ == nil {
			err = errors.New("unexpected nil value for V1__")
			return ret, err
		}
	case BundleVersion_V2:
		if o.V2__ == nil {
			err = errors.New("unexpected nil value for V2__")
			return ret, err
		}
	case BundleVersion_V3:
		if o.V3__ == nil {
			err = errors.New("unexpected nil value for V3__")
			return ret, err
		}
	case BundleVersion_V4:
		if o.V4__ == nil {
			err = errors.New("unexpected nil value for V4__")
			return ret, err
		}
	case BundleVersion_V5:
		if o.V5__ == nil {
			err = errors.New("unexpected nil value for V5__")
			return ret, err
		}
	case BundleVersion_V6:
		if o.V6__ == nil {
			err = errors.New("unexpected nil value for V6__")
			return ret, err
		}
	case BundleVersion_V7:
		if o.V7__ == nil {
			err = errors.New("unexpected nil value for V7__")
			return ret, err
		}
	case BundleVersion_V8:
		if o.V8__ == nil {
			err = errors.New("unexpected nil value for V8__")
			return ret, err
		}
	case BundleVersion_V9:
		if o.V9__ == nil {
			err = errors.New("unexpected nil value for V9__")
			return ret, err
		}
	case BundleVersion_V10:
		if o.V10__ == nil {
			err = errors.New("unexpected nil value for V10__")
			return ret, err
		}
	}
	return o.Version__, nil
}

func (o BundleSecretVersioned) V1() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V1 {
		panic("wrong case accessed")
	}
	if o.V1__ == nil {
		return
	}
	return *o.V1__
}

func (o BundleSecretVersioned) V2() (res BundleSecretV2) {
	if o.Version__ != BundleVersion_V2 {
		panic("wrong case accessed")
	}
	if o.V2__ == nil {
		return
	}
	return *o.V2__
}

func (o BundleSecretVersioned) V3() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V3 {
		panic("wrong case accessed")
	}
	if o.V3__ == nil {
		return
	}
	return *o.V3__
}

func (o BundleSecretVersioned) V4() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V4 {
		panic("wrong case accessed")
	}
	if o.V4__ == nil {
		return
	}
	return *o.V4__
}

func (o BundleSecretVersioned) V5() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V5 {
		panic("wrong case accessed")
	}
	if o.V5__ == nil {
		return
	}
	return *o.V5__
}

func (o BundleSecretVersioned) V6() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V6 {
		panic("wrong case accessed")
	}
	if o.V6__ == nil {
		return
	}
	return *o.V6__
}

func (o BundleSecretVersioned) V7() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V7 {
		panic("wrong case accessed")
	}
	if o.V7__ == nil {
		return
	}
	return *o.V7__
}

func (o BundleSecretVersioned) V8() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V8 {
		panic("wrong case accessed")
	}
	if o.V8__ == nil {
		return
	}
	return *o.V8__
}

func (o BundleSecretVersioned) V9() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V9 {
		panic("wrong case accessed")
	}
	if o.V9__ == nil {
		return
	}
	return *o.V9__
}

func (o BundleSecretVersioned) V10() (res BundleSecretUnsupported) {
	if o.Version__ != BundleVersion_V10 {
		panic("wrong case accessed")
	}
	if o.V10__ == nil {
		return
	}
	return *o.V10__
}

func NewBundleSecretVersionedWithV1(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V1,
		V1__:      &v,
	}
}

func NewBundleSecretVersionedWithV2(v BundleSecretV2) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V2,
		V2__:      &v,
	}
}

func NewBundleSecretVersionedWithV3(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V3,
		V3__:      &v,
	}
}

func NewBundleSecretVersionedWithV4(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V4,
		V4__:      &v,
	}
}

func NewBundleSecretVersionedWithV5(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V5,
		V5__:      &v,
	}
}

func NewBundleSecretVersionedWithV6(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V6,
		V6__:      &v,
	}
}

func NewBundleSecretVersionedWithV7(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V7,
		V7__:      &v,
	}
}

func NewBundleSecretVersionedWithV8(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V8,
		V8__:      &v,
	}
}

func NewBundleSecretVersionedWithV9(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V9,
		V9__:      &v,
	}
}

func NewBundleSecretVersionedWithV10(v BundleSecretUnsupported) BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: BundleVersion_V10,
		V10__:     &v,
	}
}

func (o BundleSecretVersioned) DeepCopy() BundleSecretVersioned {
	return BundleSecretVersioned{
		Version__: o.Version__.DeepCopy(),
		V1__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V1__),
		V2__: (func(x *BundleSecretV2) *BundleSecretV2 {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V2__),
		V3__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V3__),
		V4__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V4__),
		V5__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V5__),
		V6__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V6__),
		V7__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V7__),
		V8__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V8__),
		V9__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V9__),
		V10__: (func(x *BundleSecretUnsupported) *BundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V10__),
	}
}

type BundleVisibleV2 struct {
	Revision BundleRevision         `codec:"revision" json:"revision"`
	Prev     Hash                   `codec:"prev" json:"prev"`
	Accounts []BundleVisibleEntryV2 `codec:"accounts" json:"accounts"`
}

func (o BundleVisibleV2) DeepCopy() BundleVisibleV2 {
	return BundleVisibleV2{
		Revision: o.Revision.DeepCopy(),
		Prev:     o.Prev.DeepCopy(),
		Accounts: (func(x []BundleVisibleEntryV2) []BundleVisibleEntryV2 {
			if x == nil {
				return nil
			}
			ret := make([]BundleVisibleEntryV2, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Accounts),
	}
}

type BundleSecretV2 struct {
	VisibleHash Hash                  `codec:"visibleHash" json:"visibleHash"`
	Accounts    []BundleSecretEntryV2 `codec:"accounts" json:"accounts"`
}

func (o BundleSecretV2) DeepCopy() BundleSecretV2 {
	return BundleSecretV2{
		VisibleHash: o.VisibleHash.DeepCopy(),
		Accounts: (func(x []BundleSecretEntryV2) []BundleSecretEntryV2 {
			if x == nil {
				return nil
			}
			ret := make([]BundleSecretEntryV2, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Accounts),
	}
}

type BundleVisibleEntryV2 struct {
	AccountID          AccountID      `codec:"accountID" json:"accountID"`
	Mode               AccountMode    `codec:"mode" json:"mode"`
	IsPrimary          bool           `codec:"isPrimary" json:"isPrimary"`
	AcctBundleRevision BundleRevision `codec:"acctBundleRevision" json:"acctBundleRevision"`
	EncAcctBundleHash  Hash           `codec:"encAcctBundleHash" json:"encAcctBundleHash"`
}

func (o BundleVisibleEntryV2) DeepCopy() BundleVisibleEntryV2 {
	return BundleVisibleEntryV2{
		AccountID:          o.AccountID.DeepCopy(),
		Mode:               o.Mode.DeepCopy(),
		IsPrimary:          o.IsPrimary,
		AcctBundleRevision: o.AcctBundleRevision.DeepCopy(),
		EncAcctBundleHash:  o.EncAcctBundleHash.DeepCopy(),
	}
}

type BundleSecretEntryV2 struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Name      string    `codec:"name" json:"name"`
}

func (o BundleSecretEntryV2) DeepCopy() BundleSecretEntryV2 {
	return BundleSecretEntryV2{
		AccountID: o.AccountID.DeepCopy(),
		Name:      o.Name,
	}
}

type BundleSecretUnsupported struct {
}

func (o BundleSecretUnsupported) DeepCopy() BundleSecretUnsupported {
	return BundleSecretUnsupported{}
}

type EncryptedAccountBundle struct {
	V   int                           `codec:"v" json:"v"`
	E   []byte                        `codec:"e" json:"e"`
	N   keybase1.BoxNonce             `codec:"n" json:"n"`
	Gen keybase1.PerUserKeyGeneration `codec:"gen" json:"gen"`
}

func (o EncryptedAccountBundle) DeepCopy() EncryptedAccountBundle {
	return EncryptedAccountBundle{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N:   o.N.DeepCopy(),
		Gen: o.Gen.DeepCopy(),
	}
}

type AccountBundleVersion int

const (
	AccountBundleVersion_V1  AccountBundleVersion = 1
	AccountBundleVersion_V2  AccountBundleVersion = 2
	AccountBundleVersion_V3  AccountBundleVersion = 3
	AccountBundleVersion_V4  AccountBundleVersion = 4
	AccountBundleVersion_V5  AccountBundleVersion = 5
	AccountBundleVersion_V6  AccountBundleVersion = 6
	AccountBundleVersion_V7  AccountBundleVersion = 7
	AccountBundleVersion_V8  AccountBundleVersion = 8
	AccountBundleVersion_V9  AccountBundleVersion = 9
	AccountBundleVersion_V10 AccountBundleVersion = 10
)

func (o AccountBundleVersion) DeepCopy() AccountBundleVersion { return o }

var AccountBundleVersionMap = map[string]AccountBundleVersion{
	"V1":  1,
	"V2":  2,
	"V3":  3,
	"V4":  4,
	"V5":  5,
	"V6":  6,
	"V7":  7,
	"V8":  8,
	"V9":  9,
	"V10": 10,
}

var AccountBundleVersionRevMap = map[AccountBundleVersion]string{
	1:  "V1",
	2:  "V2",
	3:  "V3",
	4:  "V4",
	5:  "V5",
	6:  "V6",
	7:  "V7",
	8:  "V8",
	9:  "V9",
	10: "V10",
}

func (e AccountBundleVersion) String() string {
	if v, ok := AccountBundleVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type AccountBundleSecretVersioned struct {
	Version__ AccountBundleVersion            `codec:"version" json:"version"`
	V1__      *AccountBundleSecretV1          `codec:"v1,omitempty" json:"v1,omitempty"`
	V2__      *AccountBundleSecretUnsupported `codec:"v2,omitempty" json:"v2,omitempty"`
	V3__      *AccountBundleSecretUnsupported `codec:"v3,omitempty" json:"v3,omitempty"`
	V4__      *AccountBundleSecretUnsupported `codec:"v4,omitempty" json:"v4,omitempty"`
	V5__      *AccountBundleSecretUnsupported `codec:"v5,omitempty" json:"v5,omitempty"`
	V6__      *AccountBundleSecretUnsupported `codec:"v6,omitempty" json:"v6,omitempty"`
	V7__      *AccountBundleSecretUnsupported `codec:"v7,omitempty" json:"v7,omitempty"`
	V8__      *AccountBundleSecretUnsupported `codec:"v8,omitempty" json:"v8,omitempty"`
	V9__      *AccountBundleSecretUnsupported `codec:"v9,omitempty" json:"v9,omitempty"`
	V10__     *AccountBundleSecretUnsupported `codec:"v10,omitempty" json:"v10,omitempty"`
}

func (o *AccountBundleSecretVersioned) Version() (ret AccountBundleVersion, err error) {
	switch o.Version__ {
	case AccountBundleVersion_V1:
		if o.V1__ == nil {
			err = errors.New("unexpected nil value for V1__")
			return ret, err
		}
	case AccountBundleVersion_V2:
		if o.V2__ == nil {
			err = errors.New("unexpected nil value for V2__")
			return ret, err
		}
	case AccountBundleVersion_V3:
		if o.V3__ == nil {
			err = errors.New("unexpected nil value for V3__")
			return ret, err
		}
	case AccountBundleVersion_V4:
		if o.V4__ == nil {
			err = errors.New("unexpected nil value for V4__")
			return ret, err
		}
	case AccountBundleVersion_V5:
		if o.V5__ == nil {
			err = errors.New("unexpected nil value for V5__")
			return ret, err
		}
	case AccountBundleVersion_V6:
		if o.V6__ == nil {
			err = errors.New("unexpected nil value for V6__")
			return ret, err
		}
	case AccountBundleVersion_V7:
		if o.V7__ == nil {
			err = errors.New("unexpected nil value for V7__")
			return ret, err
		}
	case AccountBundleVersion_V8:
		if o.V8__ == nil {
			err = errors.New("unexpected nil value for V8__")
			return ret, err
		}
	case AccountBundleVersion_V9:
		if o.V9__ == nil {
			err = errors.New("unexpected nil value for V9__")
			return ret, err
		}
	case AccountBundleVersion_V10:
		if o.V10__ == nil {
			err = errors.New("unexpected nil value for V10__")
			return ret, err
		}
	}
	return o.Version__, nil
}

func (o AccountBundleSecretVersioned) V1() (res AccountBundleSecretV1) {
	if o.Version__ != AccountBundleVersion_V1 {
		panic("wrong case accessed")
	}
	if o.V1__ == nil {
		return
	}
	return *o.V1__
}

func (o AccountBundleSecretVersioned) V2() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V2 {
		panic("wrong case accessed")
	}
	if o.V2__ == nil {
		return
	}
	return *o.V2__
}

func (o AccountBundleSecretVersioned) V3() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V3 {
		panic("wrong case accessed")
	}
	if o.V3__ == nil {
		return
	}
	return *o.V3__
}

func (o AccountBundleSecretVersioned) V4() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V4 {
		panic("wrong case accessed")
	}
	if o.V4__ == nil {
		return
	}
	return *o.V4__
}

func (o AccountBundleSecretVersioned) V5() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V5 {
		panic("wrong case accessed")
	}
	if o.V5__ == nil {
		return
	}
	return *o.V5__
}

func (o AccountBundleSecretVersioned) V6() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V6 {
		panic("wrong case accessed")
	}
	if o.V6__ == nil {
		return
	}
	return *o.V6__
}

func (o AccountBundleSecretVersioned) V7() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V7 {
		panic("wrong case accessed")
	}
	if o.V7__ == nil {
		return
	}
	return *o.V7__
}

func (o AccountBundleSecretVersioned) V8() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V8 {
		panic("wrong case accessed")
	}
	if o.V8__ == nil {
		return
	}
	return *o.V8__
}

func (o AccountBundleSecretVersioned) V9() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V9 {
		panic("wrong case accessed")
	}
	if o.V9__ == nil {
		return
	}
	return *o.V9__
}

func (o AccountBundleSecretVersioned) V10() (res AccountBundleSecretUnsupported) {
	if o.Version__ != AccountBundleVersion_V10 {
		panic("wrong case accessed")
	}
	if o.V10__ == nil {
		return
	}
	return *o.V10__
}

func NewAccountBundleSecretVersionedWithV1(v AccountBundleSecretV1) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V1,
		V1__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV2(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V2,
		V2__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV3(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V3,
		V3__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV4(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V4,
		V4__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV5(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V5,
		V5__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV6(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V6,
		V6__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV7(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V7,
		V7__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV8(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V8,
		V8__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV9(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V9,
		V9__:      &v,
	}
}

func NewAccountBundleSecretVersionedWithV10(v AccountBundleSecretUnsupported) AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: AccountBundleVersion_V10,
		V10__:     &v,
	}
}

func (o AccountBundleSecretVersioned) DeepCopy() AccountBundleSecretVersioned {
	return AccountBundleSecretVersioned{
		Version__: o.Version__.DeepCopy(),
		V1__: (func(x *AccountBundleSecretV1) *AccountBundleSecretV1 {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V1__),
		V2__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V2__),
		V3__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V3__),
		V4__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V4__),
		V5__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V5__),
		V6__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V6__),
		V7__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V7__),
		V8__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V8__),
		V9__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V9__),
		V10__: (func(x *AccountBundleSecretUnsupported) *AccountBundleSecretUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V10__),
	}
}

type AccountBundleSecretV1 struct {
	AccountID AccountID   `codec:"accountID" json:"accountID"`
	Signers   []SecretKey `codec:"signers" json:"signers"`
}

func (o AccountBundleSecretV1) DeepCopy() AccountBundleSecretV1 {
	return AccountBundleSecretV1{
		AccountID: o.AccountID.DeepCopy(),
		Signers: (func(x []SecretKey) []SecretKey {
			if x == nil {
				return nil
			}
			ret := make([]SecretKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Signers),
	}
}

type AccountBundleSecretUnsupported struct {
}

func (o AccountBundleSecretUnsupported) DeepCopy() AccountBundleSecretUnsupported {
	return AccountBundleSecretUnsupported{}
}

type Bundle struct {
	Revision       BundleRevision              `codec:"revision" json:"revision"`
	Prev           Hash                        `codec:"prev" json:"prev"`
	OwnHash        Hash                        `codec:"ownHash" json:"ownHash"`
	Accounts       []BundleEntry               `codec:"accounts" json:"accounts"`
	AccountBundles map[AccountID]AccountBundle `codec:"accountBundles" json:"accountBundles"`
}

func (o Bundle) DeepCopy() Bundle {
	return Bundle{
		Revision: o.Revision.DeepCopy(),
		Prev:     o.Prev.DeepCopy(),
		OwnHash:  o.OwnHash.DeepCopy(),
		Accounts: (func(x []BundleEntry) []BundleEntry {
			if x == nil {
				return nil
			}
			ret := make([]BundleEntry, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Accounts),
		AccountBundles: (func(x map[AccountID]AccountBundle) map[AccountID]AccountBundle {
			if x == nil {
				return nil
			}
			ret := make(map[AccountID]AccountBundle, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.AccountBundles),
	}
}

type BundleEntry struct {
	AccountID          AccountID      `codec:"accountID" json:"accountID"`
	Mode               AccountMode    `codec:"mode" json:"mode"`
	IsPrimary          bool           `codec:"isPrimary" json:"isPrimary"`
	Name               string         `codec:"name" json:"name"`
	AcctBundleRevision BundleRevision `codec:"acctBundleRevision" json:"acctBundleRevision"`
	EncAcctBundleHash  Hash           `codec:"encAcctBundleHash" json:"encAcctBundleHash"`
}

func (o BundleEntry) DeepCopy() BundleEntry {
	return BundleEntry{
		AccountID:          o.AccountID.DeepCopy(),
		Mode:               o.Mode.DeepCopy(),
		IsPrimary:          o.IsPrimary,
		Name:               o.Name,
		AcctBundleRevision: o.AcctBundleRevision.DeepCopy(),
		EncAcctBundleHash:  o.EncAcctBundleHash.DeepCopy(),
	}
}

type AccountBundle struct {
	Prev      Hash        `codec:"prev" json:"prev"`
	OwnHash   Hash        `codec:"ownHash" json:"ownHash"`
	AccountID AccountID   `codec:"accountID" json:"accountID"`
	Signers   []SecretKey `codec:"signers" json:"signers"`
}

func (o AccountBundle) DeepCopy() AccountBundle {
	return AccountBundle{
		Prev:      o.Prev.DeepCopy(),
		OwnHash:   o.OwnHash.DeepCopy(),
		AccountID: o.AccountID.DeepCopy(),
		Signers: (func(x []SecretKey) []SecretKey {
			if x == nil {
				return nil
			}
			ret := make([]SecretKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Signers),
	}
}

type BundleInterface interface {
}

func BundleProtocol(i BundleInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "stellar.1.bundle",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type BundleClient struct {
	Cli rpc.GenericClient
}
