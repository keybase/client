// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"github.com/keybase/client/go/kex2"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/scrypt"
	"strings"
)

const kexPhraseVersion = "four"

type Kex2Secret struct {
	phrase string
	secret kex2.Secret
	typ    Kex2SecretType
}

type Kex2SecretType int

const (
	Kex2SecretTypeNone      Kex2SecretType = 0
	Kex2SecretTypeV1Desktop Kex2SecretType = 1
	Kex2SecretTypeV1Mobile  Kex2SecretType = 2
	Kex2SecretTypeV2        Kex2SecretType = 3
)

func NewKex2SecretFromTypeAndUID(typ Kex2SecretType, uid keybase1.UID) (*Kex2Secret, error) {

	entropy := Kex2PhraseEntropy
	if typ == Kex2SecretTypeV2 {
		entropy = Kex2PhraseEntropy2
	}

	words, err := SecWordList(entropy)
	if err != nil {
		return nil, err
	}

	phrase := strings.Join(words, " ")
	// If we are provisioning a mobile device, we want to use an easier to compute secret. In order to
	// communicate that to the two devices involved in kex without breaking the existing protocol,
	// we have added an extra word that is not in the dictionary. Up to date clients can see this
	// word and use the lighter version of scrypt.
	if typ == Kex2SecretTypeV1Mobile {
		phrase += " " + kexPhraseVersion
	}
	return newKex2SecretFromTypeUIDAndPhrase(typ, uid, phrase)
}

func NewKex2SecretFromUIDAndPhrase(uid keybase1.UID, phrase string) (*Kex2Secret, error) {

	typ, err := kex2TypeFromPhrase(phrase)
	if err != nil {
		return nil, err
	}

	return newKex2SecretFromTypeUIDAndPhrase(typ, uid, phrase)
}

func kex2TypeFromPhrase(phrase string) (typ Kex2SecretType, err error) {

	words := strings.Split(phrase, " ")
	if len(words) == 8 {
		return Kex2SecretTypeV1Desktop, nil
	}
	if len(words) != 9 {
		return Kex2SecretTypeNone, errors.New("wrong number of words in passphrase; wanted 8 or 9")
	}
	if words[len(words)-1] == kexPhraseVersion {
		return Kex2SecretTypeV1Mobile, nil
	}
	return Kex2SecretTypeV2, nil
}

func newKex2SecretFromTypeUIDAndPhrase(typ Kex2SecretType, uid keybase1.UID, phrase string) (*Kex2Secret, error) {

	var cost int
	var salt []byte
	switch typ {
	case Kex2SecretTypeV1Mobile:
		cost = Kex2ScryptLiteCost
	case Kex2SecretTypeV1Desktop:
		cost = Kex2ScryptCost
	case Kex2SecretTypeV2:
		cost = Kex2ScryptLiteCost
		salt = uid.ToBytes()
	default:
		return nil, errors.New("unknown kex2 secret type")
	}

	key, err := scrypt.Key([]byte(phrase), salt, cost, Kex2ScryptR, Kex2ScryptP, Kex2ScryptKeylen)
	if err != nil {
		return nil, err
	}
	res := &Kex2Secret{phrase: phrase, typ: typ}
	copy(res.secret[:], key)
	return res, nil
}

func (s *Kex2Secret) Secret() kex2.Secret {
	return s.secret
}

func (s *Kex2Secret) Phrase() string {
	return s.phrase
}
