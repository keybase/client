// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/pgp.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type SignMode int

const (
	SignMode_ATTACHED SignMode = 0
	SignMode_DETACHED SignMode = 1
	SignMode_CLEAR    SignMode = 2
)

func (o SignMode) DeepCopy() SignMode { return o }

var SignModeMap = map[string]SignMode{
	"ATTACHED": 0,
	"DETACHED": 1,
	"CLEAR":    2,
}

var SignModeRevMap = map[SignMode]string{
	0: "ATTACHED",
	1: "DETACHED",
	2: "CLEAR",
}

func (e SignMode) String() string {
	if v, ok := SignModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PGPSignOptions struct {
	KeyQuery  string   `codec:"keyQuery" json:"keyQuery"`
	Mode      SignMode `codec:"mode" json:"mode"`
	BinaryIn  bool     `codec:"binaryIn" json:"binaryIn"`
	BinaryOut bool     `codec:"binaryOut" json:"binaryOut"`
}

func (o PGPSignOptions) DeepCopy() PGPSignOptions {
	return PGPSignOptions{
		KeyQuery:  o.KeyQuery,
		Mode:      o.Mode.DeepCopy(),
		BinaryIn:  o.BinaryIn,
		BinaryOut: o.BinaryOut,
	}
}

type PGPEncryptOptions struct {
	Recipients []string `codec:"recipients" json:"recipients"`
	NoSign     bool     `codec:"noSign" json:"noSign"`
	NoSelf     bool     `codec:"noSelf" json:"noSelf"`
	BinaryOut  bool     `codec:"binaryOut" json:"binaryOut"`
	KeyQuery   string   `codec:"keyQuery" json:"keyQuery"`
}

func (o PGPEncryptOptions) DeepCopy() PGPEncryptOptions {
	return PGPEncryptOptions{
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
		NoSign:    o.NoSign,
		NoSelf:    o.NoSelf,
		BinaryOut: o.BinaryOut,
		KeyQuery:  o.KeyQuery,
	}
}

// PGPSigVerification is returned by pgpDecrypt and pgpVerify with information
// about the signature verification. If isSigned is false, there was no
// signature, and the rest of the fields should be ignored.
type PGPSigVerification struct {
	IsSigned bool      `codec:"isSigned" json:"isSigned"`
	Verified bool      `codec:"verified" json:"verified"`
	Signer   User      `codec:"signer" json:"signer"`
	SignKey  PublicKey `codec:"signKey" json:"signKey"`
	Warnings []string  `codec:"warnings" json:"warnings"`
}

func (o PGPSigVerification) DeepCopy() PGPSigVerification {
	return PGPSigVerification{
		IsSigned: o.IsSigned,
		Verified: o.Verified,
		Signer:   o.Signer.DeepCopy(),
		SignKey:  o.SignKey.DeepCopy(),
		Warnings: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Warnings),
	}
}

type PGPDecryptOptions struct {
	AssertSigned bool   `codec:"assertSigned" json:"assertSigned"`
	SignedBy     string `codec:"signedBy" json:"signedBy"`
}

func (o PGPDecryptOptions) DeepCopy() PGPDecryptOptions {
	return PGPDecryptOptions{
		AssertSigned: o.AssertSigned,
		SignedBy:     o.SignedBy,
	}
}

type PGPVerifyOptions struct {
	SignedBy  string `codec:"signedBy" json:"signedBy"`
	Signature []byte `codec:"signature" json:"signature"`
}

func (o PGPVerifyOptions) DeepCopy() PGPVerifyOptions {
	return PGPVerifyOptions{
		SignedBy: o.SignedBy,
		Signature: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Signature),
	}
}

type KeyInfo struct {
	Fingerprint string `codec:"fingerprint" json:"fingerprint"`
	Key         string `codec:"key" json:"key"`
	Desc        string `codec:"desc" json:"desc"`
}

func (o KeyInfo) DeepCopy() KeyInfo {
	return KeyInfo{
		Fingerprint: o.Fingerprint,
		Key:         o.Key,
		Desc:        o.Desc,
	}
}

type PGPQuery struct {
	Secret     bool   `codec:"secret" json:"secret"`
	Query      string `codec:"query" json:"query"`
	ExactMatch bool   `codec:"exactMatch" json:"exactMatch"`
}

func (o PGPQuery) DeepCopy() PGPQuery {
	return PGPQuery{
		Secret:     o.Secret,
		Query:      o.Query,
		ExactMatch: o.ExactMatch,
	}
}

type PGPCreateUids struct {
	UseDefault bool          `codec:"useDefault" json:"useDefault"`
	Ids        []PGPIdentity `codec:"ids" json:"ids"`
}

