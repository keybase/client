package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type contactRestrictedUsers map[keybase1.UID]bool

// checkCandidate checks if candidate (AddMemberCandidate from transactions.go)
// is restricted by contact settings. If so, also a keybase1.User struct is
// returned.
func (c contactRestrictedUsers) checkCandidate(candidate AddMemberCandidate) (restricted bool, user keybase1.User) {
	if c == nil {
		return false, user
	}
	if upak := candidate.KeybaseUser; upak != nil {
		if _, ok := c[upak.Uid]; ok {
			// Skip users with contact setting restrictions.
			user = keybase1.User{
				Uid:      upak.Uid,
				Username: libkb.NewNormalizedUsername(upak.Username).String(),
			}
			return true, user
		}
	}
	return false, user
}

func unpackContactRestrictedUsers(blockError libkb.TeamContactSettingsBlockError) (ret contactRestrictedUsers) {
	uids := blockError.BlockedUIDs()
	ret = make(contactRestrictedUsers, len(uids))
	for _, uid := range uids {
		ret[uid] = true
	}
	return ret
}
