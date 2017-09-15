package teams

import (
	"encoding/base64"
	"github.com/keybase/client/go/libkb"
)

// SCTeamEntropy is used to render stubbed out links unguessable.
// Basically, we shove a random 18-byte string into sensitive links.
type SCTeamEntropy string

func (i SCTeamSection) addEntropy() (SCTeamSection, error) {
	entropy, err := makeSCTeamEntropy()
	if err != nil {
		return i, err
	}
	i.Entropy = entropy
	return i, nil
}

func makeSCTeamEntropy() (SCTeamEntropy, error) {
	rb, err := libkb.RandBytes(18)
	if err != nil {
		return SCTeamEntropy(""), err
	}
	return SCTeamEntropy(base64.StdEncoding.EncodeToString(rb)), nil
}
