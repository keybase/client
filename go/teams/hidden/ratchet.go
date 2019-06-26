package hidden

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
)

type EncodedRatchetBlindingKeySet string

func (e EncodedRatchetBlindingKeySet) IsNil() bool    { return len(e) == 0 }
func (e EncodedRatchetBlindingKeySet) String() string { return string(e) }

type BlindingKey [32]byte
type SCTeamRatchet [32]byte

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

type Ratchet struct {
	encoded EncodedRatchetBlindingKeySet
	decoded RatchetObj
}

type RatchetBlindingKeySet struct {
	m map[SCTeamRatchet]RatchetObj
}

func (r SCTeamRatchet) String() string {
	return hex.EncodeToString(r[:])
}

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

func genRandomBytes(i int) ([]byte, error) {
	ret := make([]byte, i, i)
	n, err := rand.Reader.Read(ret[:])
	if err != nil {
		return nil, err
	}
	if n != i {
		return nil, newRatchetError("short random entropy read")
	}
	return ret, nil
}

func generateBlindingKey() (BlindingKey, error) {
	var ret BlindingKey
	tmp, err := genRandomBytes(len(ret))
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

func (r *RatchetObj) check() (err error) {
	return r.RatchetBlind.check(r.Body)
}

func (r *RatchetBlind) check(tail sig3.Tail) (err error) {
	computed, err := r.compute(tail)
	if err != nil {
		return err
	}
	if !hmac.Equal(computed[:], r.Hash[:]) {
		return newRatchetError("blinding check failed")
	}
	return nil
}

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

func (r *Ratchet) generate(mctx libkb.MetaContext) (err error) {
	arr := []RatchetObj{r.decoded}
	b, err := msgpack.Encode(arr)
	if err != nil {
		return err
	}
	r.encoded = EncodedRatchetBlindingKeySet(base64.StdEncoding.EncodeToString(b))
	return nil
}

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
	err = ret.generate(mctx)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func MakeRatchet(mctx libkb.MetaContext, id keybase1.TeamID) (*Ratchet, error) {

	err := CheckFeatureGateForSupport(mctx, id, true /* isWrite */)
	if err != nil {
		mctx.VLogf(libkb.VLog0, "skipping ratchet for team id %s due to feature-flag", id)
		return nil, nil
	}

	tail, err := mctx.G().GetHiddenTeamChainManager().Tail(mctx, id)
	if err != nil {
		return nil, err
	}
	if tail == nil || tail.Seqno == keybase1.Seqno(0) {
		return nil, err
	}
	itail, err := sig3.ImportTail(*tail)
	if err != nil {
		return nil, err
	}
	ret, err := generateRatchet(mctx, *itail)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func (e EncodedRatchetBlindingKeySet) AddToJSONPayload(p libkb.JSONPayload) {
	if e.IsNil() {
		return
	}
	p["ratchet_blinding_keys"] = e.String()
}

func (r *Ratchet) AddToJSONPayload(p libkb.JSONPayload) {
	if r == nil {
		return
	}
	r.ToSigPayload().AddToJSONPayload(p)
}

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

func checkRatchets(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchets keybase1.HiddenTeamChainRatchetSet) (err error) {
	for _, r := range ratchets.Flat() {
		err = checkRatchet(mctx, state, r)
		if err != nil {
			return err
		}
	}
	return nil
}
