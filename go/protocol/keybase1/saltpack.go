// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/saltpack.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type AuthenticityType int

const (
	AuthenticityType_SIGNED     AuthenticityType = 0
	AuthenticityType_REPUDIABLE AuthenticityType = 1
	AuthenticityType_ANONYMOUS  AuthenticityType = 2
)

func (o AuthenticityType) DeepCopy() AuthenticityType { return o }

var AuthenticityTypeMap = map[string]AuthenticityType{
	"SIGNED":     0,
	"REPUDIABLE": 1,
	"ANONYMOUS":  2,
}

var AuthenticityTypeRevMap = map[AuthenticityType]string{
	0: "SIGNED",
	1: "REPUDIABLE",
	2: "ANONYMOUS",
}

func (e AuthenticityType) String() string {
	if v, ok := AuthenticityTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SaltpackEncryptOptions struct {
	Recipients                []string         `codec:"recipients" json:"recipients"`
	TeamRecipients            []string         `codec:"teamRecipients" json:"teamRecipients"`
	AuthenticityType          AuthenticityType `codec:"authenticityType" json:"authenticityType"`
	UseEntityKeys             bool             `codec:"useEntityKeys" json:"useEntityKeys"`
	UseDeviceKeys             bool             `codec:"useDeviceKeys" json:"useDeviceKeys"`
	UsePaperKeys              bool             `codec:"usePaperKeys" json:"usePaperKeys"`
	NoSelfEncrypt             bool             `codec:"noSelfEncrypt" json:"noSelfEncrypt"`
	Binary                    bool             `codec:"binary" json:"binary"`
	SaltpackVersion           int              `codec:"saltpackVersion" json:"saltpackVersion"`
	UseKBFSKeysOnlyForTesting bool             `codec:"useKBFSKeysOnlyForTesting" json:"useKBFSKeysOnlyForTesting"`
}

func (o SaltpackEncryptOptions) DeepCopy() SaltpackEncryptOptions {
	return SaltpackEncryptOptions{
		Recipients: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Recipients),
		TeamRecipients: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.TeamRecipients),
		AuthenticityType:          o.AuthenticityType.DeepCopy(),
		UseEntityKeys:             o.UseEntityKeys,
		UseDeviceKeys:             o.UseDeviceKeys,
		UsePaperKeys:              o.UsePaperKeys,
		NoSelfEncrypt:             o.NoSelfEncrypt,
		Binary:                    o.Binary,
		SaltpackVersion:           o.SaltpackVersion,
		UseKBFSKeysOnlyForTesting: o.UseKBFSKeysOnlyForTesting,
	}
}

