// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"

	"github.com/keybase/client/go/kex2"
	"golang.org/x/crypto/scrypt"
)

const kexPhraseVersion = "four"

type Kex2Secret struct {
	phrase string
	secret kex2.Secret
}

func NewKex2Secret(mobile bool) (*Kex2Secret, error) {
	words, err := SecWordList(Kex2PhraseEntropy)
	if err != nil {
		return nil, err
	}

	phrase := strings.Join(words, " ")
	// If we are provisioning a mobile device, we want to use an easier to compute secret. In order to
	// communicate that to the two devices involved in kex without breaking the existing protocol,
	// we have added an extra word that is not in the dictionary. Up to date clients can see this
	// word and use the lighter version of scrypt.
	if mobile {
		phrase += " " + kexPhraseVersion
	}
	return NewKex2SecretFromPhrase(phrase)
}

func NewKex2SecretFromPhrase(phrase string) (*Kex2Secret, error) {

	scryptCost := Kex2ScryptCost
	// Detect if the phrase contains the magic word that indicates that we are provisioning a mobile
	// device. If so, then we use the lighter cost version of scrypt.
	words := strings.Split(phrase, " ")
	if len(words) > 0 && words[len(words)-1] == kexPhraseVersion {
		scryptCost = Kex2ScryptLiteCost
	}

	key, err := scrypt.Key([]byte(phrase), nil, scryptCost, Kex2ScryptR, Kex2ScryptP, Kex2ScryptKeylen)
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
