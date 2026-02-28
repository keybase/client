// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
)

func PGPLookup(mctx MetaContext, id uint64) (username string, uid keybase1.UID, err error) {
	return keyLookup(mctx, keyLookupArg{uintID: id})
}

func PGPLookupHex(mctx MetaContext, hexID string) (username string, uid keybase1.UID, err error) {
	return keyLookup(mctx, keyLookupArg{hexID: hexID})
}

func PGPLookupFingerprint(mctx MetaContext, fp *PGPFingerprint) (username string, uid keybase1.UID, err error) {
	return keyLookup(mctx, keyLookupArg{fp: fp})
}

func KeyLookupKIDIncludingRevoked(mctx MetaContext, k keybase1.KID) (username string, uid keybase1.UID, err error) {
	return keyLookup(mctx, keyLookupArg{kid: k, includeRevoked: true})
}

func KeyLookupByBoxPublicKey(mctx MetaContext, k saltpack.BoxPublicKey) (username string, uid keybase1.UID, err error) {
	return keyLookup(mctx, keyLookupArg{kid: BoxPublicKeyToKeybaseKID(k)})
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

func keyLookup(mctx MetaContext, arg keyLookupArg) (username string, uid keybase1.UID, err error) {
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

	if err = mctx.G().API.GetDecode(mctx, args, &data); err != nil {
		if ase, ok := err.(AppStatusError); ok && ase.Code == SCKeyNotFound {
			err = NotFoundError{}
		}
		return username, uid, err
	}

	uid, err = keybase1.UIDFromString(data.UID)
	if err != nil {
		return username, uid, err
	}
	return data.Username, uid, nil
}
