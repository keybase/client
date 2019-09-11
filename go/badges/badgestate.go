// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"bytes"
	"encoding/json"
	"sync"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

type LocalChatState interface {
	ApplyLocalChatState(context.Context, []keybase1.BadgeConversationInfo) []keybase1.BadgeConversationInfo
}

type dummyLocalChatState struct{}

func (d dummyLocalChatState) ApplyLocalChatState(ctx context.Context, i []keybase1.BadgeConversationInfo) []keybase1.BadgeConversationInfo {
	return i
}

// BadgeState represents the number of badges on the app. It's threadsafe.
// Useable from both the client service and gregor server.
// See service:Badger for the service part that owns this.
type BadgeState struct {
	sync.Mutex

	localChatState LocalChatState
	log            logger.Logger
	env            *libkb.Env
	state          keybase1.BadgeState

	inboxVers chat1.InboxVers
	// Map from ConversationID.String to BadgeConversationInfo.
	chatUnreadMap map[string]keybase1.BadgeConversationInfo

	walletUnreadMap map[stellar1.AccountID]int
}

// NewBadgeState creates a new empty BadgeState.
func NewBadgeState(log logger.Logger, env *libkb.Env) *BadgeState {
	return newBadgeState(log, env)
}

// NewBadgeState creates a new empty BadgeState in contexts
// where notifications do not need to be handled.
func NewBadgeStateForServer(log logger.Logger) *BadgeState {
	return newBadgeState(log, nil)
}

func newBadgeState(log logger.Logger, env *libkb.Env) *BadgeState {
	return &BadgeState{
		log:             log,
		env:             env,
		inboxVers:       chat1.InboxVers(0),
		chatUnreadMap:   make(map[string]keybase1.BadgeConversationInfo),
		walletUnreadMap: make(map[stellar1.AccountID]int),
		localChatState:  dummyLocalChatState{},
	}
}

func (b *BadgeState) SetLocalChatState(s LocalChatState) {
	b.localChatState = s
}

