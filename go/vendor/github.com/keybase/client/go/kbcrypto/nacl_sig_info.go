// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"encoding/base64"
	"errors"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type NaclSigInfo struct {
	Kid      keybase1.BinaryKID `codec:"key"`
	Payload  []byte             `codec:"payload,omitempty"`
	Sig      NaclSignature      `codec:"sig"`
	SigType  AlgoType           `codec:"sig_type"`
	HashType HashType           `codec:"hash_type"`
	Detached bool               `codec:"detached"`
	Version  int                `codec:"version,omitempty"`
	Prefix   SignaturePrefix    `codec:"prefix,omitempty"`
}

func (s *NaclSigInfo) GetTagAndVersion() (PacketTag, PacketVersion) {
	return TagSignature, KeybasePacketV1
}

type BadKeyError struct {
	Msg string
}

func (p BadKeyError) Error() string {
	msg := "Bad key found"
	if len(p.Msg) != 0 {
		msg = msg + ": " + p.Msg
	}
	return msg
}

type VerificationError struct {
	Cause error
}

const (
	SCSigCannotVerify = int(keybase1.StatusCode_SCSigCannotVerify)
)

func (e VerificationError) Error() string {
	if e.Cause == nil {
		return "Verification failed"
	}
	return fmt.Sprintf("Verification failed: %v", e.Cause)
}

func (e VerificationError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCSigCannotVerify,
		Name: "SC_SIG_CANNOT_VERIFY",
		Fields: []keybase1.StringKVPair{
			{Key: "Cause", Value: e.Cause.Error()},
		},
	}
}

type UnhandledSignatureError struct {
	version int
}

func (e UnhandledSignatureError) Error() string {
	return fmt.Sprintf("unhandled signature version: %d", e.version)
}

func (s NaclSigInfo) Verify() (*NaclSigningKeyPublic, error) {
	key := KIDToNaclSigningKeyPublic(s.Kid)
	if key == nil {
		return nil, BadKeyError{}
	}

	switch s.Version {
	case 0, 1:
		if !key.Verify(s.Payload, s.Sig) {
			return nil, VerificationError{}
		}
	case 2:
		if !s.Prefix.IsWhitelisted() {
			return nil, VerificationError{errors.New("unknown prefix")}
		}
		if !key.Verify(s.Prefix.Prefix(s.Payload), s.Sig) {
			return nil, VerificationError{}
		}
	default:
		return nil, UnhandledSignatureError{s.Version}
	}

	return key, nil
}

func (s *NaclSigInfo) ArmoredEncode() (ret string, err error) {
	return EncodePacketToArmoredString(s)
}

func DecodeNaclSigInfoPacket(data []byte) (NaclSigInfo, error) {
	var info NaclSigInfo
	err := DecodePacketFromBytes(data, &info)
	if err != nil {
		return NaclSigInfo{}, err
	}
	return info, nil
}

func DecodeArmoredNaclSigInfoPacket(s string) (NaclSigInfo, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return NaclSigInfo{}, err
	}
	return DecodeNaclSigInfoPacket(b)
}

// NaclVerifyAndExtract interprets the given string as a NaCl-signed messaged, in
// the keybase NaclSigInfo (v1) format. It will check that the signature verified, and if so,
// will return the public key that was used for the verification, the payload of the signature,
// the full body of the decoded SignInfo, and an error
func NaclVerifyAndExtract(s string) (nk *NaclSigningKeyPublic, payload []byte, fullBody []byte, err error) {
	fullBody, err = base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, nil, nil, err
	}

	naclSig, err := DecodeNaclSigInfoPacket(fullBody)
	if err != nil {
		return nil, nil, nil, err
	}

	nk, err = naclSig.Verify()
	if err != nil {
		return nil, nil, nil, err
	}

	payload = naclSig.Payload
	return nk, payload, fullBody, nil
}
