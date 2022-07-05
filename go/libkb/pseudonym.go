// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/keybase/go-codec/codec"

	context "golang.org/x/net/context"
)

// TLFPseudonym is an identifier for a key in a tlf
type TlfPseudonym [32]byte

type KeyGen int
type tlfID [16]byte

const tlfPseudonymVersion = 1

// TlfPseudonymInfo is what a pseudonym represents
type TlfPseudonymInfo struct {
	// TLF name like: /keybase/private/a,b
	Name string
	// TLF id
	ID      tlfID
	KeyGen  KeyGen
	HmacKey [32]byte
}

// The server returns the current full name of the TLF, in addition to the TlfPseudonymInfo above.
type TlfPseudonymServerInfo struct {
	TlfPseudonymInfo

	// Using untrusted data during decryption is safe because we don't rely on
	// TLF keys for sender authenticity. (Note however that senders must not
	// use untrusted keys, or else they'd lose all privacy.)
	UntrustedCurrentName string
}

func (t TlfPseudonym) String() string {
	return hex.EncodeToString(t[:])
}

func (t TlfPseudonym) Eq(r TlfPseudonym) bool {
	return hmac.Equal(t[:], r[:])
}

// tlfPseudonymReq is what the server needs to store a pseudonym
type tlfPseudonymReq struct {
	Pseudonym string `json:"tlf_pseudonym"` // hex
	Name      string `json:"tlf_name"`
	ID        string `json:"tlf_id"` // hex
	KeyGen    int    `json:"tlf_key_gen"`
	HmacKey   string `json:"hmac_key"` // hex
}

// tlfPseudonymContents is the data packed inside the HMAC
type tlfPseudonymContents struct {
	_struct bool `codec:",toarray"` //nolint
	Version int
	Name    string
	ID      tlfID
	KeyGen  KeyGen
}

type getTlfPseudonymsRes struct {
	TlfPseudonyms []getTlfPseudonymRes `json:"tlf_pseudonyms"`
	Status        AppStatus            `json:"status"`
}

func (r *getTlfPseudonymsRes) GetAppStatus() *AppStatus {
	return &r.Status
}

type getTlfPseudonymRes struct {
	Err  *PseudonymGetError `json:"err"`
	Info *struct {
		Name                 string `json:"tlf_name"`
		UntrustedCurrentName string `json:"untrusted_current_name"`
		ID                   string `json:"tlf_id"` // hex
		KeyGen               int    `json:"tlf_key_gen"`
		HmacKey              string `json:"hmac_key"` // hex
	} `json:"info"`
}

type GetTlfPseudonymEither struct {
	// Exactly one of these 2 fields is nil.
	Err  error
	Info *TlfPseudonymServerInfo
}

// MakePseudonym makes a TLF pseudonym from the given input.
func MakePseudonym(info TlfPseudonymInfo) (TlfPseudonym, error) {
	input := tlfPseudonymContents{
		Version: tlfPseudonymVersion,
		Name:    info.Name,
		ID:      info.ID,
		KeyGen:  info.KeyGen,
	}
	mh := codec.MsgpackHandle{WriteExt: true}
	var buf []byte
	enc := codec.NewEncoderBytes(&buf, &mh)
	err := enc.Encode(input)
	if err != nil {
		return [32]byte{}, err
	}
	mac := hmac.New(sha256.New, info.HmacKey[:])
	_, err = mac.Write(buf)
	if err != nil {
		return [32]byte{}, err
	}
	hmac := MakeByte32(mac.Sum(nil))
	return hmac, nil
}

func PostTlfPseudonyms(ctx context.Context, g *GlobalContext, pnymInfos []TlfPseudonymInfo) ([]TlfPseudonym, error) {
	var pnymReqs []tlfPseudonymReq
	var pnyms []TlfPseudonym
	for _, info := range pnymInfos {
		// Compute the pseudonym
		pn, err := MakePseudonym(info)
		if err != nil {
			return nil, err
		}
		pnyms = append(pnyms, pn)
		pnymReqs = append(pnymReqs, tlfPseudonymReq{
			Pseudonym: pn.String(),
			Name:      info.Name,
			ID:        hex.EncodeToString(info.ID[:]),
			KeyGen:    int(info.KeyGen),
			HmacKey:   hex.EncodeToString(info.HmacKey[:]),
		})
	}

	payload := make(JSONPayload)
	payload["tlf_pseudonyms"] = pnymReqs
	mctx := NewMetaContext(ctx, g)

	_, err := g.API.PostJSON(mctx, APIArg{
		Endpoint:    "kbfs/pseudonym/put",
		JSONPayload: payload,
		SessionType: APISessionTypeREQUIRED,
	})
	if err != nil {
		return nil, err
	}
	return pnyms, nil
}

