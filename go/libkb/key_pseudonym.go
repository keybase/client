// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

// KeyPseudonym is a "random looking" identifier which refers to a specific application key belonging to a user or team
// (the key is referred to by the application id, the generation number and the user or team id).
// Pseudonyms are only used for saltpack encryption at the moment, but more applications are possible. They are used
// to avoid that, when decrypting a message encrypted with a team key, a user has to loop through all the keys of all the
// teams he is part of to find the right one. To avoid this, when encrypting for a team, the sender generates such a pseudonym
// (which refers to the key it used to encrypt), sends it to the server and includes it as a recipient identifier for the
// appropriare recipient payload box in the header of the saltpack message. When decrypting a saltpack message, a recipient
// can ask the server if any of the recipient identifiers in the message correspond to known pseudonyms (for teams the user is part of),
// and use the response from the server to identify which key to use for decryption. This mechanism substitutes an older kbfs based one
// (which is still supported to allow decryptions of old saltpack messages).
//
// A pseudonym is computed as an HMAC (with a random nonce as a key) of the information it refers to in order to
// prevent the server from tampering with the mapping (we rely on collision resistance and not unforgeability,
// as the server knows the nonce, so a simple SHA256 would have worked as well).
type KeyPseudonym [32]byte

func (p KeyPseudonym) String() string {
	return hex.EncodeToString(p[:])
}

func (p *KeyPseudonym) MarshalJSON() ([]byte, error) {
	return keybase1.Quote((*p).String()), nil
}

func (p *KeyPseudonym) UnmarshalJSON(b []byte) error {
	n, err := hex.Decode((*p)[:], keybase1.UnquoteBytes(b))
	if err != nil {
		return err
	}
	if n != len(*p) {
		return NewKeyPseudonymError("KeyPseudonym has wrong length")
	}
	return nil
}

func (p KeyPseudonym) Eq(r KeyPseudonym) bool {
	return hmac.Equal(p[:], r[:])
}

type KeyPseudonymNonce [32]byte

func (p KeyPseudonymNonce) String() string {
	return hex.EncodeToString(p[:])
}

func (p *KeyPseudonymNonce) MarshalJSON() ([]byte, error) {
	return keybase1.Quote((*p).String()), nil
}

func (p *KeyPseudonymNonce) UnmarshalJSON(b []byte) error {
	n, err := hex.Decode((*p)[:], keybase1.UnquoteBytes(b))
	if err != nil {
		return err
	}
	if n != len(*p) {
		return NewKeyPseudonymError("KeyPseudonymNonce has wrong length")
	}
	return nil
}

const KeyPseudonymVersion = 1

// KeyPseudonymInfo contains the KeyPseudonym as well as information about the key it represents.
type KeyPseudonymInfo struct {
	KeyPseudonym KeyPseudonym
	ID           keybase1.UserOrTeamID
	Application  keybase1.TeamApplication
	KeyGen       KeyGen
	Nonce        KeyPseudonymNonce
}

// keyPseudonymReq is what the server needs to store a pseudonym
type keyPseudonymReq struct {
	Pseudonym   KeyPseudonym          `json:"key_pseudonym"`   // hex
	ID          keybase1.UserOrTeamID `json:"user_or_team_id"` // hex
	Application int                   `json:"app_id"`
	KeyGen      int                   `json:"key_gen"`
	Nonce       KeyPseudonymNonce     `json:"nonce"` // hex
}

// keyPseudonymContents is the data packed inside the HMAC
type keyPseudonymContents struct {
	_struct     bool `codec:",toarray"`
	Version     int
	ID          [16]byte                 // keybase1.UserOrTeamId as a byte array
	Application keybase1.TeamApplication // int
	KeyGen      KeyGen                   // int
}

type getKeyPseudonymsRes struct {
	KeyPseudonyms []getKeyPseudonymRes `json:"key_pseudonyms"`
	Status        AppStatus            `json:"status"`
}

func (r *getKeyPseudonymsRes) GetAppStatus() *AppStatus {
	return &r.Status
}

type getKeyPseudonymRes struct {
	Err  *PseudonymGetError `json:"err"`
	Info *struct {
		ID          keybase1.UserOrTeamID `json:"user_or_team_id"`
		Application int                   `json:"app_id"`
		KeyGen      int                   `json:"key_gen"`
		Nonce       KeyPseudonymNonce     `json:"nonce"`
	} `json:"info"`
}

type KeyPseudonymOrError struct {
	// Exactly one of these 2 fields is nil.
	Err  error
	Info *KeyPseudonymInfo
}

// MakePseudonym makes a key pseudonym from the given input.
func MakeKeyPseudonym(info KeyPseudonymInfo) (KeyPseudonym, error) {
	var idBytes [16]byte
	id := info.ID.ToBytes()

	copy(idBytes[:], id)

	input := keyPseudonymContents{
		Version:     KeyPseudonymVersion,
		ID:          idBytes,
		Application: info.Application,
		KeyGen:      info.KeyGen,
	}
	mh := codec.MsgpackHandle{WriteExt: true}
	var buf []byte
	enc := codec.NewEncoderBytes(&buf, &mh)
	if err := enc.Encode(input); err != nil {
		return [32]byte{}, err
	}

	mac := hmac.New(sha256.New, info.Nonce[:])
	mac.Write(buf)
	hmac := MakeByte32(mac.Sum(nil))
	return hmac, nil
}

