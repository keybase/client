// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

// DelegatorAggregator manages delegating multiple keys in one post to the
// server When run produces a map which goes into the 'key/multi' 'sigs' list.
type AggSigProducer func() (JSONPayload, keybase1.Seqno, LinkID, error)

// Run posts an array of delegations to the server. Keeping this simple as we
// don't need any state (yet) `extra` is optional and adds an extra sig,
// produced by something other than a Delegator, after the others.
func DelegatorAggregator(m MetaContext, ds []Delegator, extra AggSigProducer,
	pukBoxes []keybase1.PerUserKeyBox, pukPrev *PerUserKeyPrev, userEKReboxArg *keybase1.UserEkReboxArg) (err error) {
	if len(ds) == 0 {
		return errors.New("Empty delegators to aggregator")
	}

	// Store all the args to build a single big json later
	var args []JSONPayload
	var uid keybase1.UID
	var lastSeqno keybase1.Seqno
	var lastLinkID LinkID

	for i := range ds {
		// Mutate the original and not a copy from range
		var d = &ds[i]

		d.Aggregated = true
		if err := d.Run(m); err != nil {
			return err
		}

		flatArgs := d.postArg.flattenHTTPArgs(d.postArg.getHTTPArgs())
		args = append(args, convertStringMapToJSONPayload(flatArgs))
		if uid.IsNil() && d.Me != nil {
			uid = d.Me.GetUID()
		}
		lastSeqno = d.proof.Seqno
		lastLinkID = d.linkID
	}

	if extra != nil {
		x, seqno, linkID, err := extra()
		if err != nil {
			return err
		}
		args = append(args, x)
		lastSeqno = seqno
		lastLinkID = linkID
	}

	payload := make(JSONPayload)
	payload["sigs"] = args

	if len(pukBoxes) > 0 {
		AddPerUserKeyServerArg(payload, pukBoxes[0].Generation, pukBoxes, pukPrev)
	} else if pukPrev != nil {
		return errors.New("cannot delegate per-user-key with prev but no boxes")
	}
	AddUserEKReBoxServerArg(payload, userEKReboxArg)

	// Adopt most parameters from the first item
	var apiArgBase = ds[0]
	var apiArg = apiArgBase.postArg
	apiArg.Args = nil
	apiArg.uArgs = nil
	apiArg.Endpoint = "key/multi"
	apiArg.JSONPayload = payload
	// It's bad to fail provisioning especially after signup.
	apiArg.InitialTimeout = 5 * time.Minute
	apiArg.RetryCount = 10

	_, err = m.G().API.PostJSON(m, apiArg)
	if err != nil {
		return err
	}
	return MerkleCheckPostedUserSig(m, uid, lastSeqno, lastLinkID)
}

// Make the "per_user_key" section of an API arg.
// Requires one or more `pukBoxes`
// `pukPrev` is optional.
// Modifies `serverArg`.
func AddPerUserKeyServerArg(serverArg JSONPayload, generation keybase1.PerUserKeyGeneration,
	pukBoxes []keybase1.PerUserKeyBox, pukPrev *PerUserKeyPrev) {
	section := make(JSONPayload)
	section["boxes"] = pukBoxes
	section["generation"] = generation
	if pukPrev != nil {
		section["prev"] = *pukPrev
	}
	serverArg["per_user_key"] = section
}

// Make the "user_ek_rebox" and "device_eks" section of an API arg.  Modifies
// `serverArg` unless arg is nil.
func AddUserEKReBoxServerArg(serverArg JSONPayload, arg *keybase1.UserEkReboxArg) {
	if arg == nil {
		return
	}
	serverArg["device_eks"] = map[string]string{string(arg.DeviceID): arg.DeviceEkStatementSig}
	serverArg["user_ek_rebox"] = arg.UserEkBoxMetadata
}

func convertStringMapToJSONPayload(in map[string]string) JSONPayload {
	out := make(JSONPayload)
	for k, v := range in {
		out[k] = v
	}
	return out
}