func (o PGPCreateUids) DeepCopy() PGPCreateUids {
	return PGPCreateUids{
		UseDefault: o.UseDefault,
		Ids: (func(x []PGPIdentity) []PGPIdentity {
			if x == nil {
				return nil
			}
			ret := make([]PGPIdentity, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Ids),
	}
}

// Export all pgp keys in lksec, then if doPurge is true, remove the keys from lksec.
type PGPPurgeRes struct {
	Filenames []string `codec:"filenames" json:"filenames"`
}

func (o PGPPurgeRes) DeepCopy() PGPPurgeRes {
	return PGPPurgeRes{
		Filenames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Filenames),
	}
}

type PGPSignArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	Source    Stream         `codec:"source" json:"source"`
	Sink      Stream         `codec:"sink" json:"sink"`
	Opts      PGPSignOptions `codec:"opts" json:"opts"`
}

type PGPPullArg struct {
	SessionID   int      `codec:"sessionID" json:"sessionID"`
	UserAsserts []string `codec:"userAsserts" json:"userAsserts"`
}

type PGPEncryptArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Source    Stream            `codec:"source" json:"source"`
	Sink      Stream            `codec:"sink" json:"sink"`
	Opts      PGPEncryptOptions `codec:"opts" json:"opts"`
}

type PGPDecryptArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Source    Stream            `codec:"source" json:"source"`
	Sink      Stream            `codec:"sink" json:"sink"`
	Opts      PGPDecryptOptions `codec:"opts" json:"opts"`
}

type PGPVerifyArg struct {
	SessionID int              `codec:"sessionID" json:"sessionID"`
	Source    Stream           `codec:"source" json:"source"`
	Opts      PGPVerifyOptions `codec:"opts" json:"opts"`
}

type PGPImportArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Key        []byte `codec:"key" json:"key"`
	PushSecret bool   `codec:"pushSecret" json:"pushSecret"`
}

type PGPExportArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Options   PGPQuery `codec:"options" json:"options"`
	Encrypted bool     `codec:"encrypted" json:"encrypted"`
}

type PGPExportByFingerprintArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Options   PGPQuery `codec:"options" json:"options"`
	Encrypted bool     `codec:"encrypted" json:"encrypted"`
}

type PGPExportByKIDArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Options   PGPQuery `codec:"options" json:"options"`
	Encrypted bool     `codec:"encrypted" json:"encrypted"`
}

type PGPKeyGenArg struct {
	SessionID       int           `codec:"sessionID" json:"sessionID"`
	PrimaryBits     int           `codec:"primaryBits" json:"primaryBits"`
	SubkeyBits      int           `codec:"subkeyBits" json:"subkeyBits"`
	CreateUids      PGPCreateUids `codec:"createUids" json:"createUids"`
	AllowMulti      bool          `codec:"allowMulti" json:"allowMulti"`
	DoExport        bool          `codec:"doExport" json:"doExport"`
	ExportEncrypted bool          `codec:"exportEncrypted" json:"exportEncrypted"`
	PushSecret      bool          `codec:"pushSecret" json:"pushSecret"`
}

type PGPKeyGenDefaultArg struct {
	SessionID  int           `codec:"sessionID" json:"sessionID"`
	CreateUids PGPCreateUids `codec:"createUids" json:"createUids"`
}

type PGPDeletePrimaryArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PGPSelectArg struct {
	SessionID        int    `codec:"sessionID" json:"sessionID"`
	FingerprintQuery string `codec:"fingerprintQuery" json:"fingerprintQuery"`
	AllowMulti       bool   `codec:"allowMulti" json:"allowMulti"`
	SkipImport       bool   `codec:"skipImport" json:"skipImport"`
	OnlyImport       bool   `codec:"onlyImport" json:"onlyImport"`
}

type PGPUpdateArg struct {
	SessionID    int      `codec:"sessionID" json:"sessionID"`
	All          bool     `codec:"all" json:"all"`
	Fingerprints []string `codec:"fingerprints" json:"fingerprints"`
}

type PGPPurgeArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	DoPurge   bool `codec:"doPurge" json:"doPurge"`
}

type PGPStorageDismissArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PGPPushPrivateArg struct {
	SessionID    int              `codec:"sessionID" json:"sessionID"`
	Fingerprints []PGPFingerprint `codec:"fingerprints" json:"fingerprints"`
}

type PGPPullPrivateArg struct {
	SessionID    int              `codec:"sessionID" json:"sessionID"`
	Fingerprints []PGPFingerprint `codec:"fingerprints" json:"fingerprints"`
}

