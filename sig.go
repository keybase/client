package libkb

import (
	"bytes"
	"code.google.com/p/go.crypto/openpgp"
	"code.google.com/p/go.crypto/openpgp/armor"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-jsonw"
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

func (k PgpKeyBundle) ReadAndVerify(armored string) (msg []byte, sig_id *SigId,
	err error) {
	block, err := armor.Decode(strings.NewReader(armored))
	if err != nil {
		return
	}
	sig_body, err := ioutil.ReadAll(block.Body)
	if err != nil {
		return
	}

	md, err := openpgp.ReadMessage(bytes.NewReader(sig_body), k, nil, nil)
	if err != nil {
		return
	}
	if !md.IsSigned || md.SignedBy == nil {
		err = fmt.Errorf("Message wasn't signed")
		return
	}
	if !k.MatchesKey(md.SignedBy) {
		err = fmt.Errorf("Got wrong SignedBy key")
		return
	}
	if md.LiteralData.Body != nil {
		err = fmt.Errorf("no signed material found")
		return
	}

	var ret []byte
	ret, err = ioutil.ReadAll(md.LiteralData.Body)
	if err != nil {
		return
	}

	tmp := ComputeSigIdFromSigBody(sig_body)
	sig_id = &tmp

	return ret, sig_id, err
}

func (k PgpKeyBundle) Verify(armored string, expected []byte) (sigId *SigId,
	err error) {
	res, sig_id, err := k.ReadAndVerify(armored)
	if err != nil {
		return
	}
	if !FastByteArrayEq(res, expected) {
		err = fmt.Errorf("Verified text failed to match expected text")
		return
	}
	return sig_id, nil
}
