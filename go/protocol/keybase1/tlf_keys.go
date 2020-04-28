// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/tlf_keys.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type TLFIdentifyBehavior int

const (
	TLFIdentifyBehavior_UNSET              TLFIdentifyBehavior = 0
	TLFIdentifyBehavior_CHAT_CLI           TLFIdentifyBehavior = 1
	TLFIdentifyBehavior_CHAT_GUI           TLFIdentifyBehavior = 2
	TLFIdentifyBehavior_REMOVED_AND_UNUSED TLFIdentifyBehavior = 3
	TLFIdentifyBehavior_KBFS_REKEY         TLFIdentifyBehavior = 4
	TLFIdentifyBehavior_KBFS_QR            TLFIdentifyBehavior = 5
	TLFIdentifyBehavior_CHAT_SKIP          TLFIdentifyBehavior = 6
	TLFIdentifyBehavior_SALTPACK           TLFIdentifyBehavior = 7
	TLFIdentifyBehavior_CLI                TLFIdentifyBehavior = 8
	TLFIdentifyBehavior_GUI                TLFIdentifyBehavior = 9
	TLFIdentifyBehavior_DEFAULT_KBFS       TLFIdentifyBehavior = 10
	TLFIdentifyBehavior_KBFS_CHAT          TLFIdentifyBehavior = 11
	TLFIdentifyBehavior_RESOLVE_AND_CHECK  TLFIdentifyBehavior = 12
	TLFIdentifyBehavior_GUI_PROFILE        TLFIdentifyBehavior = 13
	TLFIdentifyBehavior_KBFS_INIT          TLFIdentifyBehavior = 14
	TLFIdentifyBehavior_FS_GUI             TLFIdentifyBehavior = 15
)

func (o TLFIdentifyBehavior) DeepCopy() TLFIdentifyBehavior { return o }

var TLFIdentifyBehaviorMap = map[string]TLFIdentifyBehavior{
	"UNSET":              0,
	"CHAT_CLI":           1,
	"CHAT_GUI":           2,
	"REMOVED_AND_UNUSED": 3,
	"KBFS_REKEY":         4,
	"KBFS_QR":            5,
	"CHAT_SKIP":          6,
	"SALTPACK":           7,
	"CLI":                8,
	"GUI":                9,
	"DEFAULT_KBFS":       10,
	"KBFS_CHAT":          11,
	"RESOLVE_AND_CHECK":  12,
	"GUI_PROFILE":        13,
	"KBFS_INIT":          14,
	"FS_GUI":             15,
}

var TLFIdentifyBehaviorRevMap = map[TLFIdentifyBehavior]string{
	0:  "UNSET",
	1:  "CHAT_CLI",
	2:  "CHAT_GUI",
	3:  "REMOVED_AND_UNUSED",
	4:  "KBFS_REKEY",
	5:  "KBFS_QR",
	6:  "CHAT_SKIP",
	7:  "SALTPACK",
	8:  "CLI",
	9:  "GUI",
	10: "DEFAULT_KBFS",
	11: "KBFS_CHAT",
	12: "RESOLVE_AND_CHECK",
	13: "GUI_PROFILE",
	14: "KBFS_INIT",
	15: "FS_GUI",
}

