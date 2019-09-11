package stellarcommon

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/stellarnet"
)

type RecipientInput string

type Recipient struct {
	Input RecipientInput
	// These 5 fields are nullable.
	User      *User
	Assertion *keybase1.SocialAssertion
	// Recipient may not have a stellar wallet ready to receive
	AccountID *stellarnet.AddressStr // User entered G... OR target has receiving address

	// federation address lookups can return a memo
	PublicMemo     *string
	PublicMemoType *string
}

type User struct {
	UV       keybase1.UserVersion
	Username libkb.NormalizedUsername
}
