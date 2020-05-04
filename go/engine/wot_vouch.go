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
	VouchText  string
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

func getSigIDToRevoke(mctx libkb.MetaContext, vouchee *libkb.User) (toRevoke *keybase1.SigID, err error) {
	voucherUsername := mctx.ActiveDevice().Username(mctx).String()
	vouches, err := libkb.FetchWotVouches(mctx, libkb.FetchWotVouchesArg{Voucher: voucherUsername, Vouchee: vouchee.GetName()})
	if err != nil {
		return nil, err
	}
	var unrevokedVouches []keybase1.WotVouch
	for _, vouch := range vouches {
		if vouch.Status != keybase1.WotStatusType_REVOKED {
			unrevokedVouches = append(unrevokedVouches, vouch)
		}
	}
	switch {
	case len(unrevokedVouches) > 1:
		return nil, fmt.Errorf("there should be at most one existing vouch to revoke, but there are %d", len(unrevokedVouches))
	case len(unrevokedVouches) == 1:
		return &unrevokedVouches[0].VouchProof, nil
	default:
		return nil, nil
	}
}

// Run starts the engine.
func (e *WotVouch) Run(mctx libkb.MetaContext) error {
	ctx := mctx.Ctx()
	g := mctx.G()
	luArg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(e.arg.Vouchee.Uid).WithStubMode(libkb.StubModeUnstubbed)
	them, err := libkb.LoadUser(luArg)
	if err != nil {
		return err
	}

	if them.GetCurrentEldestSeqno() != e.arg.Vouchee.EldestSeqno {
		mctx.Debug("eldest seqno mismatch: loaded %v != %v caller", them.GetCurrentEldestSeqno(), e.arg.Vouchee.EldestSeqno)
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
	confidenceJw, err := jsonw.WrapperFromObject(e.arg.Confidence)
	if err != nil {
		return err
	}
	if err := statement.SetKey("confidence", confidenceJw); err != nil {
		return err
	}
	if err := statement.SetKey("vouch_text", jsonw.NewString(e.arg.VouchText)); err != nil {
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

	sigIDToRevoke, err := getSigIDToRevoke(mctx, them)
	if err != nil {
		return err
	}
	var lease *libkb.Lease
	var merkleRoot *libkb.MerkleRoot
	if sigIDToRevoke != nil {
		lease, merkleRoot, err = libkb.RequestDowngradeLeaseBySigIDs(ctx, g, []keybase1.SigID{*sigIDToRevoke})
		if err != nil {
			return err
		}
		defer func() {
			// not sure if this is necessary or not
			err := libkb.CancelDowngradeLease(ctx, g, lease.LeaseID)
			if err != nil {
				g.Log.CWarningf(ctx, "Failed to cancel downgrade lease: %s", err.Error())
			}
		}()
	}

	sigVersion := libkb.KeybaseSignatureV2
	var inner []byte
	var sig string

	// ForcePoll is required.
	var proof *libkb.ProofMetadataRes
	var linkID libkb.LinkID
	err = mctx.G().GetFullSelfer().WithSelfForcePoll(ctx, func(me *libkb.User) (err error) {
		if me.GetUID() == e.arg.Vouchee.Uid {
			return libkb.InvalidArgumentError{Msg: "can't vouch for yourself"}
		}
		proof, err = me.WotVouchProof(mctx, signingKey, sigVersion, sum, merkleRoot, sigIDToRevoke)
		if err != nil {
			return err
		}
		inner, err = proof.J.Marshal()
		if err != nil {
			return err
		}
		sig, _, linkID, err = libkb.MakeSig(
			mctx,
			signingKey,
			libkb.LinkTypeWotVouch,
			inner,
			libkb.SigHasRevokes(sigIDToRevoke != nil),
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
	if lease != nil {
		payload["downgrade_lease_id"] = lease.LeaseID
	}
	if _, err := e.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}); err != nil {
		return err
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(mctx))
	if err != nil {
		return err
	}
	err = libkb.MerkleCheckPostedUserSig(mctx, me.GetUID(), proof.Seqno, linkID)
	if err != nil {
		return err
	}

	voucherUsername := mctx.ActiveDevice().Username(mctx).String()
	mctx.G().NotifyRouter.HandleWebOfTrustChanged(voucherUsername)
	return libkb.DismissWotNotifications(mctx, voucherUsername, them.GetName())
}
