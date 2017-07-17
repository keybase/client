// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
)

func PGPLookup(g *GlobalContext, id uint64) (username string, uid keybase1.UID, err error) {
	return keyLookup(g, keyLookupArg{uintID: id})
}

func PGPLookupHex(g *GlobalContext, hexID string) (username string, uid keybase1.UID, err error) {
	return keyLookup(g, keyLookupArg{hexID: hexID})
}

func PGPLookupFingerprint(g *GlobalContext, fp *PGPFingerprint) (username string, uid keybase1.UID, err error) {
	return keyLookup(g, keyLookupArg{fp: fp})
}

func KeyLookupKIDIncludingRevoked(g *GlobalContext, k keybase1.KID) (username string, uid keybase1.UID, err error) {
	return keyLookup(g, keyLookupArg{kid: k, includeRevoked: true})
}

func KeyLookupByBoxPublicKey(g *GlobalContext, k saltpack.BoxPublicKey) (username string, uid keybase1.UID, err error) {
	return keyLookup(g, keyLookupArg{kid: BoxPublicKeyToKeybaseKID(k)})
}

type keyLookupArg struct {
	fp             *PGPFingerprint
	hexID          string
	uintID         uint64
	kid            keybase1.KID
	includeRevoked bool
}

type keyBasicsReply struct {
	Status   AppStatus `json:"status"`
	Username string    `json:"username"`
	UID      string    `json:"uid"`
}

func (k *keyBasicsReply) GetAppStatus() *AppStatus {
	return &k.Status
}

func keyLookup(g *GlobalContext, arg keyLookupArg) (username string, uid keybase1.UID, err error) {
	httpArgs := make(HTTPArgs)
	httpArgs["include_revoked"] = B{Val: arg.includeRevoked}
	switch {
	case arg.fp != nil:
		httpArgs["fingerprint"] = S{arg.fp.String()}
	case len(arg.hexID) > 0:
		httpArgs["pgp_key_id"] = S{Val: arg.hexID}
	case arg.uintID > 0:
		httpArgs["pgp_key_id"] = UHex{Val: arg.uintID}
	case !arg.kid.IsNil():
		httpArgs["kid"] = S{Val: arg.kid.String()}
	default:
		return username, uid, InvalidArgumentError{Msg: "invalid pgp lookup arg"}
	}

	var data keyBasicsReply

	// lookup key on api server
	args := APIArg{
		Endpoint: "key/basics",
		Args:     httpArgs,
	}

	if err = g.API.GetDecode(args, &data); err != nil {
		if ase, ok := err.(AppStatusError); ok && ase.Code == SCKeyNotFound {
			err = NotFoundError{}
		}
		return username, uid, err
	}

	uid, err = keybase1.UIDFromString(data.UID)
	return data.Username, uid, nil
}
