// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/secretkeys.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type NaclSigningKeyPublic [32]byte

func (o NaclSigningKeyPublic) DeepCopy() NaclSigningKeyPublic {
	var ret NaclSigningKeyPublic
	copy(ret[:], o[:])
	return ret
}

type NaclSigningKeyPrivate [64]byte

func (o NaclSigningKeyPrivate) DeepCopy() NaclSigningKeyPrivate {
	var ret NaclSigningKeyPrivate
	copy(ret[:], o[:])
	return ret
}

type NaclDHKeyPublic [32]byte

func (o NaclDHKeyPublic) DeepCopy() NaclDHKeyPublic {
	var ret NaclDHKeyPublic
	copy(ret[:], o[:])
	return ret
}

type NaclDHKeyPrivate [32]byte

func (o NaclDHKeyPrivate) DeepCopy() NaclDHKeyPrivate {
	var ret NaclDHKeyPrivate
	copy(ret[:], o[:])
	return ret
}

type SecretKeys struct {
	Signing    NaclSigningKeyPrivate `codec:"signing" json:"signing"`
	Encryption NaclDHKeyPrivate      `codec:"encryption" json:"encryption"`
}

func (o SecretKeys) DeepCopy() SecretKeys {
	return SecretKeys{
		Signing:    o.Signing.DeepCopy(),
		Encryption: o.Encryption.DeepCopy(),
	}
}

type GetSecretKeysArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SecretKeysInterface interface {
	GetSecretKeys(context.Context, int) (SecretKeys, error)
}

func SecretKeysProtocol(i SecretKeysInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.SecretKeys",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getSecretKeys": {
				MakeArg: func() interface{} {
					var ret [1]GetSecretKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetSecretKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetSecretKeysArg)(nil), args)
						return
					}
					ret, err = i.GetSecretKeys(ctx, typedArgs[0].SessionID)
					return
				},
			},
		},
	}
}

type SecretKeysClient struct {
	Cli rpc.GenericClient
}

func (c SecretKeysClient) GetSecretKeys(ctx context.Context, sessionID int) (res SecretKeys, err error) {
	__arg := GetSecretKeysArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.SecretKeys.getSecretKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
