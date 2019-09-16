package stellarcommon

import (
	"encoding/base64"
	"errors"
	"strconv"

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

func (r Recipient) HasMemo() bool {
	return r.PublicMemo != nil && r.PublicMemoType != nil
}

func (r Recipient) Memo() (*stellarnet.Memo, error) {
	if !r.HasMemo() {
		return nil, nil
	}

	switch *r.PublicMemoType {
	case "text":
		return stellarnet.NewMemoText(*r.PublicMemo), nil
	case "hash":
		data, err := base64.StdEncoding.DecodeString(*r.PublicMemo)
		if err != nil {
			return nil, errors.New("invalid federation memo hash")
		}
		if len(data) != 32 {
			return nil, errors.New("invalid federation memo hash")
		}
		var hash stellarnet.MemoHash
		copy(hash[:], data)
		return stellarnet.NewMemoHash(hash), nil
	case "id":
		id, err := strconv.ParseUint(*r.PublicMemo, 10, 64)
		if err != nil {
			return nil, err
		}
		return stellarnet.NewMemoID(id), nil
	default:
		return nil, errors.New("invalid federation memo type")
	}

}

type User struct {
	UV       keybase1.UserVersion
	Username libkb.NormalizedUsername
}
