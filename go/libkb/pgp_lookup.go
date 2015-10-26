package libkb

func PGPLookup(g *GlobalContext, id uint64) (username, uid string, err error) {
	return pgpLookup(g, pgpLookupArg{uintID: id})
}

func PGPLookupHex(g *GlobalContext, hexID string) (username, uid string, err error) {
	return pgpLookup(g, pgpLookupArg{hexID: hexID})
}

func PGPLookupFingerprint(g *GlobalContext, fp *PGPFingerprint) (username, uid string, err error) {
	return pgpLookup(g, pgpLookupArg{fp: fp})
}

type pgpLookupArg struct {
	fp     *PGPFingerprint
	hexID  string
	uintID uint64
}

func pgpLookup(g *GlobalContext, arg pgpLookupArg) (username, uid string, err error) {
	httpArgs := make(HTTPArgs)
	switch {
	case arg.fp != nil:
		httpArgs["fingerprint"] = S{arg.fp.String()}
	case len(arg.hexID) > 0:
		httpArgs["pgp_key_id"] = S{Val: arg.hexID}
	case arg.uintID > 0:
		httpArgs["pgp_key_id"] = UHex{Val: arg.uintID}
	default:
		return "", "", InvalidArgumentError{Msg: "invalid pgp lookup arg"}
	}

	var data struct {
		Username string
		UID      string
	}

	// lookup key on api server
	args := APIArg{
		Endpoint:     "key/basics",
		Args:         httpArgs,
		Contextified: NewContextified(g),
	}
	if err = g.API.GetDecode(args, &data); err != nil {
		return "", "", err
	}
	return data.Username, data.UID, nil

}
