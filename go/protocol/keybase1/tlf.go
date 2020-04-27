// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/tlf.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type CryptKeysArg struct {
	Query TLFQuery `codec:"query" json:"query"`
}

type PublicCanonicalTLFNameAndIDArg struct {
	Query TLFQuery `codec:"query" json:"query"`
}

type CompleteAndCanonicalizePrivateTlfNameArg struct {
	Query TLFQuery `codec:"query" json:"query"`
}

type TlfInterface interface {
	// CryptKeys returns TLF crypt keys from all generations.
	CryptKeys(context.Context, TLFQuery) (GetTLFCryptKeysRes, error)
	// * tlfCanonicalID returns the canonical name and TLFID for tlfName.
	// * TLFID should not be cached or stored persistently.
	PublicCanonicalTLFNameAndID(context.Context, TLFQuery) (CanonicalTLFNameAndIDWithBreaks, error)
	CompleteAndCanonicalizePrivateTlfName(context.Context, TLFQuery) (CanonicalTLFNameAndIDWithBreaks, error)
}

func TlfProtocol(i TlfInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.tlf",
		Methods: map[string]rpc.ServeHandlerDescription{
			"CryptKeys": {
				MakeArg: func() interface{} {
					var ret [1]CryptKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CryptKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CryptKeysArg)(nil), args)
						return
					}
					ret, err = i.CryptKeys(ctx, typedArgs[0].Query)
					return
				},
			},
			"publicCanonicalTLFNameAndID": {
				MakeArg: func() interface{} {
					var ret [1]PublicCanonicalTLFNameAndIDArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PublicCanonicalTLFNameAndIDArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PublicCanonicalTLFNameAndIDArg)(nil), args)
						return
					}
					ret, err = i.PublicCanonicalTLFNameAndID(ctx, typedArgs[0].Query)
					return
				},
			},
			"completeAndCanonicalizePrivateTlfName": {
				MakeArg: func() interface{} {
					var ret [1]CompleteAndCanonicalizePrivateTlfNameArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CompleteAndCanonicalizePrivateTlfNameArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CompleteAndCanonicalizePrivateTlfNameArg)(nil), args)
						return
					}
					ret, err = i.CompleteAndCanonicalizePrivateTlfName(ctx, typedArgs[0].Query)
					return
				},
			},
		},
	}
}

type TlfClient struct {
	Cli rpc.GenericClient
}

// CryptKeys returns TLF crypt keys from all generations.
func (c TlfClient) CryptKeys(ctx context.Context, query TLFQuery) (res GetTLFCryptKeysRes, err error) {
	__arg := CryptKeysArg{Query: query}
	err = c.Cli.Call(ctx, "keybase.1.tlf.CryptKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// * tlfCanonicalID returns the canonical name and TLFID for tlfName.
// * TLFID should not be cached or stored persistently.
func (c TlfClient) PublicCanonicalTLFNameAndID(ctx context.Context, query TLFQuery) (res CanonicalTLFNameAndIDWithBreaks, err error) {
	__arg := PublicCanonicalTLFNameAndIDArg{Query: query}
	err = c.Cli.Call(ctx, "keybase.1.tlf.publicCanonicalTLFNameAndID", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c TlfClient) CompleteAndCanonicalizePrivateTlfName(ctx context.Context, query TLFQuery) (res CanonicalTLFNameAndIDWithBreaks, err error) {
	__arg := CompleteAndCanonicalizePrivateTlfNameArg{Query: query}
	err = c.Cli.Call(ctx, "keybase.1.tlf.completeAndCanonicalizePrivateTlfName", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
