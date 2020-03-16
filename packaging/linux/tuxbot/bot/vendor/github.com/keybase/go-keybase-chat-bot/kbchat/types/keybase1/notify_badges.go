// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/notify_badges.avdl

package keybase1

import (
	gregor1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/gregor1"
)

type ChatConversationID []byte

func (o ChatConversationID) DeepCopy() ChatConversationID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type TeamMemberOutReset struct {
	TeamID   TeamID        `codec:"teamID" json:"teamID"`
	Teamname string        `codec:"teamname" json:"teamname"`
	Username string        `codec:"username" json:"username"`
	Uid      UID           `codec:"uid" json:"uid"`
	Id       gregor1.MsgID `codec:"id" json:"id"`
}

func (o TeamMemberOutReset) DeepCopy() TeamMemberOutReset {
	return TeamMemberOutReset{
		TeamID:   o.TeamID.DeepCopy(),
		Teamname: o.Teamname,
		Username: o.Username,
		Uid:      o.Uid.DeepCopy(),
		Id:       o.Id.DeepCopy(),
	}
}

type DeletedTeamInfo struct {
	TeamName  string        `codec:"teamName" json:"teamName"`
	DeletedBy string        `codec:"deletedBy" json:"deletedBy"`
	Id        gregor1.MsgID `codec:"id" json:"id"`
}

func (o DeletedTeamInfo) DeepCopy() DeletedTeamInfo {
	return DeletedTeamInfo{
		TeamName:  o.TeamName,
		DeletedBy: o.DeletedBy,
		Id:        o.Id.DeepCopy(),
	}
}

type WalletAccountInfo struct {
	AccountID string `codec:"accountID" json:"accountID"`
	NumUnread int    `codec:"numUnread" json:"numUnread"`
}

func (o WalletAccountInfo) DeepCopy() WalletAccountInfo {
	return WalletAccountInfo{
		AccountID: o.AccountID,
		NumUnread: o.NumUnread,
	}
}

type ResetState struct {
	EndTime Time `codec:"endTime" json:"end_time"`
	Active  bool `codec:"active" json:"active"`
}

func (o ResetState) DeepCopy() ResetState {
	return ResetState{
		EndTime: o.EndTime.DeepCopy(),
		Active:  o.Active,
	}
}

type BadgeState struct {
	NewTlfs                   int                     `codec:"newTlfs" json:"newTlfs"`
	RekeysNeeded              int                     `codec:"rekeysNeeded" json:"rekeysNeeded"`
	NewFollowers              int                     `codec:"newFollowers" json:"newFollowers"`
	InboxVers                 int                     `codec:"inboxVers" json:"inboxVers"`
	HomeTodoItems             int                     `codec:"homeTodoItems" json:"homeTodoItems"`
	UnverifiedEmails          int                     `codec:"unverifiedEmails" json:"unverifiedEmails"`
	UnverifiedPhones          int                     `codec:"unverifiedPhones" json:"unverifiedPhones"`
	NewDevices                []DeviceID              `codec:"newDevices" json:"newDevices"`
	RevokedDevices            []DeviceID              `codec:"revokedDevices" json:"revokedDevices"`
	Conversations             []BadgeConversationInfo `codec:"conversations" json:"conversations"`
	NewGitRepoGlobalUniqueIDs []string                `codec:"newGitRepoGlobalUniqueIDs" json:"newGitRepoGlobalUniqueIDs"`
	NewTeams                  []TeamID                `codec:"newTeams" json:"newTeams"`
	DeletedTeams              []DeletedTeamInfo       `codec:"deletedTeams" json:"deletedTeams"`
	NewTeamAccessRequests     []TeamID                `codec:"newTeamAccessRequests" json:"newTeamAccessRequests"`
	TeamsWithResetUsers       []TeamMemberOutReset    `codec:"teamsWithResetUsers" json:"teamsWithResetUsers"`
	UnreadWalletAccounts      []WalletAccountInfo     `codec:"unreadWalletAccounts" json:"unreadWalletAccounts"`
	ResetState                ResetState              `codec:"resetState" json:"resetState"`
}

func (o BadgeState) DeepCopy() BadgeState {
	return BadgeState{
		NewTlfs:          o.NewTlfs,
		RekeysNeeded:     o.RekeysNeeded,
		NewFollowers:     o.NewFollowers,
		InboxVers:        o.InboxVers,
		HomeTodoItems:    o.HomeTodoItems,
		UnverifiedEmails: o.UnverifiedEmails,
		UnverifiedPhones: o.UnverifiedPhones,
		NewDevices: (func(x []DeviceID) []DeviceID {
			if x == nil {
				return nil
			}
			ret := make([]DeviceID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.NewDevices),
		RevokedDevices: (func(x []DeviceID) []DeviceID {
			if x == nil {
				return nil
			}
			ret := make([]DeviceID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RevokedDevices),
		Conversations: (func(x []BadgeConversationInfo) []BadgeConversationInfo {
			if x == nil {
				return nil
			}
			ret := make([]BadgeConversationInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		NewGitRepoGlobalUniqueIDs: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.NewGitRepoGlobalUniqueIDs),
		NewTeams: (func(x []TeamID) []TeamID {
			if x == nil {
				return nil
			}
			ret := make([]TeamID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.NewTeams),
		DeletedTeams: (func(x []DeletedTeamInfo) []DeletedTeamInfo {
			if x == nil {
				return nil
			}
			ret := make([]DeletedTeamInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.DeletedTeams),
		NewTeamAccessRequests: (func(x []TeamID) []TeamID {
			if x == nil {
				return nil
			}
			ret := make([]TeamID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.NewTeamAccessRequests),
		TeamsWithResetUsers: (func(x []TeamMemberOutReset) []TeamMemberOutReset {
			if x == nil {
				return nil
			}
			ret := make([]TeamMemberOutReset, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TeamsWithResetUsers),
		UnreadWalletAccounts: (func(x []WalletAccountInfo) []WalletAccountInfo {
			if x == nil {
				return nil
			}
			ret := make([]WalletAccountInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.UnreadWalletAccounts),
		ResetState: o.ResetState.DeepCopy(),
	}
}

type BadgeConversationInfo struct {
	ConvID         ChatConversationID `codec:"convID" json:"convID"`
	BadgeCounts    map[DeviceType]int `codec:"badgeCounts" json:"badgeCounts"`
	UnreadMessages int                `codec:"unreadMessages" json:"unreadMessages"`
}

func (o BadgeConversationInfo) DeepCopy() BadgeConversationInfo {
	return BadgeConversationInfo{
		ConvID: o.ConvID.DeepCopy(),
		BadgeCounts: (func(x map[DeviceType]int) map[DeviceType]int {
			if x == nil {
				return nil
			}
			ret := make(map[DeviceType]int, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.BadgeCounts),
		UnreadMessages: o.UnreadMessages,
	}
}
