// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/keybase/client/go/kbcrypto"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/armor"
	jsonw "github.com/keybase/go-jsonw"
)

func GetSigID(w *jsonw.Wrapper, suffix bool) (keybase1.SigID, error) {
	s, err := w.GetString()
	if err != nil {
		return "", err
	}
	return keybase1.SigIDFromString(s, suffix)
}

type ParsedSig struct {
	Block       *armor.Block
	SigBody     []byte
	MD          *openpgp.MessageDetails
	LiteralData []byte
}

func PGPOpenSig(armored string) (ps *ParsedSig, err error) {
	pso := ParsedSig{}
	pso.Block, err = armor.Decode(strings.NewReader(cleanPGPInput(armored)))
	if err != nil {
		return
	}
	pso.SigBody, err = ioutil.ReadAll(pso.Block.Body)
	if err != nil {
		return
	}
	ps = &pso
	return
}

// OpenSig takes an armored PGP or Keybase signature and opens
// the armor.  It will return the body of the signature, the
// sigID of the body, or an error if it didn't work out.
func OpenSig(armored string) (ret []byte, id keybase1.SigID, err error) {
	if isPGPBundle(armored) {
		var ps *ParsedSig
		if ps, err = PGPOpenSig(armored); err == nil {
			ret = ps.SigBody
			id = ps.ID()
		}
	} else {
		if ret, err = KbOpenSig(armored); err == nil {
			id = kbcrypto.ComputeSigIDFromSigBody(ret)
		}
	}
	return
}

// SigExtractPayloadAndKID extracts the payload and KID of the key that
// was supposedly used to sign this message. A KID will only be returned
// for KB messages, and not for PGP messages
func SigExtractPayloadAndKID(armored string) (payload []byte, kid keybase1.KID, sigID keybase1.SigID, err error) {
	if isPGPBundle(armored) {
		payload, sigID, err = SigExtractPGPPayload(armored)
	} else {
		payload, kid, sigID, err = SigExtractKbPayloadAndKID(armored)
	}
	return payload, kid, sigID, err
}

func SigAssertPayload(armored string, expected []byte) (sigID keybase1.SigID, err error) {
	if isPGPBundle(armored) {
		return SigAssertPGPPayload(armored, expected)
	}
	return SigAssertKbPayload(armored, expected)
}

func SigAssertPGPPayload(armored string, expected []byte) (sigID keybase1.SigID, err error) {
	var ps *ParsedSig
	ps, err = PGPOpenSig(armored)
	if err != nil {
		return
	}
	if err = ps.AssertPayload(expected); err != nil {
		ps = nil
		return
	}
	sigID = ps.ID()
	return
}

func SigExtractPGPPayload(armored string) (payload []byte, sigID keybase1.SigID, err error) {
	var ps *ParsedSig
	ps, err = PGPOpenSig(armored)
	if err != nil {
		return nil, sigID, err
	}
	payload, err = ps.ExtractPayload()
	if err != nil {
		return nil, sigID, err
	}
	return payload, ps.ID(), nil
}

func (ps *ParsedSig) ExtractPayload() (payload []byte, err error) {

	ring := EmptyKeyRing{}
	md, err := openpgp.ReadMessage(bytes.NewReader(ps.SigBody), ring, nil, nil)
	if err != nil {
		return nil, err
	}
	data, err := ioutil.ReadAll(md.UnverifiedBody)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (ps *ParsedSig) AssertPayload(expected []byte) error {

	data, err := ps.ExtractPayload()
	if err != nil {
		return err
	}

	if !FastByteArrayEq(data, expected) {
		err = fmt.Errorf("Signature did not contain expected text")
		return err
	}
	return nil
}

func (ps *ParsedSig) Verify(k PGPKeyBundle) (err error) {
	ps.MD, err = openpgp.ReadMessage(bytes.NewReader(ps.SigBody), k, nil, nil)
	if err != nil {
		return
	}
	if !ps.MD.IsSigned || ps.MD.SignedBy == nil {
		err = fmt.Errorf("Message wasn't signed")
		return
	}
	if !k.MatchesKey(ps.MD.SignedBy) {
		err = fmt.Errorf("Got wrong SignedBy key %v",
			hex.EncodeToString(ps.MD.SignedBy.PublicKey.Fingerprint[:]))
		return
	}
	if ps.MD.UnverifiedBody == nil {
		err = fmt.Errorf("no signed material found")
		return
	}

	ps.LiteralData, err = ioutil.ReadAll(ps.MD.UnverifiedBody)
	if err != nil {
		return
	}

	// We'll see a sig error here after reading in the UnverifiedBody above,
	// if there was one to see.
	if err = ps.MD.SignatureError; err != nil {
		return
	}

	if ps.MD.Signature == nil && ps.MD.SignatureV3 == nil {
		err = fmt.Errorf("No available signature after checking signature")
		return
	}

	// Hopefully by here we've covered all of our bases.
	return nil
}

func (ps *ParsedSig) ID() keybase1.SigID {
	return kbcrypto.ComputeSigIDFromSigBody(ps.SigBody)
}
