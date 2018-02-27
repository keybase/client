// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"bytes"
	"encoding/json"
	"sync"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// BadgeState represents the number of badges on the app. It's threadsafe.
// Useable from both the client service and gregor server.
// See service:Badger for the service part that owns this.
type BadgeState struct {
	sync.Mutex

	log   logger.Logger
	state keybase1.BadgeState

	inboxVers chat1.InboxVers
	// Map from ConversationID.String to BadgeConversationInfo.
	chatUnreadMap map[string]keybase1.BadgeConversationInfo
}

// NewBadgeState creates a new empty BadgeState.
func NewBadgeState(log logger.Logger) *BadgeState {
	return &BadgeState{
		log:           log,
		inboxVers:     chat1.InboxVers(0),
		chatUnreadMap: make(map[string]keybase1.BadgeConversationInfo),
	}
}

// Exports the state summary
func (b *BadgeState) Export() (keybase1.BadgeState, error) {
	b.Lock()
	defer b.Unlock()

	b.state.Conversations = []keybase1.BadgeConversationInfo{}
	for _, info := range b.chatUnreadMap {
		b.state.Conversations = append(b.state.Conversations, info)
	}
	b.state.InboxVers = int(b.inboxVers)

	return b.state, nil
}

type problemSetBody struct {
	Count int `json:"count"`
}

type newTeamBody struct {
	TeamID   string `json:"id"`
	TeamName string `json:"name"`
	Implicit bool   `json:"implicit_team"`
}

type memberOutBody struct {
	TeamName  string `json:"team_name"`
	ResetUser struct {
		UID      string `json:"uid"`
		Username string `json:"username"`
	} `json:"reset_user"`
}

type homeStateBody struct {
	Version        int           `json:"version"`
	BadgeCount     int           `json:"badge_count"`
	LastViewedTime keybase1.Time `json:"last_viewed_time"`
}

// UpdateWithGregor updates the badge state from a gregor state.
func (b *BadgeState) UpdateWithGregor(gstate gregor.State) error {
	b.Lock()
	defer b.Unlock()

	b.state.NewTlfs = 0
	b.state.NewFollowers = 0
	b.state.RekeysNeeded = 0
	b.state.NewGitRepoGlobalUniqueIDs = []string{}
	b.state.NewTeamNames = nil
	b.state.NewTeamAccessRequests = nil
	b.state.HomeTodoItems = 0
	b.state.TeamsWithResetUsers = nil

	var hsb *homeStateBody

	teamsWithResets := make(map[string]bool)

	items, err := gstate.Items()
	if err != nil {
		return err
	}
	for _, item := range items {
		categoryObj := item.Category()
		if categoryObj == nil {
			continue
		}
		category := categoryObj.String()
		switch category {
		case "home.state":
			var tmp homeStateBody
			byt := item.Body().Bytes()
			dec := json.NewDecoder(bytes.NewReader(byt))
			if err := dec.Decode(&tmp); err != nil {
				b.log.Warning("BadgeState got bad home.state object; error: %v; on %q", err, string(byt))
				continue
			}
			sentUp := false
			if hsb == nil || hsb.Version < tmp.Version || (hsb.Version == tmp.Version && hsb.LastViewedTime < tmp.LastViewedTime) {
				hsb = &tmp
				b.state.HomeTodoItems = hsb.BadgeCount
				sentUp = true
			}
			b.log.Debug("incoming home.state (sentUp=%v): %+v", sentUp, tmp)
		case "tlf":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.Warning("BadgeState encountered non-json 'tlf' item: %v", err)
				continue
			}
			itemType, err := jsw.AtKey("type").GetString()
			if err != nil {
				b.log.Warning("BadgeState encountered gregor 'tlf' item without 'type': %v", err)
				continue
			}
			if itemType != "created" {
				continue
			}
			b.state.NewTlfs++
		case "kbfs_tlf_problem_set_count", "kbfs_tlf_sbs_problem_set_count":
			var body problemSetBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.Warning("BadgeState encountered non-json 'problem set' item: %v", err)
				continue
			}
			b.state.RekeysNeeded += body.Count
		case "follow":
			b.state.NewFollowers++
		case "new_git_repo":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.Warning("BadgeState encountered non-json 'new_git_repo' item: %v", err)
				continue
			}
			globalUniqueID, err := jsw.AtKey("global_unique_id").GetString()
			if err != nil {
				b.log.Warning("BadgeState encountered gregor 'new_git_repo' item without 'global_unique_id': %v", err)
				continue
			}
			b.state.NewGitRepoGlobalUniqueIDs = append(b.state.NewGitRepoGlobalUniqueIDs, globalUniqueID)
		case "team.newly_added_to_team":
			var body []newTeamBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.Warning("BadgeState unmarshal error for team.newly_added_to_team item: %v", err)
				continue
			}
			for _, x := range body {
				if x.TeamName == "" {
					continue
				}
				if x.Implicit {
					continue
				}
				b.state.NewTeamNames = append(b.state.NewTeamNames, x.TeamName)
			}
		case "team.request_access":
			var body []newTeamBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.Warning("BadgeState unmarshal error for team.request_access item: %v", err)
				continue
			}
			for _, x := range body {
				if x.TeamName == "" {
					continue
				}
				b.state.NewTeamAccessRequests = append(b.state.NewTeamAccessRequests, x.TeamName)
			}
		case "team.member_out_from_reset":
			var body keybase1.TeamMemberOutFromReset
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.Warning("BadgeState unmarshal error for team.member_out_from_reset item: %v", err)
				continue
			}

			msgID := item.Metadata().MsgID().(gregor1.MsgID)
			m := keybase1.TeamMemberOutReset{
				Teamname: body.TeamName,
				Username: body.ResetUser.Username,
				Id:       msgID,
			}

			key := m.Teamname + "|" + m.Username
			if !teamsWithResets[key] {
				b.state.TeamsWithResetUsers = append(b.state.TeamsWithResetUsers, m)
				teamsWithResets[key] = true
			}
		}
	}

	return nil
}

