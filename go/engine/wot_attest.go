// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type WotAttestArg struct {
	Attestee     keybase1.UserVersion
	Confidence   keybase1.Confidence
	Attestations []string
}

// WotAttest is an engine.
type WotAttest struct {
	arg *WotAttestArg
	libkb.Contextified
}

// NewWotAttest creates a WotAttest engine.
func NewWotAttest(g *libkb.GlobalContext, arg *WotAttestArg) *WotAttest {
	return &WotAttest{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *WotAttest) Name() string {
	return "WotAttest"
}

// GetPrereqs returns the engine prereqs.
func (e *WotAttest) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *WotAttest) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *WotAttest) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *WotAttest) Run(mctx libkb.MetaContext) error {
	luArg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(e.arg.Attestee.Uid)
	them, err := libkb.LoadUser(luArg)
	if err != nil {
		return err
	}

	if them.GetCurrentEldestSeqno() != e.arg.Attestee.EldestSeqno {
		return errors.New("attestee has reset, make sure you still know them")
	}

	statement := jsonw.NewDictionary()
	if err := statement.SetKey("user", them.ToWotStatement()); err != nil {
		return err
	}
	if err := statement.SetKey("attestation", libkb.JsonwStringArray(e.arg.Attestations)); err != nil {
		return err
	}
	if err := statement.SetKey("confidence", e.confidence()); err != nil {
		return err
	}

	attest := jsonw.NewDictionary()
	if err := attest.SetKey("obj", statement); err != nil {
		return err
	}
	randKey, err := libkb.RandBytes(16)
	if err != nil {
		return err
	}
	hexKey := hex.EncodeToString(randKey)
	if err := attest.SetKey("key", jsonw.NewString(hexKey)); err != nil {
		return err
	}

	marshaled, err := statement.Marshal()
	if err != nil {
		return err
	}

	mac := hmac.New(sha256.New, randKey)
	if _, err := mac.Write(marshaled); err != nil {
		return err
	}
	sum := mac.Sum(nil)

	expansions := jsonw.NewDictionary()
	if err := expansions.SetKey(hex.EncodeToString(sum), attest); err != nil {
		return err
	}

	signingKey, err := mctx.G().ActiveDevice.SigningKey()
	if err != nil {
		return err
	}

	sigVersion := libkb.KeybaseSignatureV2
	var inner []byte
	var sig string

	// ForcePoll is required.
	err = mctx.G().GetFullSelfer().WithSelfForcePoll(mctx.Ctx(), func(me *libkb.User) error {
		proof, err := me.WotAttestProof(mctx, signingKey, sigVersion, sum)
		if err != nil {
			return err
		}
		inner, err = proof.J.Marshal()
		if err != nil {
			return err
		}

		sig, _, _, err = libkb.MakeSig(
			mctx,
			signingKey,
			libkb.LinkTypeWotAttest,
			inner,
			libkb.SigHasRevokes(false),
			keybase1.SeqType_PUBLIC,
			libkb.SigIgnoreIfUnsupported(true),
			me,
			sigVersion,
		)

		return err
	})

	if err != nil {
		return err
	}

	item := libkb.SigMultiItem{
		Sig:        sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeWotAttest),
		SeqType:    keybase1.SeqType_PUBLIC,
		SigInner:   string(inner),
		Version:    sigVersion,
		Expansions: expansions,
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{item}

	_, err = e.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	return err
}

func (e *WotAttest) confidence() *jsonw.Wrapper {
	c := jsonw.NewDictionary()
	if e.arg.Confidence.UsernameVerifiedVia != keybase1.UsernameVerificationType_NONE {
		_ = c.SetKey("username_verified_via", jsonw.NewString(strings.ToLower(e.arg.Confidence.UsernameVerifiedVia.String())))
	}
	if len(e.arg.Confidence.VouchedBy) > 0 {
		vb := jsonw.NewArray(len(e.arg.Confidence.VouchedBy))
		for i, username := range e.arg.Confidence.VouchedBy {
			_ = vb.SetIndex(i, jsonw.NewString(libkb.GetUIDByUsername(e.G(), username).String()))
		}
		_ = c.SetKey("vouched_by", vb)
	}
	if e.arg.Confidence.KnownOnKeybaseDays > 0 {
		_ = c.SetKey("known_on_keybase_days", jsonw.NewInt(e.arg.Confidence.KnownOnKeybaseDays))
	}
	if e.arg.Confidence.Other != "" {
		_ = c.SetKey("other", jsonw.NewString(e.arg.Confidence.Other))
	}

	return c
}
