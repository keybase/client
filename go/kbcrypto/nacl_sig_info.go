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

var _ Packetable = (*NaclSigInfo)(nil)

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
	// XXX - NOTE(maxtaco) - 20190418 - this is not to be confused with Cause(), which interacts with the pkg/errors
	// system. There should probably be a better solution than this, but let's leave it for now.
	Cause error
}

func newVerificationErrorWithString(s string) VerificationError {
	return VerificationError{Cause: errors.New(s)}
}

func NewVerificationError(e error) VerificationError {
	return VerificationError{Cause: e}
}

func (e VerificationError) Error() string {
	if e.Cause == nil {
		return "Verification failed"
	}
	return fmt.Sprintf("Verification failed: %s", e.Cause.Error())
}

func (e VerificationError) ToStatus() keybase1.Status {
	cause := ""
	if e.Cause != nil {
		cause = e.Cause.Error()
	}
	return keybase1.Status{
		Code: SCSigCannotVerify,
		Name: "SC_SIG_CANNOT_VERIFY",
		Fields: []keybase1.StringKVPair{
			{Key: "Cause", Value: cause},
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
	return s.verifyWithPayload(s.Payload, false)
}

// verifyWithPayload verifies the NaclSigInfo s, with the payload payload. Note that
// s may or may not have a payload already baked into it. If it does, and checkPayloadEquality
// is true, then we assert that the "baked-in" payload is equal to the specified payload.
// We'll only pass `false` for this flag from just above, to avoid checking that s.Payload == s.Payload,
// which we know it does. We need this unfortunate complexity because some signatures the client
// tries to verify are "attached," meaning the payload comes along with the sig info. And in other
// cases, the signatures are "detached", meaning they are supplied out-of-band. This function
// handles both cases.
func (s NaclSigInfo) verifyWithPayload(payload []byte, checkPayloadEquality bool) (*NaclSigningKeyPublic, error) {
	key := KIDToNaclSigningKeyPublic(s.Kid)
	if key == nil {
		return nil, BadKeyError{}
	}
	if payload == nil {
		return nil, newVerificationErrorWithString("nil payload")
	}
	if len(payload) == 0 {
		return nil, newVerificationErrorWithString("empty payload")
	}

	if checkPayloadEquality && s.Payload != nil && !SecureByteArrayEq(payload, s.Payload) {
		return nil, newVerificationErrorWithString("payload mismatch")
	}

	switch s.Version {
	case 0, 1:
		if !key.Verify(payload, s.Sig) {
			return nil, newVerificationErrorWithString("verify failed")
		}
	case 2:
		if !s.Prefix.IsWhitelisted() {
			return nil, newVerificationErrorWithString("unknown prefix")
		}
		if !key.Verify(s.Prefix.Prefix(payload), s.Sig) {
			return nil, newVerificationErrorWithString("verify failed")
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

func NaclVerifyWithPayload(sig string, payloadIn []byte) (nk *NaclSigningKeyPublic, fullBody []byte, err error) {
	fullBody, err = base64.StdEncoding.DecodeString(sig)
	if err != nil {
		return nil, nil, err
	}

	naclSig, err := DecodeNaclSigInfoPacket(fullBody)
	if err != nil {
		return nil, nil, err
	}

	nk, err = naclSig.verifyWithPayload(payloadIn, true)
	if err != nil {
		return nil, nil, err
	}

	return nk, fullBody, nil
}

func (s NaclSigInfo) SigID() (ret keybase1.SigIDBase, err error) {
	var body []byte
	body, err = EncodePacketToBytes(&s)
	if err != nil {
		return "", err
	}
	return ComputeSigIDFromSigBody(body), nil
}
