// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/pgp.avdl

package keybase1

import (
	"fmt"
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
}

func (o PGPSigVerification) DeepCopy() PGPSigVerification {
	return PGPSigVerification{
		IsSigned: o.IsSigned,
		Verified: o.Verified,
		Signer:   o.Signer.DeepCopy(),
		SignKey:  o.SignKey.DeepCopy(),
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
