package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"code.google.com/p/go.crypto/openpgp/armor"
	"fmt"
	"io/ioutil"
	"strings"
)

func (k PgpKeyBundle) toList() openpgp.EntityList {
	list := make(openpgp.EntityList, 1, 1)
	list[0] = (*openpgp.Entity)(&k)
	return list
}

func (k PgpKeyBundle) KeysById(id uint64) []openpgp.Key {
	return k.toList().KeysById(id)
}

func (k PgpKeyBundle) KeysByIdUsage(id uint64, usage byte) []openpgp.Key {
	return k.toList().KeysByIdUsage(id, usage)
}

func (k PgpKeyBundle) DecryptionKeys() []openpgp.Key {
	return k.toList().DecryptionKeys()
}

func (k PgpKeyBundle) MatchesKey(key *openpgp.Key) bool {
	return FastByteArrayEq(k.PrimaryKey.Fingerprint[:],
		key.PublicKey.Fingerprint[:])
}

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