// MakeAndPostKeyPseudonyms fills the KeyPseudonym field of each of the pnymInfos with the appropriate KeyPseudonym.
func MakeAndPostKeyPseudonyms(m MetaContext, pnymInfos *[]KeyPseudonymInfo) (err error) {
	var pnymReqs []keyPseudonymReq

	if len(*pnymInfos) == 0 {
		return
	}

	for i, info := range *pnymInfos {
		// Compute the pseudonym
		var pnym KeyPseudonym
		pnym, err = MakeKeyPseudonym(info)
		if err != nil {
			return
		}
		(*pnymInfos)[i].KeyPseudonym = pnym
		pnymReqs = append(pnymReqs, keyPseudonymReq{
			Pseudonym:   pnym,
			ID:          info.ID,
			Application: int(info.Application),
			KeyGen:      int(info.KeyGen),
			Nonce:       info.Nonce,
		})
	}

	payload := make(JSONPayload)
	payload["key_pseudonyms"] = pnymReqs

	_, err = m.G().API.PostJSON(m, APIArg{
		Endpoint:    "team/key_pseudonym",
		JSONPayload: payload,
		SessionType: APISessionTypeREQUIRED,
	})
	if err != nil {
		return
	}
	return nil
}

// GetKeyPseudonyms fetches info for a list of pseudonyms.
// The output structs are returned in the order corresponding to the inputs.
// The top-level error is filled if the entire request fails.
// The error in each of the returned structs may be filled for per-pseudonym errors.
func GetKeyPseudonyms(m MetaContext, pnyms []KeyPseudonym) ([]KeyPseudonymOrError, error) {
	var pnymStrings []string
	for _, x := range pnyms {
		pnymStrings = append(pnymStrings, x.String())
	}

	var res getKeyPseudonymsRes
	err := m.G().API.GetDecode(m,
		APIArg{
			Endpoint:    "team/key_pseudonym",
			SessionType: APISessionTypeREQUIRED,
			Args: HTTPArgs{
				"key_pseudonyms": S{Val: strings.Join(pnymStrings, ",")},
			},
		},
		&res)
	if err != nil {
		return nil, err
	}

	// Validate the response
	if len(res.KeyPseudonyms) != len(pnyms) {
		return nil, &KeyPseudonymGetError{fmt.Sprintf("invalid server response for pseudonym get: len %v != %v",
			len(res.KeyPseudonyms), len(pnyms))}
	}
	var resList []KeyPseudonymOrError
	for i, received := range res.KeyPseudonyms {
		resList = append(resList, checkAndConvertKeyPseudonymFromServer(pnyms[i], received))
	}

	return resList, nil
}

func checkAndConvertKeyPseudonymFromServer(req KeyPseudonym, received getKeyPseudonymRes) KeyPseudonymOrError {
	mkErr := func(err error) KeyPseudonymOrError {
		return KeyPseudonymOrError{
			Info: nil,
			Err:  err,
		}
	}

	x := KeyPseudonymOrError{}

	// This check is necessary because of sneaky typed nil.
	// received.Err's type is lower than x.Err
	// So doing `x.Err = received.Err` is bad if received.Err is nil.
	// https://golang.org/doc/faq#nil_error
	// https://play.golang.org/p/BnjVTGh-gO
	if received.Err != nil {
		x.Err = received.Err
	}

	if received.Info != nil {
		info := KeyPseudonymInfo{}

		info.ID = received.Info.ID
		info.KeyGen = KeyGen(received.Info.KeyGen)
		info.Application = keybase1.TeamApplication(received.Info.Application)
		info.Nonce = received.Info.Nonce

		x.Info = &info
	}

	err := checkKeyPseudonymFromServer(req, x)
	if err != nil {
		return mkErr(err)
	}
	return x
}

func checkKeyPseudonymFromServer(req KeyPseudonym, received KeyPseudonymOrError) error {
	// Exactly one of Info and Err should exist
	if (received.Info == nil) == (received.Err == nil) {
		return &KeyPseudonymGetError{fmt.Sprintf("invalid server response for key_pseudonym get: %s", req)}
	}

	// Errors don't need validation
	if received.Info == nil {
		return nil
	}

	// Check that the pseudonym info matches the query.
	pn, err := MakeKeyPseudonym(*received.Info)
	if err != nil {
		// Error creating pseudonym locally
		return &KeyPseudonymGetError{err.Error()}
	}
	if !req.Eq(pn) {
		return &KeyPseudonymGetError{fmt.Sprintf("returned data does not match key_pseudonym: %s != %s",
			req, pn)}
	}

	return nil
}

// RandomPseudonymNonce returns a random nonce, which is used as an HMAC key.
func RandomPseudonymNonce() KeyPseudonymNonce {
	slice, err := RandBytes(32)
	if err != nil {
		panic(err)
	}
	return KeyPseudonymNonce(MakeByte32(slice))
}
