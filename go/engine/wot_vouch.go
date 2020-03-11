// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type WotVouchArg struct {
	Vouchee    keybase1.UserVersion
	Confidence keybase1.Confidence
	VouchTexts []string
}

// WotVouch is an engine.
type WotVouch struct {
	arg *WotVouchArg
	libkb.Contextified
}

// NewWotVouch creates a WotVouch engine.
func NewWotVouch(g *libkb.GlobalContext, arg *WotVouchArg) *WotVouch {
	return &WotVouch{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *WotVouch) Name() string {
	return "WotVouch"
}

// GetPrereqs returns the engine prereqs.
func (e *WotVouch) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *WotVouch) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *WotVouch) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *WotVouch) Run(mctx libkb.MetaContext) error {
	luArg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(e.arg.Vouchee.Uid).WithStubMode(libkb.StubModeUnstubbed)
	them, err := libkb.LoadUser(luArg)
	if err != nil {
		return err
	}

	if them.GetCurrentEldestSeqno() != e.arg.Vouchee.EldestSeqno {
		return errors.New("vouchee has reset, make sure you still know them")
	}

	if e.arg.Confidence.UsernameVerifiedVia == "" {
		return errors.New("missing UsernameVerifiedVia")
	}
	if _, found := keybase1.UsernameVerificationTypeMap[string(e.arg.Confidence.UsernameVerifiedVia)]; !found {
		return fmt.Errorf("unrecognized UsernameVerificationTypeMap value '%v'", e.arg.Confidence.UsernameVerifiedVia)
	}

	if e.arg.Confidence.UsernameVerifiedVia == keybase1.UsernameVerificationType_PROOFS {
		if len(e.arg.Confidence.Proofs) == 0 {
			return errors.New("vouching with proofs requires proofs list")
		}
	} else {
		if len(e.arg.Confidence.Proofs) > 0 {
			return errors.New("vouching with proof list requires proof type")
		}
	}

	statement := jsonw.NewDictionary()
	if err := statement.SetKey("user", them.ToWotStatement()); err != nil {
		return err
	}
	if err := statement.SetKey("vouch_text", libkb.JsonwStringArray(e.arg.VouchTexts)); err != nil {
		return err
	}
	confidenceJw, err := jsonw.WrapperFromObject(e.arg.Confidence)
	if err != nil {
		return err
	}
	if err := statement.SetKey("confidence", confidenceJw); err != nil {
		return err
	}
	expansions, sum, err := libkb.EmbedExpansionObj(statement)
	if err != nil {
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
		if me.GetUID() == e.arg.Vouchee.Uid {
			return libkb.InvalidArgumentError{Msg: "can't vouch for yourself"}
		}
		proof, err := me.WotVouchProof(mctx, signingKey, sigVersion, sum)
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
			libkb.LinkTypeWotVouch,
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
		Type:       string(libkb.LinkTypeWotVouch),
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
