package hidden

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
)

// Hidden Ratchet computation, parsing, and manipulation libraries.
//
// In main chain links, we might now see ratchets that look like this:
//
//    body.teams.ratchets = [ "1e1e39427938aa0dffe2adc6323493f9edcbd4c09f4b05b4b884b09ee98fd2b1" ]
//
// When such a link is returned from the server via team/get, it should also be accompanied with
// "blinding" keys, for the purposes of unblinding, such as:
//
//    "ratchet_blinding_keys": "kYOhYoOhaMQgV2dLp8XOVd9wzL/jbWJOVsIUp7qK+oTe0HCH1K2dEeihcwKhdBGhcoKha8QgX8+MXRs5K99h5pRAYz3qNQOKkdH0lzr8WUe+xEPiYeOhcsQgHh45Qnk4qg3/4q3GMjST+e3L1MCfSwW0uISwnumP0rGhdgE=",
//
// This field is of type EncodedRatchedBlindingKeySet; when base64-decoded, and unmsgpacked, it
// fits into a RatchetObj; so for instance:
//
// [ { b:
//     { h: <Buffer 57 67 4b a7 c5 ce 55 df 70 cc bf e3 6d 62 4e 56 c2 14 a7 ba 8a fa 84 de d0 70 87 d4 ad 9d 11 e8>,
//       s: 2, t: 17 },
//    r:
//     { k: <Buffer 5f cf 8c 5d 1b 39 2b df 61 e6 94 40 63 3d ea 35 03 8a 91 d1 f4 97 3a fc 59 47 be c4 43 e2 61 e3>,
//       r: <Buffer 1e 1e 39 42 79 38 aa 0d ff e2 ad c6 32 34 93 f9 ed cb d4 c0 9f 4b 05 b4 b8 84 b0 9e e9 8f d2 b1> },
//    v: 1 } ]
//
// As we can see, r.r corresponds to what was sent in the visible team chain link. r.k is the blinding key.
// When we compute HMAC-SHA512(r.k, pack(b)), whe should get r.r
//
// This file handles encoding/decoding, packing/unpacking, marshalling/unmarshalling of this data.
//

// EncodedRatchetBlindingKeySet is a b64-encoded, msgpacked map of a RatchetBlindingKeySet, used to POST up to the
// server 1 new ratchet. Note that even in the case of multiple signatures (inside a TX), it only is really necessary
// to ratchet the hidden chain once. So this suffices.
type EncodedRatchetBlindingKeySet string

func (e EncodedRatchetBlindingKeySet) IsNil() bool    { return len(e) == 0 }
func (e EncodedRatchetBlindingKeySet) String() string { return string(e) }

// BlindingKey is a 32-byte random byte array that is used to blind ratchets, so that they can be
// selectively hidden via access control.
type BlindingKey [32]byte

// SCTeamRatchet is the result of HMAC-SHA512(k,v)[0:32], where k is a random Blinding Key,
// and v is the msgpack of a sig3.Tail.
type SCTeamRatchet [32]byte

// RatchetVersion is always 1, for now.
type RatchetVersion int

const RatchetVersion1 = RatchetVersion(1)

type RatchetBlind struct {
	Hash SCTeamRatchet `codec:"r"`
	Key  BlindingKey   `codec:"k"`
}

type RatchetObj struct {
	Body         sig3.Tail      `codec:"b"`
	RatchetBlind RatchetBlind   `codec:"r"`
	Version      RatchetVersion `codec:"v"`
}

// Ratchet is an object that's used in the teams/teams* and teams/transaction* world to make a visible team chain
// link incorporate one hidden team ratchet. This means we have to post data both into the signature field (the blinded ratchet)
// and also data into the sig POST, the blinding keys, etc. This little object conveniniently encapsulates all of that.
type Ratchet struct {
	encoded EncodedRatchetBlindingKeySet
	decoded RatchetObj
}

// RatchetBlindingKeySet is sent down from the server when we are reading a set of blinding ratchets from
// the team/get response.
type RatchetBlindingKeySet struct {
	m map[SCTeamRatchet]RatchetObj
}

