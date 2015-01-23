package libkb

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-jsonw"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
	"io/ioutil"
	"strings"
)

const (
	SIG_ID_LEN    = 32
	SIG_ID_SUFFIX = 0x0f
)

type SigId [SIG_ID_LEN]byte

func ComputeSigIdFromSigBody(body []byte) SigId {
	return SigId(sha256.Sum256(body))
}

func (s SigId) ToDisplayString(verbose bool) string {
	if verbose {
		return s.ToString(true)
	} else {
		return fmt.Sprintf("%s...", hex.EncodeToString(s[0:3]))
	}
}

func SigIdFromSlice(s []byte) (*SigId, error) {
	if len(s) != SIG_ID_LEN {
		return nil, fmt.Errorf("Bad SidId; wanted %d byte; got %d",
			SIG_ID_LEN, len(s))
	} else {
		ret := SigId{}
		copy(ret[:], s)
		return &ret, nil
	}
}

func SigIdFromHex(s string, suffix bool) (*SigId, error) {
	bv, err := hex.DecodeString(s)
	totlen := SIG_ID_LEN
	if suffix {
		totlen += 1
	}
	if err == nil && len(bv) != totlen {
		err = fmt.Errorf("Bad sigId wrong length: %d", len(bv))
		return nil, err
	}
	if suffix && bv[SIG_ID_LEN] != SIG_ID_SUFFIX {
		err = fmt.Errorf("Bad suffix byte: %02x", bv[SIG_ID_LEN])
		return nil, err
	}

	var ret *SigId
	if bv != nil {
		tmp := SigId{}
		copy(tmp[:], bv[0:SIG_ID_LEN])
		ret = &tmp
	}
	return ret, err
}

func GetSigId(w *jsonw.Wrapper, suffix bool) (*SigId, error) {
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := SigIdFromHex(s, suffix)
	return ret, err
}

func GetSigIdVoid(jw *jsonw.Wrapper, suffix bool, p *SigId, e *error) {
	ret, err := GetSigId(jw, suffix)
	if err != nil {
		*e = err
	} else {
		*p = *ret
	}
}

func (s SigId) ToString(suffix bool) string {
	ret := hex.EncodeToString(s[:])
	if suffix {
		ret = fmt.Sprintf("%s%02x", ret, SIG_ID_SUFFIX)
	}
	return ret
}

func (s SigId) ToMediumId() string {
	return depad(base64.URLEncoding.EncodeToString(s[:]))
}

func (s SigId) ToShortId() string {
	return depad(base64.URLEncoding.EncodeToString(s[0:SIG_SHORT_ID_BYTES]))
}

func (k PgpKeyBundle) ReadAndVerify(armored string) (msg []byte, sig_id *SigId,
	err error) {

	var ps *ParsedSig
	if ps, err = OpenSig(armored); err != nil {
		return
	} else if err = ps.Verify(k); err != nil {
		return
	}
	tmp := ps.ID()
	return ps.LiteralData, &tmp, nil
}

func (k PgpKeyBundle) Verify(armored string, expected []byte) (sigId *SigId,
	err error) {
	res, sig_id, err := k.ReadAndVerify(armored)
	if err != nil {
		return
	}
	if !FastByteArrayEq(res, expected) {
		err = BadSigError{"wrong payload"}
		return
	}
	return sig_id, nil
}

type ParsedSig struct {
	Block       *armor.Block
	SigBody     []byte
	MD          *openpgp.MessageDetails
	LiteralData []byte
}

func OpenSig(armored string) (ps *ParsedSig, err error) {
	pso := ParsedSig{}
	pso.Block, err = armor.Decode(strings.NewReader(armored))
	if err != nil {
		return
	}
	pso.SigBody, err = ioutil.ReadAll(pso.Block.Body)
	if err != nil {
		return
	}
	ps = &pso
	return
}

func SigAssertPayload(armored string, expected []byte) (sigId *SigId, err error) {
	if strings.HasPrefix(armored, "-----BEGIN PGP") {
		return SigAssertPgpPayload(armored, expected)
	} else {
		return SigAssertKbPayload(armored, expected)
	}
}

func SigAssertPgpPayload(armored string, expected []byte) (sigId *SigId, err error) {
	var ps *ParsedSig
	ps, err = OpenSig(armored)
	if err != nil {
		return
	}
	if err = ps.AssertPayload(expected); err != nil {
		ps = nil
		return
	}
	tmp := ps.ID()
	sigId = &tmp
	return
}

func (ps *ParsedSig) AssertPayload(expected []byte) error {

	ring := EmptyKeyRing{}
	md, err := openpgp.ReadMessage(bytes.NewReader(ps.SigBody), ring, nil, nil)
	if err != nil {
		return err
	}
	data, err := ioutil.ReadAll(md.UnverifiedBody)
	if err != nil {
		return err
	}
	if !FastByteArrayEq(data, expected) {
		err = fmt.Errorf("Signature did not contain expected text")
		return err
	}
	return nil
}

func (ps *ParsedSig) Verify(k PgpKeyBundle) (err error) {
	ps.MD, err = openpgp.ReadMessage(bytes.NewReader(ps.SigBody), k, nil, nil)
	if err != nil {
		return
	}
	if !ps.MD.IsSigned || ps.MD.SignedBy == nil {
		err = fmt.Errorf("Message wasn't signed")
		return
	}
	if !k.MatchesKey(ps.MD.SignedBy) {
		err = fmt.Errorf("Got wrong SignedBy key %v",
			hex.EncodeToString(ps.MD.SignedBy.PublicKey.Fingerprint[:]))
		return
	}
	if ps.MD.UnverifiedBody == nil {
		err = fmt.Errorf("no signed material found")
		return
	}

	ps.LiteralData, err = ioutil.ReadAll(ps.MD.UnverifiedBody)
	if err != nil {
		return
	}

	// We'll see a sig error here after reading in the UnverifiedBody above,
	// if there was one to see.
	if err = ps.MD.SignatureError; err != nil {
		return
	}

	if ps.MD.Signature == nil {
		err = fmt.Errorf("No available signature after checking signature")
		return
	}

	// Hopefully by here we've covered all of our bases.
	return nil
}

func (ps *ParsedSig) ID() SigId {
	return SigId(sha256.Sum256(ps.SigBody))
}
