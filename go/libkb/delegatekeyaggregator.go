// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import "errors"

// DelegatorAggregator manages delegating multiple keys in one post to the server

// Run posts an array of delegations to the server. Keeping this simple as we don't need any state (yet)
func DelegatorAggregator(lctx LoginContext, ds []Delegator) (err error) {
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
	}

	payload := make(JSONPayload)
	payload["sigs"] = args

	// XXX what's the purpose of this?
	if err != nil {
		return err
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