func (r SCTeamRatchet) String() string {
	return hex.EncodeToString(r[:])
}

// UnmarshalJSON is implicitly used in chain_parse.go move SCTeamRatchets into and out of JSON
// from the hidden team chain.
func (r *SCTeamRatchet) UnmarshalJSON(b []byte) error {
	unquoted := keybase1.UnquoteBytes(b)
	if len(unquoted) == 0 {
		return nil
	}
	b, err := hex.DecodeString(string(unquoted))
	if err != nil {
		return err
	}
	if len(b) != len(*r) {
		return newRatchetError("cannot decode team ratchet; wrong size")
	}
	copy((*r)[:], b[:])
	return nil
}

// Get the chain tail that corresponds to the given ratchet. Return nil if we fail to find it, and
// an object if we find it.
func (r *RatchetBlindingKeySet) Get(ratchet SCTeamRatchet) *sig3.Tail {
	if r == nil || r.m == nil {
		return nil
	}
	obj, ok := r.m[ratchet]
	if !ok {
		return nil
	}
	return &obj.Body
}

// UnmarshalJSON is implicitly used in rawTeam-based API calls to move RatchetBlindingKeySets into and out of JSON
// from the hidden team chain.
func (r *RatchetBlindingKeySet) UnmarshalJSON(b []byte) error {
	r.m = make(map[SCTeamRatchet]RatchetObj)
	if string(b) == "null" {
		return nil
	}
	unquoted := keybase1.UnquoteBytes(b)
	if len(unquoted) == 0 {
		return nil
	}
	b, err := base64.StdEncoding.DecodeString(string(unquoted))
	if err != nil {
		return err
	}
	var arr []RatchetObj
	err = msgpack.Decode(&arr, b)
	if err != nil {
		return err
	}
	for _, e := range arr {
		err = e.check()
		if err != nil {
			return err
		}
		r.m[e.RatchetBlind.Hash] = e
	}
	return err
}

func (r *SCTeamRatchet) MarshalJSON() ([]byte, error) {
	s := hex.EncodeToString([]byte((*r)[:]))
	b := keybase1.Quote(s)
	return b, nil
}

func (r *Ratchet) ToTeamSection() []SCTeamRatchet {
	if r == nil {
		return nil
	}
	return []SCTeamRatchet{r.decoded.RatchetBlind.Hash}
}

func (r *Ratchet) ToSigPayload() (ret EncodedRatchetBlindingKeySet) {
	if r == nil {
		return ret
	}
	return r.encoded
}

func generateBlindingKey() (BlindingKey, error) {
	var ret BlindingKey
	tmp, err := libkb.RandBytes(len(ret))
	if err != nil {
		return ret, err
	}
	copy(ret[:], tmp[:])
	return ret, nil
}

func (r *RatchetBlind) computeToSelf(tail sig3.Tail) (err error) {
	h, err := r.compute(tail)
	if err != nil {
		return err
	}
	r.Hash = h
	return nil
}

// check the internal consistency of this blinded ratchet against itself.
func (r *RatchetObj) check() (err error) {
	return r.RatchetBlind.check(r.Body)
}

// check the internal consistency of this blinded ratchet against the input Tail value.
func (r *RatchetBlind) check(tail sig3.Tail) (err error) {
	computed, err := r.compute(tail)
	if err != nil {
		return err
	}
	if !hmac.Equal(computed[:], r.Hash[:]) {
		return newRatchetError("blinding check failed %x v %x", computed[:], r.Hash[:])
	}
	return nil
}

// compute combines the internal ratchet blinding key and in the input sig3.Tail to
// make a blinded ratchet, as we would post into sigchain links.
func (r *RatchetBlind) compute(tail sig3.Tail) (ret SCTeamRatchet, err error) {

	b, err := msgpack.Encode(tail)
	if err != nil {
		return ret, err
	}
	h := hmac.New(sha512.New, r.Key[:])
	h.Write(b)
	d := h.Sum(nil)[0:32]
	copy(ret[:], d)
	return ret, nil
}