type PGPInterface interface {
	PGPSign(context.Context, PGPSignArg) error
	// Download PGP keys for tracked users and update the local GPG keyring.
	// If usernames is nonempty, update only those users.
	PGPPull(context.Context, PGPPullArg) error
	PGPEncrypt(context.Context, PGPEncryptArg) error
	PGPDecrypt(context.Context, PGPDecryptArg) (PGPSigVerification, error)
	PGPVerify(context.Context, PGPVerifyArg) (PGPSigVerification, error)
	PGPImport(context.Context, PGPImportArg) error
	// Exports active PGP keys. Only allows armored export.
	PGPExport(context.Context, PGPExportArg) ([]KeyInfo, error)
	PGPExportByFingerprint(context.Context, PGPExportByFingerprintArg) ([]KeyInfo, error)
	PGPExportByKID(context.Context, PGPExportByKIDArg) ([]KeyInfo, error)
	PGPKeyGen(context.Context, PGPKeyGenArg) error
	PGPKeyGenDefault(context.Context, PGPKeyGenDefaultArg) error
	PGPDeletePrimary(context.Context, int) error
	// Select an existing key and add to Keybase.
	PGPSelect(context.Context, PGPSelectArg) error
	// Push updated key(s) to the server.
	PGPUpdate(context.Context, PGPUpdateArg) error
	PGPPurge(context.Context, PGPPurgeArg) (PGPPurgeRes, error)
	// Dismiss the PGP unlock via secret_store_file notification.
	PGPStorageDismiss(context.Context, int) error
	// push the PGP key that matches the given fingerprints from GnuPG to KBFS. If it is empty, then
	// push all matching PGP keys in the user's sigchain.
	PGPPushPrivate(context.Context, PGPPushPrivateArg) error
	// pull the given PGP keys from KBFS to the local GnuPG keychain. If it is empty, then
	// attempt to pull all matching PGP keys in the user's sigchain.
	PGPPullPrivate(context.Context, PGPPullPrivateArg) error
}