// Exports the state summary
func (b *BadgeState) Export(ctx context.Context) (keybase1.BadgeState, error) {
	b.Lock()
	defer b.Unlock()

	b.state.Conversations = []keybase1.BadgeConversationInfo{}
	for _, info := range b.chatUnreadMap {
		b.state.Conversations = append(b.state.Conversations, info)
	}
	b.state.Conversations = b.localChatState.ApplyLocalChatState(ctx, b.state.Conversations)
	b.state.InboxVers = int(b.inboxVers)

	b.state.UnreadWalletAccounts = []keybase1.WalletAccountInfo{}
	for accountID, count := range b.walletUnreadMap {
		info := keybase1.WalletAccountInfo{AccountID: string(accountID), NumUnread: count}
		b.state.UnreadWalletAccounts = append(b.state.UnreadWalletAccounts, info)
	}

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

type teamDeletedBody struct {
	TeamID   string `json:"id"`
	TeamName string `json:"name"`
	Implicit bool   `json:"implicit_team"`
	OpBy     struct {
		UID      string `json:"uid"`
		Username string `json:"username"`
	} `json:"op_by"`
}

type unverifiedCountBody struct {
	UnverifiedCount int `json:"unverified_count"`
}

type homeTodoMap map[keybase1.HomeScreenTodoType]int
type homeItemMap map[keybase1.HomeScreenItemType]homeTodoMap

type homeStateBody struct {
	Version              int           `json:"version"`
	BadgeCountMap        homeItemMap   `json:"badge_count_map"`
	LastViewedTime       keybase1.Time `json:"last_viewed_time"`
	AnnouncementsVersion int           `json:"announcements_version"`
}

// countKnownBadges looks at the map sent down by gregor and considers only those
// types that are known to the client. The rest, it assumes it cannot display,
// and doesn't count those badges toward the badge count. Note that the shape
// of this map is two-deep.
//
//   { 1 : { 2 : 3, 4 : 5 }, 3 : { 10001 : 1 } }
//
// Implies that are 3 badges on TODO type PROOF, 5 badges on TODO type FOLLOW,
// and 1 badges in ANNOUNCEMENTs.
//
func countKnownBadges(m homeItemMap) int {
	var ret int
	for itemType, todoMap := range m {
		if _, found := keybase1.HomeScreenItemTypeRevMap[itemType]; !found {
			continue
		}
		for todoType, v := range todoMap {
			_, found := keybase1.HomeScreenTodoTypeRevMap[todoType]
			if (itemType == keybase1.HomeScreenItemType_TODO && found) ||
				(itemType == keybase1.HomeScreenItemType_ANNOUNCEMENT && todoType >= keybase1.HomeScreenTodoType_ANNONCEMENT_PLACEHOLDER) {
				ret += v
			}
		}
	}
	return ret
}

func homeStateLessThan(a *homeStateBody, b homeStateBody) bool {
	if a == nil {
		return true
	}
	if a.Version < b.Version {
		return true
	}
	if a.Version == b.Version && a.LastViewedTime < b.LastViewedTime {
		return true
	}
	if a.AnnouncementsVersion < b.AnnouncementsVersion {
		return true
	}
	return false
}

func (b *BadgeState) ConversationBadge(ctx context.Context, convID chat1.ConversationID,
	deviceType keybase1.DeviceType) int {
	if info, ok := b.chatUnreadMap[convID.String()]; ok {
		return info.BadgeCounts[deviceType]
	}
	return 0
}

// UpdateWithGregor updates the badge state from a gregor state.
func (b *BadgeState) UpdateWithGregor(ctx context.Context, gstate gregor.State) error {
	b.Lock()
	defer b.Unlock()

	b.state.NewTlfs = 0
	b.state.NewFollowers = 0
	b.state.RekeysNeeded = 0
	b.state.NewGitRepoGlobalUniqueIDs = []string{}
	b.state.NewDevices = []keybase1.DeviceID{}
	b.state.RevokedDevices = []keybase1.DeviceID{}
	b.state.NewTeamNames = nil
	b.state.DeletedTeams = nil
	b.state.NewTeamAccessRequests = nil
	b.state.HomeTodoItems = 0
	b.state.TeamsWithResetUsers = nil
	b.state.ResetState = keybase1.ResetState{}
	b.state.UnverifiedEmails = 0
	b.state.UnverifiedPhones = 0

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
				b.log.CDebugf(ctx, "BadgeState got bad home.state object; error: %v; on %q", err, string(byt))
				continue
			}
			sentUp := false
			if homeStateLessThan(hsb, tmp) {
				hsb = &tmp
				b.state.HomeTodoItems = countKnownBadges(hsb.BadgeCountMap)
				sentUp = true
			}
			b.log.Debug("incoming home.state (sentUp=%v): %+v", sentUp, tmp)
		case "tlf":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'tlf' item: %v", err)
				continue
			}
			itemType, err := jsw.AtKey("type").GetString()
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered gregor 'tlf' item without 'type': %v", err)
				continue
			}
			if itemType != "created" {
				continue
			}
			b.state.NewTlfs++
		case "kbfs_tlf_problem_set_count", "kbfs_tlf_sbs_problem_set_count":
			var body problemSetBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'problem set' item: %v", err)
				continue
			}
			b.state.RekeysNeeded += body.Count
		case "follow":
			b.state.NewFollowers++
		case "device.new":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'device.new' item: %v", err)
				continue
			}
			newDeviceID, err := jsw.AtKey("device_id").GetString()
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered gregor 'device.new' item without 'device_id': %v", err)
				continue
			}
			b.state.NewDevices = append(b.state.NewDevices, keybase1.DeviceID(newDeviceID))
		case "device.revoked":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'device.revoked' item: %v", err)
				continue
			}
			revokedDeviceID, err := jsw.AtKey("device_id").GetString()
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered gregor 'device.revoked' item without 'device_id': %v", err)
				continue
			}
			b.state.RevokedDevices = append(b.state.RevokedDevices, keybase1.DeviceID(revokedDeviceID))
		case "new_git_repo":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'new_git_repo' item: %v", err)
				continue
			}
			globalUniqueID, err := jsw.AtKey("global_unique_id").GetString()
			if err != nil {
				b.log.CDebugf(ctx,
					"BadgeState encountered gregor 'new_git_repo' item without 'global_unique_id': %v", err)
				continue
			}
			b.state.NewGitRepoGlobalUniqueIDs = append(b.state.NewGitRepoGlobalUniqueIDs, globalUniqueID)
		case "team.newly_added_to_team":
			var body []newTeamBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState unmarshal error for team.newly_added_to_team item: %v", err)
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
		case "team.delete":
			var body []teamDeletedBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState unmarshal error for team.delete item: %v", err)
				continue
			}

			msgID := item.Metadata().MsgID().(gregor1.MsgID)
			var username string
			if b.env != nil {
				username = b.env.GetUsername().String()
			}
			for _, x := range body {
				if x.TeamName == "" || x.OpBy.Username == "" || x.OpBy.Username == username {
					continue
				}
				if x.Implicit {
					continue
				}
				b.state.DeletedTeams = append(b.state.DeletedTeams, keybase1.DeletedTeamInfo{
					TeamName:  x.TeamName,
					DeletedBy: x.OpBy.Username,
					Id:        msgID,
				})
			}
		case "team.request_access":
			var body []newTeamBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState unmarshal error for team.request_access item: %v", err)
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
				b.log.CDebugf(ctx, "BadgeState unmarshal error for team.member_out_from_reset item: %v", err)
				continue
			}

			if body.ResetUser.IsDelete {
				b.log.CDebugf(ctx, "BadgeState ignoring member_out_from_reset for deleted user")
				continue
			}

			msgID := item.Metadata().MsgID().(gregor1.MsgID)
			m := keybase1.TeamMemberOutReset{
				Teamname: body.TeamName,
				Uid:      body.ResetUser.Uid,
				Username: body.ResetUser.Username,
				Id:       msgID,
			}

			key := m.Teamname + "|" + m.Username
			if !teamsWithResets[key] {
				b.state.TeamsWithResetUsers = append(b.state.TeamsWithResetUsers, m)
				teamsWithResets[key] = true
			}
		case "autoreset":
			var body keybase1.ResetState
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'autoreset' item: %v", err)
				continue
			}
			b.state.ResetState = body
		case "email.unverified_count":
			var body unverifiedCountBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'email.unverified_count' item: %v", err)
				continue
			}
			b.state.UnverifiedEmails = body.UnverifiedCount
		case "phone.unverified_count":
			var body unverifiedCountBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'phone.unverified_count' item: %v", err)
				continue
			}
			b.state.UnverifiedPhones = body.UnverifiedCount
		}
	}

	return nil
}