func (r *RatchetObj) generate(mctx libkb.MetaContext) (err error) {
	r.RatchetBlind.Key, err = generateBlindingKey()
	if err != nil {
		return err
	}
	err = r.RatchetBlind.computeToSelf(r.Body)
	if err != nil {
		return err
	}
	return nil
}

func (r *Ratchet) encode(mctx libkb.MetaContext) (err error) {
	arr := []RatchetObj{r.decoded}
	b, err := msgpack.Encode(arr)
	if err != nil {
		return err
	}
	r.encoded = EncodedRatchetBlindingKeySet(base64.StdEncoding.EncodeToString(b))
	return nil
}

// generateRatchet, cooking up a new blinding key, and computing the encoding and blinding of
// the ratchet.
func generateRatchet(mctx libkb.MetaContext, b sig3.Tail) (ret *Ratchet, err error) {
	ret = &Ratchet{
		decoded: RatchetObj{
			Version: RatchetVersion1,
			Body:    b,
		},
	}
	err = ret.decoded.generate(mctx)
	if err != nil {
		return nil, err
	}
	err = ret.encode(mctx)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

// MakeRatchet constructs a new Ratchet object for the given team's hidden tail, blinds
// it with a randomly-generated blinding key, and then packages all relevant info up into
// and encoding that can be easily posted to the API server.
func MakeRatchet(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain) (ret *Ratchet, err error) {
	if state == nil {
		mctx.Debug("hidden.MakeRatchet: returning a nil ratchet since hidden team is nil")
		return nil, nil
	}
	id := state.Id

	defer mctx.Trace(fmt.Sprintf("hidden.MakeRatchet(%s)", id), func() error { return err })()

	err = CheckFeatureGateForSupport(mctx, id, true /* isWrite */)
	if err != nil {
		mctx.VLogf(libkb.VLog0, "skipping ratchet for team id %s due to feature-flag", id)
		return nil, nil
	}
	tail := state.TailTriple()
	if tail == nil || tail.Seqno == keybase1.Seqno(0) {
		mctx.Debug("no tail found")
		return nil, nil
	}
	itail, err := sig3.ImportTail(*tail)
	if err != nil {
		return nil, err
	}
	mctx.Debug("ratcheting at tail (%s,%d)", itail.Hash, itail.Seqno)
	ret, err = generateRatchet(mctx, *itail)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

// AddToJSONPayload is used to add the ratching blinding information to an API POST
func (e EncodedRatchetBlindingKeySet) AddToJSONPayload(p libkb.JSONPayload) {
	if e.IsNil() {
		return
	}
	p["ratchet_blinding_keys"] = e.String()
}

// AddToJSONPayload is used to add the ratching blinding information to an API POST
func (r *Ratchet) AddToJSONPayload(p libkb.JSONPayload) {
	if r == nil {
		return
	}
	r.ToSigPayload().AddToJSONPayload(p)
}

// checkRatchet against what we have in state, and error out if it clashes.
func checkRatchet(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchet keybase1.LinkTripleAndTime) (err error) {
	if state == nil {
		return nil
	}
	if ratchet.Triple.SeqType != sig3.ChainTypeTeamPrivateHidden {
		return newRatchetError("bad chain type: %s", ratchet.Triple.SeqType)
	}

	// The new ratchet can't clash the existing accepted ratchets
	for _, accepted := range state.RatchetSet.Flat() {
		if accepted.Clashes(ratchet) {
			return newRatchetError("bad ratchet, clashes existing pin: %+v != %v", accepted, accepted)
		}
	}

	q := ratchet.Triple.Seqno
	link, ok := state.Outer[q]

	// If either the ratchet didn't match a known link, or equals what's already there, great.
	if ok && !link.Eq(ratchet.Triple.LinkID) {
		return newRatchetError("Ratchet failed to match a currently accepted chainlink: %+v", ratchet)
	}

	return nil
}

// checkRatchets iterates over the given RatchetSet and checks each one for clashes against our current state.
func checkRatchets(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchets keybase1.HiddenTeamChainRatchetSet) (err error) {
	for _, r := range ratchets.Flat() {
		err = checkRatchet(mctx, state, r)
		if err != nil {
			return err
		}
	}
	return nil
}