func (e TLFIdentifyBehavior) String() string {
	if v, ok := TLFIdentifyBehaviorRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type CanonicalTlfName string

func (o CanonicalTlfName) DeepCopy() CanonicalTlfName {
	return o
}

type CryptKey struct {
	KeyGeneration int     `codec:"KeyGeneration" json:"KeyGeneration"`
	Key           Bytes32 `codec:"Key" json:"Key"`
}

func (o CryptKey) DeepCopy() CryptKey {
	return CryptKey{
		KeyGeneration: o.KeyGeneration,
		Key:           o.Key.DeepCopy(),
	}
}

type TLFBreak struct {
	Breaks []TLFIdentifyFailure `codec:"breaks" json:"breaks"`
}

func (o TLFBreak) DeepCopy() TLFBreak {
	return TLFBreak{
		Breaks: (func(x []TLFIdentifyFailure) []TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Breaks),
	}
}

type TLFIdentifyFailure struct {
	User   User                 `codec:"user" json:"user"`
	Breaks *IdentifyTrackBreaks `codec:"breaks,omitempty" json:"breaks,omitempty"`
}

func (o TLFIdentifyFailure) DeepCopy() TLFIdentifyFailure {
	return TLFIdentifyFailure{
		User: o.User.DeepCopy(),
		Breaks: (func(x *IdentifyTrackBreaks) *IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Breaks),
	}
}

type CanonicalTLFNameAndIDWithBreaks struct {
	TlfID         TLFID            `codec:"tlfID" json:"tlfID"`
	CanonicalName CanonicalTlfName `codec:"CanonicalName" json:"CanonicalName"`
	Breaks        TLFBreak         `codec:"breaks" json:"breaks"`
}

func (o CanonicalTLFNameAndIDWithBreaks) DeepCopy() CanonicalTLFNameAndIDWithBreaks {
	return CanonicalTLFNameAndIDWithBreaks{
		TlfID:         o.TlfID.DeepCopy(),
		CanonicalName: o.CanonicalName.DeepCopy(),
		Breaks:        o.Breaks.DeepCopy(),
	}
}

type GetTLFCryptKeysRes struct {
	NameIDBreaks CanonicalTLFNameAndIDWithBreaks `codec:"nameIDBreaks" json:"nameIDBreaks"`
	CryptKeys    []CryptKey                      `codec:"CryptKeys" json:"CryptKeys"`
}

func (o GetTLFCryptKeysRes) DeepCopy() GetTLFCryptKeysRes {
	return GetTLFCryptKeysRes{
		NameIDBreaks: o.NameIDBreaks.DeepCopy(),
		CryptKeys: (func(x []CryptKey) []CryptKey {
			if x == nil {
				return nil
			}
			ret := make([]CryptKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.CryptKeys),
	}
}

type TLFQuery struct {
	TlfName          string              `codec:"tlfName" json:"tlfName"`
	IdentifyBehavior TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

func (o TLFQuery) DeepCopy() TLFQuery {
	return TLFQuery{
		TlfName:          o.TlfName,
		IdentifyBehavior: o.IdentifyBehavior.DeepCopy(),
	}
}

type GetTLFCryptKeysArg struct {
	Query TLFQuery `codec:"query" json:"query"`
}

type GetPublicCanonicalTLFNameAndIDArg struct {
	Query TLFQuery `codec:"query" json:"query"`
}

type TlfKeysInterface interface {
	// getTLFCryptKeys returns TLF crypt keys from all generations and the TLF ID.
	// TLF ID should not be cached or stored persistently.
	GetTLFCryptKeys(context.Context, TLFQuery) (GetTLFCryptKeysRes, error)
	// getPublicCanonicalTLFNameAndID return the canonical name and TLFID for tlfName.
	// TLF ID should not be cached or stored persistently.
	GetPublicCanonicalTLFNameAndID(context.Context, TLFQuery) (CanonicalTLFNameAndIDWithBreaks, error)
}

func TlfKeysProtocol(i TlfKeysInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.tlfKeys",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getTLFCryptKeys": {
				MakeArg: func() interface{} {
					var ret [1]GetTLFCryptKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTLFCryptKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTLFCryptKeysArg)(nil), args)
						return
					}
					ret, err = i.GetTLFCryptKeys(ctx, typedArgs[0].Query)
					return
				},
			},
			"getPublicCanonicalTLFNameAndID": {
				MakeArg: func() interface{} {
					var ret [1]GetPublicCanonicalTLFNameAndIDArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPublicCanonicalTLFNameAndIDArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPublicCanonicalTLFNameAndIDArg)(nil), args)
						return
					}
					ret, err = i.GetPublicCanonicalTLFNameAndID(ctx, typedArgs[0].Query)
					return
				},
			},
		},
	}
}

type TlfKeysClient struct {
	Cli rpc.GenericClient
}

// getTLFCryptKeys returns TLF crypt keys from all generations and the TLF ID.
// TLF ID should not be cached or stored persistently.
func (c TlfKeysClient) GetTLFCryptKeys(ctx context.Context, query TLFQuery) (res GetTLFCryptKeysRes, err error) {
	__arg := GetTLFCryptKeysArg{Query: query}
	err = c.Cli.Call(ctx, "keybase.1.tlfKeys.getTLFCryptKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// getPublicCanonicalTLFNameAndID return the canonical name and TLFID for tlfName.
// TLF ID should not be cached or stored persistently.
func (c TlfKeysClient) GetPublicCanonicalTLFNameAndID(ctx context.Context, query TLFQuery) (res CanonicalTLFNameAndIDWithBreaks, err error) {
	__arg := GetPublicCanonicalTLFNameAndIDArg{Query: query}
	err = c.Cli.Call(ctx, "keybase.1.tlfKeys.getPublicCanonicalTLFNameAndID", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