func (b *BadgeState) UpdateWithChat(ctx context.Context, update chat1.UnreadUpdate,
	inboxVers chat1.InboxVers) {
	b.Lock()
	defer b.Unlock()

	// Skip stale updates
	if inboxVers < b.inboxVers {
		return
	}

	b.inboxVers = inboxVers
	b.updateWithChat(ctx, update)
}

func (b *BadgeState) UpdateWithChatFull(ctx context.Context, update chat1.UnreadUpdateFull) {
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
		b.updateWithChat(ctx, upd)
	}

	b.inboxVers = update.InboxVers
}

func (b *BadgeState) Clear() {
	b.Lock()
	defer b.Unlock()

	b.state = keybase1.BadgeState{}
	b.inboxVers = chat1.InboxVers(0)
	b.chatUnreadMap = make(map[string]keybase1.BadgeConversationInfo)
	b.walletUnreadMap = make(map[stellar1.AccountID]int)
}

func (b *BadgeState) updateWithChat(ctx context.Context, update chat1.UnreadUpdate) {
	b.log.CDebugf(ctx, "updateWithChat: %s", update)
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

// SetWalletAccountUnreadCount sets the unread count for a wallet account.
// It returns true if the call changed the unread count for accountID.
func (b *BadgeState) SetWalletAccountUnreadCount(accountID stellar1.AccountID, unreadCount int) bool {
	b.Lock()
	existingCount := b.walletUnreadMap[accountID]
	b.walletUnreadMap[accountID] = unreadCount
	b.Unlock()

	// did this call change the unread count for this accountID?
	changed := unreadCount != existingCount

	return changed
}