func (b *BadgeState) UpdateWithChat(update chat1.UnreadUpdate, inboxVers chat1.InboxVers) {
	b.Lock()
	defer b.Unlock()

	// Skip stale updates
	if inboxVers < b.inboxVers {
		return
	}

	b.inboxVers = inboxVers
	b.updateWithChat(update)
}

func (b *BadgeState) UpdateWithChatFull(update chat1.UnreadUpdateFull) {
	b.Lock()
	defer b.Unlock()

	if update.Ignore {
		return
	}

	// Skip stale updates
	if update.InboxVers < b.inboxVers {
		return
	}

	switch update.InboxSyncStatus {
	case chat1.SyncInboxResType_CURRENT:
	case chat1.SyncInboxResType_INCREMENTAL:
	case chat1.SyncInboxResType_CLEAR:
		b.chatUnreadMap = make(map[string]keybase1.BadgeConversationInfo)
	}

	for _, upd := range update.Updates {
		b.updateWithChat(upd)
	}

	b.inboxVers = update.InboxVers
}

func (b *BadgeState) Clear() {
	b.Lock()
	defer b.Unlock()

	b.state = keybase1.BadgeState{}
	b.inboxVers = chat1.InboxVers(0)
	b.chatUnreadMap = make(map[string]keybase1.BadgeConversationInfo)
}

func (b *BadgeState) updateWithChat(update chat1.UnreadUpdate) {
	if update.Diff {
		cur := b.chatUnreadMap[update.ConvID.String()]
		cur.ConvID = keybase1.ChatConversationID(update.ConvID)
		cur.UnreadMessages += update.UnreadMessages
		if cur.BadgeCounts == nil {
			cur.BadgeCounts = make(map[keybase1.DeviceType]int)
		}
		for dt, c := range update.UnreadNotifyingMessages {
			cur.BadgeCounts[dt] += c
		}
		b.chatUnreadMap[update.ConvID.String()] = cur
	} else {
		b.chatUnreadMap[update.ConvID.String()] = keybase1.BadgeConversationInfo{
			ConvID:         keybase1.ChatConversationID(update.ConvID),
			UnreadMessages: update.UnreadMessages,
			BadgeCounts:    update.UnreadNotifyingMessages,
		}
	}
}

func (b *BadgeState) FindResetMemberBadges(teamName string) (badges []keybase1.TeamMemberOutReset) {
	b.Lock()
	defer b.Unlock()

	for _, badge := range b.state.TeamsWithResetUsers {
		if badge.Teamname != teamName {
			continue
		}
		badges = append(badges, badge)
	}

	return badges
}
