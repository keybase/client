// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type WotReactArg struct {
	Voucher  keybase1.UserVersion
	Proof    keybase1.SigID
	Reaction keybase1.WotReactionType
}

// WotReact is an engine.
type WotReact struct {
	arg *WotReactArg
	libkb.Contextified
}

// NewWotReact creates a WotReact engine.
func NewWotReact(g *libkb.GlobalContext, arg *WotReactArg) *WotReact {
	return &WotReact{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *WotReact) Name() string {
	return "WotReact"
}

// GetPrereqs returns the engine prereqs.
func (e *WotReact) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *WotReact) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *WotReact) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *WotReact) Run(mctx libkb.MetaContext) error {
	luArg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(e.arg.Voucher.Uid)
	them, err := libkb.LoadUser(luArg)
	if err != nil {
		return err
	}
	if them.GetCurrentEldestSeqno() != e.arg.Voucher.EldestSeqno {
		return errors.New("voucher has reset, make sure you still know them")
	}

	statement := jsonw.NewDictionary()
	if err := statement.SetKey("sig_id", jsonw.NewString(string(e.arg.Proof))); err != nil {
		return err
	}
	reactionType := strings.ToLower(keybase1.WotReactionTypeRevMap[e.arg.Reaction])
	if err := statement.SetKey("reaction", jsonw.NewString(reactionType)); err != nil {
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
		if me.GetUID() == e.arg.Voucher.Uid {
			return libkb.InvalidArgumentError{Msg: "can't react to a vouch from yourself"}
		}
		proof, err := me.WotReactProof(mctx, signingKey, sigVersion, sum)
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
			libkb.LinkTypeWotReact,
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
		Type:       string(libkb.LinkTypeWotReact),
		SeqType:    keybase1.SeqType_PUBLIC,
		SigInner:   string(inner),
		Version:    sigVersion,
		Expansions: expansions,
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{item}

	if _, err := e.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}); err != nil {
		return err
	}

	voucheeUsername := mctx.ActiveDevice().Username(mctx).String()
	mctx.G().NotifyRouter.HandleWebOfTrustChanged(voucheeUsername)
	return libkb.DismissWotNotifications(mctx, them.GetName(), voucheeUsername)
}
