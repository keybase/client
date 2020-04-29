// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
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
	NoForcePoll               bool             `codec:"noForcePoll" json:"noForcePoll"`
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
		NoForcePoll:               o.NoForcePoll,
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

type SaltpackEncryptResult struct {
	UsedUnresolvedSBS      bool   `codec:"usedUnresolvedSBS" json:"usedUnresolvedSBS"`
	UnresolvedSBSAssertion string `codec:"unresolvedSBSAssertion" json:"unresolvedSBSAssertion"`
}

func (o SaltpackEncryptResult) DeepCopy() SaltpackEncryptResult {
	return SaltpackEncryptResult{
		UsedUnresolvedSBS:      o.UsedUnresolvedSBS,
		UnresolvedSBSAssertion: o.UnresolvedSBSAssertion,
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

type SaltpackEncryptStringResult struct {
	UsedUnresolvedSBS      bool   `codec:"usedUnresolvedSBS" json:"usedUnresolvedSBS"`
	UnresolvedSBSAssertion string `codec:"unresolvedSBSAssertion" json:"unresolvedSBSAssertion"`
	Ciphertext             string `codec:"ciphertext" json:"ciphertext"`
}

func (o SaltpackEncryptStringResult) DeepCopy() SaltpackEncryptStringResult {
	return SaltpackEncryptStringResult{
		UsedUnresolvedSBS:      o.UsedUnresolvedSBS,
		UnresolvedSBSAssertion: o.UnresolvedSBSAssertion,
		Ciphertext:             o.Ciphertext,
	}
}

type SaltpackEncryptFileResult struct {
	UsedUnresolvedSBS      bool   `codec:"usedUnresolvedSBS" json:"usedUnresolvedSBS"`
	UnresolvedSBSAssertion string `codec:"unresolvedSBSAssertion" json:"unresolvedSBSAssertion"`
	Filename               string `codec:"filename" json:"filename"`
}

func (o SaltpackEncryptFileResult) DeepCopy() SaltpackEncryptFileResult {
	return SaltpackEncryptFileResult{
		UsedUnresolvedSBS:      o.UsedUnresolvedSBS,
		UnresolvedSBSAssertion: o.UnresolvedSBSAssertion,
		Filename:               o.Filename,
	}
}

type SaltpackPlaintextResult struct {
	Info      SaltpackEncryptedMessageInfo `codec:"info" json:"info"`
	Plaintext string                       `codec:"plaintext" json:"plaintext"`
	Signed    bool                         `codec:"signed" json:"signed"`
}

func (o SaltpackPlaintextResult) DeepCopy() SaltpackPlaintextResult {
	return SaltpackPlaintextResult{
		Info:      o.Info.DeepCopy(),
		Plaintext: o.Plaintext,
		Signed:    o.Signed,
	}
}

type SaltpackFileResult struct {
	Info              SaltpackEncryptedMessageInfo `codec:"info" json:"info"`
	DecryptedFilename string                       `codec:"decryptedFilename" json:"decryptedFilename"`
	Signed            bool                         `codec:"signed" json:"signed"`
}

func (o SaltpackFileResult) DeepCopy() SaltpackFileResult {
	return SaltpackFileResult{
		Info:              o.Info.DeepCopy(),
		DecryptedFilename: o.DecryptedFilename,
		Signed:            o.Signed,
	}
}

type SaltpackVerifyResult struct {
	SigningKID KID            `codec:"signingKID" json:"signingKID"`
	Sender     SaltpackSender `codec:"sender" json:"sender"`
	Plaintext  string         `codec:"plaintext" json:"plaintext"`
	Verified   bool           `codec:"verified" json:"verified"`
}

func (o SaltpackVerifyResult) DeepCopy() SaltpackVerifyResult {
	return SaltpackVerifyResult{
		SigningKID: o.SigningKID.DeepCopy(),
		Sender:     o.Sender.DeepCopy(),
		Plaintext:  o.Plaintext,
		Verified:   o.Verified,
	}
}

type SaltpackVerifyFileResult struct {
	SigningKID       KID            `codec:"signingKID" json:"signingKID"`
	Sender           SaltpackSender `codec:"sender" json:"sender"`
	VerifiedFilename string         `codec:"verifiedFilename" json:"verifiedFilename"`
	Verified         bool           `codec:"verified" json:"verified"`
}

func (o SaltpackVerifyFileResult) DeepCopy() SaltpackVerifyFileResult {
	return SaltpackVerifyFileResult{
		SigningKID:       o.SigningKID.DeepCopy(),
		Sender:           o.Sender.DeepCopy(),
		VerifiedFilename: o.VerifiedFilename,
		Verified:         o.Verified,
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

type SaltpackEncryptStringToTextFileArg struct {
	SessionID int                            `codec:"sessionID" json:"sessionID"`
	Plaintext string                         `codec:"plaintext" json:"plaintext"`
	Opts      SaltpackFrontendEncryptOptions `codec:"opts" json:"opts"`
}

type SaltpackEncryptFileArg struct {
	SessionID      int                            `codec:"sessionID" json:"sessionID"`
	Filename       string                         `codec:"filename" json:"filename"`
	DestinationDir string                         `codec:"destinationDir" json:"destinationDir"`
	Opts           SaltpackFrontendEncryptOptions `codec:"opts" json:"opts"`
}

type SaltpackDecryptStringArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Ciphertext string `codec:"ciphertext" json:"ciphertext"`
}

type SaltpackDecryptFileArg struct {
	SessionID         int    `codec:"sessionID" json:"sessionID"`
	EncryptedFilename string `codec:"encryptedFilename" json:"encryptedFilename"`
	DestinationDir    string `codec:"destinationDir" json:"destinationDir"`
}

type SaltpackSignStringArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Plaintext string `codec:"plaintext" json:"plaintext"`
}

type SaltpackSignStringToTextFileArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Plaintext string `codec:"plaintext" json:"plaintext"`
}

type SaltpackSignFileArg struct {
	SessionID      int    `codec:"sessionID" json:"sessionID"`
	Filename       string `codec:"filename" json:"filename"`
	DestinationDir string `codec:"destinationDir" json:"destinationDir"`
}

type SaltpackSaveCiphertextToFileArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Ciphertext string `codec:"ciphertext" json:"ciphertext"`
}

type SaltpackSaveSignedMsgToFileArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	SignedMsg string `codec:"signedMsg" json:"signedMsg"`
}

type SaltpackVerifyStringArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	SignedMsg string `codec:"signedMsg" json:"signedMsg"`
}

type SaltpackVerifyFileArg struct {
	SessionID      int    `codec:"sessionID" json:"sessionID"`
	SignedFilename string `codec:"signedFilename" json:"signedFilename"`
	DestinationDir string `codec:"destinationDir" json:"destinationDir"`
}

type SaltpackInterface interface {
	SaltpackEncrypt(context.Context, SaltpackEncryptArg) (SaltpackEncryptResult, error)
	SaltpackDecrypt(context.Context, SaltpackDecryptArg) (SaltpackEncryptedMessageInfo, error)
	SaltpackSign(context.Context, SaltpackSignArg) error
	SaltpackVerify(context.Context, SaltpackVerifyArg) error
	SaltpackEncryptString(context.Context, SaltpackEncryptStringArg) (SaltpackEncryptStringResult, error)
	SaltpackEncryptStringToTextFile(context.Context, SaltpackEncryptStringToTextFileArg) (SaltpackEncryptFileResult, error)
	SaltpackEncryptFile(context.Context, SaltpackEncryptFileArg) (SaltpackEncryptFileResult, error)
	SaltpackDecryptString(context.Context, SaltpackDecryptStringArg) (SaltpackPlaintextResult, error)
	SaltpackDecryptFile(context.Context, SaltpackDecryptFileArg) (SaltpackFileResult, error)
	SaltpackSignString(context.Context, SaltpackSignStringArg) (string, error)
	SaltpackSignStringToTextFile(context.Context, SaltpackSignStringToTextFileArg) (string, error)
	SaltpackSignFile(context.Context, SaltpackSignFileArg) (string, error)
	SaltpackSaveCiphertextToFile(context.Context, SaltpackSaveCiphertextToFileArg) (string, error)
	SaltpackSaveSignedMsgToFile(context.Context, SaltpackSaveSignedMsgToFileArg) (string, error)
	SaltpackVerifyString(context.Context, SaltpackVerifyStringArg) (SaltpackVerifyResult, error)
	SaltpackVerifyFile(context.Context, SaltpackVerifyFileArg) (SaltpackVerifyFileResult, error)
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
					ret, err = i.SaltpackEncrypt(ctx, typedArgs[0])
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
			"saltpackEncryptStringToTextFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackEncryptStringToTextFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackEncryptStringToTextFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackEncryptStringToTextFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackEncryptStringToTextFile(ctx, typedArgs[0])
					return
				},
			},
			"saltpackEncryptFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackEncryptFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackEncryptFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackEncryptFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackEncryptFile(ctx, typedArgs[0])
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
			"saltpackDecryptFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackDecryptFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackDecryptFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackDecryptFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackDecryptFile(ctx, typedArgs[0])
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
			"saltpackSignStringToTextFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackSignStringToTextFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackSignStringToTextFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackSignStringToTextFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackSignStringToTextFile(ctx, typedArgs[0])
					return
				},
			},
			"saltpackSignFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackSignFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackSignFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackSignFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackSignFile(ctx, typedArgs[0])
					return
				},
			},
			"saltpackSaveCiphertextToFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackSaveCiphertextToFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackSaveCiphertextToFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackSaveCiphertextToFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackSaveCiphertextToFile(ctx, typedArgs[0])
					return
				},
			},
			"saltpackSaveSignedMsgToFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackSaveSignedMsgToFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackSaveSignedMsgToFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackSaveSignedMsgToFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackSaveSignedMsgToFile(ctx, typedArgs[0])
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
			"saltpackVerifyFile": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackVerifyFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackVerifyFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackVerifyFileArg)(nil), args)
						return
					}
					ret, err = i.SaltpackVerifyFile(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type SaltpackClient struct {
	Cli rpc.GenericClient
}

func (c SaltpackClient) SaltpackEncrypt(ctx context.Context, __arg SaltpackEncryptArg) (res SaltpackEncryptResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackEncrypt", []interface{}{__arg}, &res, 0*time.Millisecond)
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

func (c SaltpackClient) SaltpackEncryptString(ctx context.Context, __arg SaltpackEncryptStringArg) (res SaltpackEncryptStringResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackEncryptString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackEncryptStringToTextFile(ctx context.Context, __arg SaltpackEncryptStringToTextFileArg) (res SaltpackEncryptFileResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackEncryptStringToTextFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackEncryptFile(ctx context.Context, __arg SaltpackEncryptFileArg) (res SaltpackEncryptFileResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackEncryptFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackDecryptString(ctx context.Context, __arg SaltpackDecryptStringArg) (res SaltpackPlaintextResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackDecryptString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackDecryptFile(ctx context.Context, __arg SaltpackDecryptFileArg) (res SaltpackFileResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackDecryptFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackSignString(ctx context.Context, __arg SaltpackSignStringArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSignString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackSignStringToTextFile(ctx context.Context, __arg SaltpackSignStringToTextFileArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSignStringToTextFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackSignFile(ctx context.Context, __arg SaltpackSignFileArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSignFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackSaveCiphertextToFile(ctx context.Context, __arg SaltpackSaveCiphertextToFileArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSaveCiphertextToFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackSaveSignedMsgToFile(ctx context.Context, __arg SaltpackSaveSignedMsgToFileArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSaveSignedMsgToFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackVerifyString(ctx context.Context, __arg SaltpackVerifyStringArg) (res SaltpackVerifyResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackVerifyString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SaltpackClient) SaltpackVerifyFile(ctx context.Context, __arg SaltpackVerifyFileArg) (res SaltpackVerifyFileResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackVerifyFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
