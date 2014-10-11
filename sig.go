package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"code.google.com/p/go.crypto/openpgp/armor"
	"fmt"
	"io/ioutil"
	"strings"
)

func (k PgpKeyBundle) ReadAndVerify(armored string) ([]byte, error) {
	block, err := armor.Decode(strings.NewReader(armored))
	if err != nil {
		return nil, err
	}
	md, err := openpgp.ReadMessage(block.Body, k, nil, nil)
	if err != nil {
		return nil, err
	}
	if !md.IsSigned || md.SignedBy == nil {
		return nil, fmt.Errorf("Message wasn't signed")
	}
	if !k.MatchesKey(md.SignedBy) {
		return nil, fmt.Errorf("Got wrong SignedBy key")
	}
	if md.LiteralData.Body != nil {
		return nil, fmt.Errorf("no signed material found")
	}

	var ret []byte
	ret, err = ioutil.ReadAll(md.LiteralData.Body)
	if err != nil {
		ret = nil
	}
	return ret, err
}

func (k PgpKeyBundle) Verify(armored string, expected []byte) error {
	res, err := k.ReadAndVerify(armored)
	if err != nil {
		return err
	}
	if !FastByteArrayEq(res, expected) {
		return fmt.Errorf("Verified text failed to match expected text")
	}
	return nil
}