// GetTlfPseudonyms fetches info for a list of pseudonyms.
// The output structs are returned in the order corresponding to the inputs.
// The top-level error is filled if the entire request fails.
// The each-struct errors may be filled for per-pseudonym errors.
func GetTlfPseudonyms(ctx context.Context, g *GlobalContext, pnyms []TlfPseudonym) ([]GetTlfPseudonymEither, error) {
	var pnymStrings []string
	for _, x := range pnyms {
		pnymStrings = append(pnymStrings, x.String())
	}

	payload := make(JSONPayload)
	payload["tlf_pseudonyms"] = pnymStrings

	var res getTlfPseudonymsRes
	mctx := NewMetaContext(ctx, g)
	err := g.API.PostDecode(mctx,
		APIArg{
			Endpoint:    "kbfs/pseudonym/get",
			SessionType: APISessionTypeREQUIRED,
			JSONPayload: payload,
		},
		&res)
	if err != nil {
		return nil, err
	}

	// Validate the response
	if len(res.TlfPseudonyms) != len(pnyms) {
		return nil, &PseudonymGetError{fmt.Sprintf("invalid server response for pseudonym get: len %v != %v",
			len(res.TlfPseudonyms), len(pnyms))}
	}
	var resList []GetTlfPseudonymEither
	for i, received := range res.TlfPseudonyms {
		resList = append(resList, checkAndConvertTlfPseudonymFromServer(ctx, g, pnyms[i], received))
	}

	return resList, nil
}

func checkAndConvertTlfPseudonymFromServer(ctx context.Context, g *GlobalContext, req TlfPseudonym, received getTlfPseudonymRes) GetTlfPseudonymEither {
	mkErr := func(err error) GetTlfPseudonymEither {
		return GetTlfPseudonymEither{
			Info: nil,
			Err:  err,
		}
	}

	x := GetTlfPseudonymEither{}

	// This check is necessary because of sneaky typed nil.
	// received.Err's type is lower than x.Err
	// So doing `x.Err = received.Err` is bad if received.Err is nil.
	// https://golang.org/doc/faq#nil_error
	// https://play.golang.org/p/BnjVTGh-gO
	if received.Err != nil {
		x.Err = received.Err
	}

	if received.Info != nil {
		info := TlfPseudonymServerInfo{}

		info.Name = received.Info.Name
		info.UntrustedCurrentName = received.Info.UntrustedCurrentName

		err := DecodeHexFixed(info.ID[:], []byte(received.Info.ID))
		if err != nil {
			return mkErr(err)
		}

		info.KeyGen = KeyGen(received.Info.KeyGen)

		err = DecodeHexFixed(info.HmacKey[:], []byte(received.Info.HmacKey))
		if err != nil {
			return mkErr(err)
		}

		x.Info = &info
	}

	err := checkTlfPseudonymFromServer(ctx, g, req, x)
	if err != nil {
		return mkErr(err)
	}
	return x
}

func checkTlfPseudonymFromServer(ctx context.Context, g *GlobalContext, req TlfPseudonym, received GetTlfPseudonymEither) error {
	// Exactly one of Info and Err should exist
	if (received.Info == nil) == (received.Err == nil) {
		return &PseudonymGetError{fmt.Sprintf("invalid server response for pseudonym get: %s", req)}
	}

	// Errors don't need validation
	if received.Info == nil {
		return nil
	}

	// Check that the pseudonym info matches the query.
	pn, err := MakePseudonym(received.Info.TlfPseudonymInfo)
	if err != nil {
		// Error creating pseudonym locally
		return &PseudonymGetError{err.Error()}
	}
	if !req.Eq(pn) {
		return &PseudonymGetError{fmt.Sprintf("returned data does not match pseudonym: %s != %s",
			req, pn)}
	}

	return nil
}

func RandomHmacKey() [32]byte {
	slice, err := RandBytes(32)
	if err != nil {
		panic(err)
	}
	return MakeByte32(slice)
}
