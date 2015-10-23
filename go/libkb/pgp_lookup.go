package libkb

import "fmt"

func PGPLookup(g *GlobalContext, id uint64) (username, uid string, err error) {
	return PGPLookupHex(g, fmt.Sprintf("%016x", id))
}

func PGPLookupHex(g *GlobalContext, hexID string) (username, uid string, err error) {
	var data struct {
		Username string
		UID      string
	}

	// lookup key on api server
	args := APIArg{
		Endpoint: "key/basics",
		Args: HTTPArgs{
			"pgp_key_id": S{Val: hexID},
		},
		Contextified: NewContextified(g),
	}
	if err = g.API.GetDecode(args, &data); err != nil {
		return "", "", err
	}
	return data.Username, data.UID, nil
}
