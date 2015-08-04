package libkb

import (
	"encoding/json"
	"errors"
	"net/url"
)

// DelegatorAggregator manages delegating multiple keys in one post to the server

// Run posts an array of delegations to the server. Keeping this simple as we don't need any state (yet)
func DelegatorAggregator(lctx LoginContext, ds []Delegator) (err error) {
	if len(ds) == 0 {
		return errors.New("Empty delegators to aggregator")
	}

	// Store all the args to build a single big json later
	args := []url.Values{}

	for i := range ds {
		// Mutate the original and not a copy from range
		var d = &ds[i]

		d.Aggregated = true
		d.Run(lctx)

		args = append(args, d.postArg.getHTTPArgs())
	}

	sigs, err := json.Marshal(args)

	if err != nil {
		return err
	}

	// Adopt most parameters from the first item
	var apiArgBase = ds[0]
	var apiArg = apiArgBase.postArg
	apiArg.Endpoint = "key/multi"

	apiArg.Args = HTTPArgs{
		"sigs": S{Val: string(sigs)},
	}

	_, err = apiArgBase.G().API.Post(apiArg)
	return err
}