func PGPProtocol(i PGPInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.pgp",
		Methods: map[string]rpc.ServeHandlerDescription{
			"pgpSign": {
				MakeArg: func() interface{} {
					var ret [1]PGPSignArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPSignArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPSignArg)(nil), args)
						return
					}
					err = i.PGPSign(ctx, typedArgs[0])
					return
				},
			},
			"pgpPull": {
				MakeArg: func() interface{} {
					var ret [1]PGPPullArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPPullArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPPullArg)(nil), args)
						return
					}
					err = i.PGPPull(ctx, typedArgs[0])
					return
				},
			},
			"pgpEncrypt": {
				MakeArg: func() interface{} {
					var ret [1]PGPEncryptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPEncryptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPEncryptArg)(nil), args)
						return
					}
					err = i.PGPEncrypt(ctx, typedArgs[0])
					return
				},
			},
			"pgpDecrypt": {
				MakeArg: func() interface{} {
					var ret [1]PGPDecryptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPDecryptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPDecryptArg)(nil), args)
						return
					}
					ret, err = i.PGPDecrypt(ctx, typedArgs[0])
					return
				},
			},
			"pgpVerify": {
				MakeArg: func() interface{} {
					var ret [1]PGPVerifyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPVerifyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPVerifyArg)(nil), args)
						return
					}
					ret, err = i.PGPVerify(ctx, typedArgs[0])
					return
				},
			},
			"pgpImport": {
				MakeArg: func() interface{} {
					var ret [1]PGPImportArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPImportArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPImportArg)(nil), args)
						return
					}
					err = i.PGPImport(ctx, typedArgs[0])
					return
				},
			},
			"pgpExport": {
				MakeArg: func() interface{} {
					var ret [1]PGPExportArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPExportArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPExportArg)(nil), args)
						return
					}
					ret, err = i.PGPExport(ctx, typedArgs[0])
					return
				},
			},
			"pgpExportByFingerprint": {
				MakeArg: func() interface{} {
					var ret [1]PGPExportByFingerprintArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPExportByFingerprintArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPExportByFingerprintArg)(nil), args)
						return
					}
					ret, err = i.PGPExportByFingerprint(ctx, typedArgs[0])
					return
				},
			},
			"pgpExportByKID": {
				MakeArg: func() interface{} {
					var ret [1]PGPExportByKIDArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPExportByKIDArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPExportByKIDArg)(nil), args)
						return
					}
					ret, err = i.PGPExportByKID(ctx, typedArgs[0])
					return
				},
			},
			"pgpKeyGen": {
				MakeArg: func() interface{} {
					var ret [1]PGPKeyGenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPKeyGenArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPKeyGenArg)(nil), args)
						return
					}
					err = i.PGPKeyGen(ctx, typedArgs[0])
					return
				},
			},
			"pgpKeyGenDefault": {
				MakeArg: func() interface{} {
					var ret [1]PGPKeyGenDefaultArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPKeyGenDefaultArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPKeyGenDefaultArg)(nil), args)
						return
					}
					err = i.PGPKeyGenDefault(ctx, typedArgs[0])
					return
				},
			},
			"pgpDeletePrimary": {
				MakeArg: func() interface{} {
					var ret [1]PGPDeletePrimaryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPDeletePrimaryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPDeletePrimaryArg)(nil), args)
						return
					}
					err = i.PGPDeletePrimary(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"pgpSelect": {
				MakeArg: func() interface{} {
					var ret [1]PGPSelectArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPSelectArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPSelectArg)(nil), args)
						return
					}
					err = i.PGPSelect(ctx, typedArgs[0])
					return
				},
			},
			"pgpUpdate": {
				MakeArg: func() interface{} {
					var ret [1]PGPUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPUpdateArg)(nil), args)
						return
					}
					err = i.PGPUpdate(ctx, typedArgs[0])
					return
				},
			},
			"pgpPurge": {
				MakeArg: func() interface{} {
					var ret [1]PGPPurgeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPPurgeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPPurgeArg)(nil), args)
						return
					}
					ret, err = i.PGPPurge(ctx, typedArgs[0])
					return
				},
			},
			"pgpStorageDismiss": {
				MakeArg: func() interface{} {
					var ret [1]PGPStorageDismissArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPStorageDismissArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPStorageDismissArg)(nil), args)
						return
					}
					err = i.PGPStorageDismiss(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"pgpPushPrivate": {
				MakeArg: func() interface{} {
					var ret [1]PGPPushPrivateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPPushPrivateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPPushPrivateArg)(nil), args)
						return
					}
					err = i.PGPPushPrivate(ctx, typedArgs[0])
					return
				},
			},
			"pgpPullPrivate": {
				MakeArg: func() interface{} {
					var ret [1]PGPPullPrivateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PGPPullPrivateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PGPPullPrivateArg)(nil), args)
						return
					}
					err = i.PGPPullPrivate(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type PGPClient struct {
	Cli rpc.GenericClient
}

func (c PGPClient) PGPSign(ctx context.Context, __arg PGPSignArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpSign", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Download PGP keys for tracked users and update the local GPG keyring.
// If usernames is nonempty, update only those users.
func (c PGPClient) PGPPull(ctx context.Context, __arg PGPPullArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpPull", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPEncrypt(ctx context.Context, __arg PGPEncryptArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpEncrypt", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPDecrypt(ctx context.Context, __arg PGPDecryptArg) (res PGPSigVerification, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpDecrypt", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPVerify(ctx context.Context, __arg PGPVerifyArg) (res PGPSigVerification, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpVerify", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPImport(ctx context.Context, __arg PGPImportArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpImport", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Exports active PGP keys. Only allows armored export.
func (c PGPClient) PGPExport(ctx context.Context, __arg PGPExportArg) (res []KeyInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpExport", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPExportByFingerprint(ctx context.Context, __arg PGPExportByFingerprintArg) (res []KeyInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpExportByFingerprint", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPExportByKID(ctx context.Context, __arg PGPExportByKIDArg) (res []KeyInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpExportByKID", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPKeyGen(ctx context.Context, __arg PGPKeyGenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpKeyGen", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPKeyGenDefault(ctx context.Context, __arg PGPKeyGenDefaultArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpKeyGenDefault", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPDeletePrimary(ctx context.Context, sessionID int) (err error) {
	__arg := PGPDeletePrimaryArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpDeletePrimary", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Select an existing key and add to Keybase.
func (c PGPClient) PGPSelect(ctx context.Context, __arg PGPSelectArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpSelect", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Push updated key(s) to the server.
func (c PGPClient) PGPUpdate(ctx context.Context, __arg PGPUpdateArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpUpdate", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PGPClient) PGPPurge(ctx context.Context, __arg PGPPurgeArg) (res PGPPurgeRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpPurge", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Dismiss the PGP unlock via secret_store_file notification.
func (c PGPClient) PGPStorageDismiss(ctx context.Context, sessionID int) (err error) {
	__arg := PGPStorageDismissArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpStorageDismiss", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// push the PGP key that matches the given fingerprints from GnuPG to KBFS. If it is empty, then
// push all matching PGP keys in the user's sigchain.
func (c PGPClient) PGPPushPrivate(ctx context.Context, __arg PGPPushPrivateArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpPushPrivate", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// pull the given PGP keys from KBFS to the local GnuPG keychain. If it is empty, then
// attempt to pull all matching PGP keys in the user's sigchain.
func (c PGPClient) PGPPullPrivate(ctx context.Context, __arg PGPPullPrivateArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpPullPrivate", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
