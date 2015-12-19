// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"

	"golang.org/x/crypto/scrypt"

	"github.com/keybase/client/go/kex2"
)

type Kex2Secret struct {
	phrase string
	secret kex2.Secret
}

func NewKex2Secret() (*Kex2Secret, error) {
	words, err := SecWordList(Kex2PhraseEntropy)
	if err != nil {
		return nil, err
	}
	phrase := strings.Join(words, " ")
	return NewKex2SecretFromPhrase(phrase)
}

func NewKex2SecretFromPhrase(phrase string) (*Kex2Secret, error) {
	key, err := scrypt.Key([]byte(phrase), nil, Kex2ScryptCost, Kex2ScryptR, Kex2ScryptP, Kex2ScryptKeylen)
	if err != nil {
		return nil, err
	}

	res := &Kex2Secret{phrase: phrase}
	copy(res.secret[:], key)
	return res, nil
}

func (s *Kex2Secret) Secret() kex2.Secret {
	return s.secret
}

func (s *Kex2Secret) Phrase() string {
	return s.phrase
}