type SaltpackDecryptOptions struct {
	Interactive      bool `codec:"interactive" json:"interactive"`
	ForceRemoteCheck bool `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
	UsePaperKey      bool `codec:"usePaperKey" json:"usePaperKey"`
}

func (o SaltpackDecryptOptions) DeepCopy() SaltpackDecryptOptions {
	return SaltpackDecryptOptions{
		Interactive:      o.Interactive,
		ForceRemoteCheck: o.ForceRemoteCheck,
		UsePaperKey:      o.UsePaperKey,
	}
}

type SaltpackSignOptions struct {
	Detached        bool `codec:"detached" json:"detached"`
	Binary          bool `codec:"binary" json:"binary"`
	SaltpackVersion int  `codec:"saltpackVersion" json:"saltpackVersion"`
}

func (o SaltpackSignOptions) DeepCopy() SaltpackSignOptions {
	return SaltpackSignOptions{
		Detached:        o.Detached,
		Binary:          o.Binary,
		SaltpackVersion: o.SaltpackVersion,
	}
}

type SaltpackVerifyOptions struct {
	SignedBy  string `codec:"signedBy" json:"signedBy"`
	Signature []byte `codec:"signature" json:"signature"`
}

func (o SaltpackVerifyOptions) DeepCopy() SaltpackVerifyOptions {
	return SaltpackVerifyOptions{
		SignedBy: o.SignedBy,
		Signature: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Signature),
	}
}

type SaltpackEncryptedMessageInfo struct {
	Devices          []Device       `codec:"devices" json:"devices"`
	NumAnonReceivers int            `codec:"numAnonReceivers" json:"numAnonReceivers"`
	ReceiverIsAnon   bool           `codec:"receiverIsAnon" json:"receiverIsAnon"`
	Sender           SaltpackSender `codec:"sender" json:"sender"`
}

func (o SaltpackEncryptedMessageInfo) DeepCopy() SaltpackEncryptedMessageInfo {
	return SaltpackEncryptedMessageInfo{
		Devices: (func(x []Device) []Device {
			if x == nil {
				return nil
			}
			ret := make([]Device, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Devices),
		NumAnonReceivers: o.NumAnonReceivers,
		ReceiverIsAnon:   o.ReceiverIsAnon,
		Sender:           o.Sender.DeepCopy(),
	}
}

type SaltpackFrontendEncryptOptions struct {
	Recipients  []string `codec:"recipients" json:"recipients"`
	Signed      bool     `codec:"signed" json:"signed"`
	IncludeSelf bool     `codec:"includeSelf" json:"includeSelf"`
}

func (o SaltpackFrontendEncryptOptions) DeepCopy() SaltpackFrontendEncryptOptions {
	return SaltpackFrontendEncryptOptions{
		Recipients: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Recipients),
		Signed:      o.Signed,
		IncludeSelf: o.IncludeSelf,
	}
}

type SaltpackPlaintextResult struct {
	Info      SaltpackEncryptedMessageInfo `codec:"info" json:"info"`
	Plaintext string                       `codec:"plaintext" json:"plaintext"`
}

func (o SaltpackPlaintextResult) DeepCopy() SaltpackPlaintextResult {
	return SaltpackPlaintextResult{
		Info:      o.Info.DeepCopy(),
		Plaintext: o.Plaintext,
	}
}

type SaltpackVerifyResult struct {
	SigningKID KID            `codec:"signingKID" json:"signingKID"`
	Sender     SaltpackSender `codec:"sender" json:"sender"`
	Plaintext  string         `codec:"plaintext" json:"plaintext"`
}

func (o SaltpackVerifyResult) DeepCopy() SaltpackVerifyResult {
	return SaltpackVerifyResult{
		SigningKID: o.SigningKID.DeepCopy(),
		Sender:     o.Sender.DeepCopy(),
		Plaintext:  o.Plaintext,
	}
}

type SaltpackEncryptArg struct {
	SessionID int                    `codec:"sessionID" json:"sessionID"`
	Source    Stream                 `codec:"source" json:"source"`
	Sink      Stream                 `codec:"sink" json:"sink"`
	Opts      SaltpackEncryptOptions `codec:"opts" json:"opts"`
}

type SaltpackDecryptArg struct {
	SessionID int                    `codec:"sessionID" json:"sessionID"`
	Source    Stream                 `codec:"source" json:"source"`
	Sink      Stream                 `codec:"sink" json:"sink"`
	Opts      SaltpackDecryptOptions `codec:"opts" json:"opts"`
}

type SaltpackSignArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	Source    Stream              `codec:"source" json:"source"`
	Sink      Stream              `codec:"sink" json:"sink"`
	Opts      SaltpackSignOptions `codec:"opts" json:"opts"`
}

type SaltpackVerifyArg struct {
	SessionID int                   `codec:"sessionID" json:"sessionID"`
	Source    Stream                `codec:"source" json:"source"`
	Sink      Stream                `codec:"sink" json:"sink"`
	Opts      SaltpackVerifyOptions `codec:"opts" json:"opts"`
}

type SaltpackEncryptStringArg struct {
	SessionID int                            `codec:"sessionID" json:"sessionID"`
	Plaintext string                         `codec:"plaintext" json:"plaintext"`
	Opts      SaltpackFrontendEncryptOptions `codec:"opts" json:"opts"`
}

type SaltpackDecryptStringArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Ciphertext string `codec:"ciphertext" json:"ciphertext"`
}

type SaltpackSignStringArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Plaintext string `codec:"plaintext" json:"plaintext"`
}

type SaltpackVerifyStringArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	SignedMsg string `codec:"signedMsg" json:"signedMsg"`
}

type SaltpackInterface interface {
	SaltpackEncrypt(context.Context, SaltpackEncryptArg) error
	SaltpackDecrypt(context.Context, SaltpackDecryptArg) (SaltpackEncryptedMessageInfo, error)
	SaltpackSign(context.Context, SaltpackSignArg) error
	SaltpackVerify(context.Context, SaltpackVerifyArg) error
	SaltpackEncryptString(context.Context, SaltpackEncryptStringArg) (string, error)
	SaltpackDecryptString(context.Context, SaltpackDecryptStringArg) (SaltpackPlaintextResult, error)
	SaltpackSignString(context.Context, SaltpackSignStringArg) (string, error)
	SaltpackVerifyString(context.Context, SaltpackVerifyStringArg) (SaltpackVerifyResult, error)
}

func SaltpackProtocol(i SaltpackInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.saltpack",
		Methods: map[string]rpc.ServeHandlerDescription{
			"saltpackEncrypt": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackEncryptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackEncryptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackEncryptArg)(nil), args)
						return
					}
					err = i.SaltpackEncrypt(ctx, typedArgs[0])
					return
				},
			},
			"saltpackDecrypt": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackDecryptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackDecryptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackDecryptArg)(nil), args)
						return
					}
					ret, err = i.SaltpackDecrypt(ctx, typedArgs[0])
					return
				},
			},
			"saltpackSign": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackSignArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackSignArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackSignArg)(nil), args)
						return
					}
					err = i.SaltpackSign(ctx, typedArgs[0])
					return
				},
			},
			"saltpackVerify": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackVerifyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackVerifyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackVerifyArg)(nil), args)
						return
					}
					err = i.SaltpackVerify(ctx, typedArgs[0])
					return
				},
			},
			"saltpackEncryptString": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackEncryptStringArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackEncryptStringArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackEncryptStringArg)(nil), args)
						return
					}
					ret, err = i.SaltpackEncryptString(ctx, typedArgs[0])
					return
				},
			},
			"saltpackDecryptString": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackDecryptStringArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackDecryptStringArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackDecryptStringArg)(nil), args)
						return
					}
					ret, err = i.SaltpackDecryptString(ctx, typedArgs[0])
					return
				},
			},
			"saltpackSignString": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackSignStringArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackSignStringArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackSignStringArg)(nil), args)
						return
					}
					ret, err = i.SaltpackSignString(ctx, typedArgs[0])
					return
				},
			},
			"saltpackVerifyString": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackVerifyStringArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackVerifyStringArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackVerifyStringArg)(nil), args)
						return
					}
					ret, err = i.SaltpackVerifyString(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type SaltpackClient struct {
	Cli rpc.GenericClient
}

func (c SaltpackClient) SaltpackEncrypt(ctx context.Context, __arg SaltpackEncryptArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackEncrypt", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackDecrypt(ctx context.Context, __arg SaltpackDecryptArg) (res SaltpackEncryptedMessageInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackDecrypt", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackSign(ctx context.Context, __arg SaltpackSignArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSign", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackVerify(ctx context.Context, __arg SaltpackVerifyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackVerify", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackEncryptString(ctx context.Context, __arg SaltpackEncryptStringArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackEncryptString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackDecryptString(ctx context.Context, __arg SaltpackDecryptStringArg) (res SaltpackPlaintextResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackDecryptString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackSignString(ctx context.Context, __arg SaltpackSignStringArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSignString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackVerifyString(ctx context.Context, __arg SaltpackVerifyStringArg) (res SaltpackVerifyResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackVerifyString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
