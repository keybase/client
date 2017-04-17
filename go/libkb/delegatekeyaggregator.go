// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
)

// DelegatorAggregator manages delegating multiple keys in one post to the server

// Run posts an array of delegations to the server. Keeping this simple as we don't need any state (yet)
func DelegatorAggregator(lctx LoginContext, ds []Delegator, sdhBoxes []SharedDHSecretKeyBox) (err error) {
	if len(ds) == 0 {
		return errors.New("Empty delegators to aggregator")
	}

	// Store all the args to build a single big json later
	args := []map[string]string{}

	for i := range ds {
		// Mutate the original and not a copy from range
		var d = &ds[i]

		d.Aggregated = true
		if err := d.Run(lctx); err != nil {
			return err
		}

		flatArgs := d.postArg.flattenHTTPArgs(d.postArg.getHTTPArgs())
		args = append(args, flatArgs)

		if d.DelegationType == DelegationTypeSharedDHKey {
		}
	}

	payload := make(JSONPayload)
	payload["sigs"] = args

	// Post the shared dh key encrypted for each active device.
	if len(sdhBoxes) > 0 {
		payload["shared_dh_secret_boxes"] = sdhBoxes
	}

	// Adopt most parameters from the first item
	var apiArgBase = ds[0]
	var apiArg = apiArgBase.postArg
	apiArg.Args = nil
	apiArg.uArgs = nil
	apiArg.Endpoint = "key/multi"
	apiArg.JSONPayload = payload

	_, err = apiArgBase.G().API.PostJSON(apiArg)
	return err
}

func NewSharedDHSecretBox(innerKey NaclDHKeyPair, receiverKey NaclDHKeyPair, senderKey NaclDHKeyPair, generation SharedDHKeyGeneration) (SharedDHSecretKeyBox, error) {
	_, secret, err := innerKey.ExportPublicAndPrivate()
	if err != nil {
		return SharedDHSecretKeyBox{}, err
	}

	encInfo, err := receiverKey.Encrypt(secret, &senderKey)
	if err != nil {
		return SharedDHSecretKeyBox{}, err
	}
	boxStr, err := PacketArmoredEncode(encInfo)
	if err != nil {
		return SharedDHSecretKeyBox{}, err
	}

	return SharedDHSecretKeyBox{
		Box:         boxStr,
		ReceiverKID: receiverKey.GetKID(),
		Generation:  generation,
	}, nil
}
