package chat

import (
	"context"
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type msgGrouper interface {
	// matches indicates if the given message matches the current group
	matches(context.Context, chat1.MessageUnboxed, []chat1.MessageUnboxed) bool
	// makeCombined outputs a single message from a given group or nil
	makeCombined(context.Context, []chat1.MessageUnboxed) *chat1.MessageUnboxed
}

func groupGeneric(ctx context.Context, msgs []chat1.MessageUnboxed, msgGrouper msgGrouper) (res []chat1.MessageUnboxed) {
	var grouped []chat1.MessageUnboxed
	addGrouped := func() {
		if len(grouped) == 0 {
			return
		}
		msg := msgGrouper.makeCombined(ctx, grouped)
		if msg != nil {
			res = append(res, *msg)
		}
		grouped = nil
	}
	for _, msg := range msgs {
		if msgGrouper.matches(ctx, msg, grouped) {
			grouped = append(grouped, msg)
			continue
		}
		addGrouped()
		// some match functions may depend on messages in grouped, so after we clear it
		// this message might be a candidate to get grouped.
		if msgGrouper.matches(ctx, msg, grouped) {
			grouped = append(grouped, msg)
		} else {
			res = append(res, msg)
		}
	}
	addGrouped()
	return res
}

// group JOIN/LEAVE messages
type joinLeaveGrouper struct {
	uid gregor1.UID
}

var _ msgGrouper = (*joinLeaveGrouper)(nil)

func newJoinLeaveGrouper(g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	dataSource types.InboxSourceDataSourceTyp) *joinLeaveGrouper {
	return &joinLeaveGrouper{
		uid: uid,
	}
}

func (gr *joinLeaveGrouper) matches(ctx context.Context, msg chat1.MessageUnboxed, grouped []chat1.MessageUnboxed) bool {
	if !msg.IsValid() || msg.Valid().ClientHeader.Sender.Eq(gr.uid) {
		return false
	}
	body := msg.Valid().MessageBody
	if !(body.IsType(chat1.MessageType_JOIN) || body.IsType(chat1.MessageType_LEAVE)) {
		return false
	}
	for _, g := range grouped {
		if g.Valid().SenderUsername == msg.Valid().SenderUsername {
			return false
		}
	}
	return true
}

func (gr *joinLeaveGrouper) makeCombined(ctx context.Context, grouped []chat1.MessageUnboxed) *chat1.MessageUnboxed {
	var joiners, leavers []string
	for _, j := range grouped {
		if j.Valid().MessageBody.IsType(chat1.MessageType_JOIN) {
			joiners = append(joiners, j.Valid().SenderUsername)
		} else {
			leavers = append(leavers, j.Valid().SenderUsername)
		}
	}
	mvalid := grouped[0].Valid()
	mvalid.ClientHeader.MessageType = chat1.MessageType_JOIN
	mvalid.MessageBody = chat1.NewMessageBodyWithJoin(chat1.MessageJoin{
		Joiners: joiners,
		Leavers: leavers,
	})
	msg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &msg
}

// group BULKADDTOCONV system messages
type bulkAddGrouper struct {
	globals.Contextified
	// uid set of active users
	activeMap  map[string]struct{}
	uid        gregor1.UID
	convID     chat1.ConversationID
	dataSource types.InboxSourceDataSourceTyp
}

var _ msgGrouper = (*bulkAddGrouper)(nil)

func newBulkAddGrouper(g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	dataSource types.InboxSourceDataSourceTyp) *bulkAddGrouper {
	return &bulkAddGrouper{
		Contextified: globals.NewContextified(g),
		uid:          uid,
		convID:       convID,
		dataSource:   dataSource,
	}
}

func (gr *bulkAddGrouper) matches(ctx context.Context, msg chat1.MessageUnboxed, grouped []chat1.MessageUnboxed) bool {
	if !msg.IsValid() {
		return false
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_SYSTEM) {
		return false
	}
	sysBod := msg.Valid().MessageBody.System()
	typ, err := sysBod.SystemType()
	return err == nil && typ == chat1.MessageSystemType_BULKADDTOCONV
}

func (gr *bulkAddGrouper) makeCombined(ctx context.Context, grouped []chat1.MessageUnboxed) *chat1.MessageUnboxed {
	var filteredUsernames, usernames []string
	for _, j := range grouped {
		if j.Valid().MessageBody.IsType(chat1.MessageType_SYSTEM) {
			body := j.Valid().MessageBody.System()
			typ, err := body.SystemType()
			if err == nil && typ == chat1.MessageSystemType_BULKADDTOCONV {
				usernames = append(usernames, body.Bulkaddtoconv().Usernames...)
			}
		}
	}

	if gr.activeMap == nil && len(usernames) > 0 {
		gr.activeMap = make(map[string]struct{})
		allList, err := gr.G().ParticipantsSource.Get(ctx, gr.uid, gr.convID, gr.dataSource)
		if err == nil {
			for _, uid := range allList {
				gr.activeMap[uid.String()] = struct{}{}
			}
		}
	}

	// filter the usernames for people that are actually part of the team
	seen := make(map[string]bool)
	for _, username := range usernames {
		uid, err := gr.G().GetUPAKLoader().LookupUID(ctx, libkb.NewNormalizedUsername(username))
		if err != nil {
			continue
		}
		if _, ok := gr.activeMap[uid.String()]; ok && !seen[username] {
			filteredUsernames = append(filteredUsernames, username)
			seen[username] = true
		}
	}
	if len(filteredUsernames) == 0 {
		return nil
	}

	mvalid := grouped[0].Valid()
	mvalid.ClientHeader.MessageType = chat1.MessageType_SYSTEM
	mvalid.MessageBody = chat1.NewMessageBodyWithSystem(chat1.NewMessageSystemWithBulkaddtoconv(chat1.MessageSystemBulkAddToConv{
		Usernames: filteredUsernames,
	}))
	msg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &msg
}

// group NEWCHANNEL system messages
type channelGrouper struct {
	uid gregor1.UID
}

var _ msgGrouper = (*channelGrouper)(nil)

func newChannelGrouper(g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	dataSource types.InboxSourceDataSourceTyp) *channelGrouper {
	return &channelGrouper{
		uid: uid,
	}
}

func (gr *channelGrouper) matches(ctx context.Context, msg chat1.MessageUnboxed, grouped []chat1.MessageUnboxed) bool {
	if !msg.IsValid() {
		return false
	}
	if len(grouped) > 0 && !grouped[0].SenderEq(msg) {
		return false
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_SYSTEM) {
		return false
	}
	sysBod := msg.Valid().MessageBody.System()
	typ, err := sysBod.SystemType()
	return err == nil && typ == chat1.MessageSystemType_NEWCHANNEL
}

func (gr *channelGrouper) makeCombined(ctx context.Context, grouped []chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if len(grouped) == 0 {
		return nil
	}

	var convIDs []chat1.ConversationID
	var mentions []chat1.ChannelNameMention
	for _, msg := range grouped {
		convIDs = append(convIDs, msg.Valid().MessageBody.System().Newchannel().ConvID)
		mentions = append(mentions, msg.Valid().ChannelNameMentions...)
	}

	mvalid := grouped[0].Valid()
	sysBod := mvalid.MessageBody.System().Newchannel()
	sysBod.ConvIDs = convIDs
	mvalid.ChannelNameMentions = mentions
	mvalid.MessageBody = chat1.NewMessageBodyWithSystem(chat1.NewMessageSystemWithNewchannel(sysBod))
	msg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &msg
}

// group ADDEDTOTEAM system messages
type addedToTeamGrouper struct {
	globals.Contextified
	uid         gregor1.UID
	ownUsername string
}

var _ msgGrouper = (*addedToTeamGrouper)(nil)

func newAddedToTeamGrouper(g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	dataSource types.InboxSourceDataSourceTyp) *addedToTeamGrouper {
	return &addedToTeamGrouper{
		Contextified: globals.NewContextified(g),
		uid:          uid,
	}
}

func (gr *addedToTeamGrouper) matches(ctx context.Context, msg chat1.MessageUnboxed, grouped []chat1.MessageUnboxed) bool {
	if !(msg.IsValid() && msg.Valid().ClientHeader.Sender.Eq(gr.uid)) {
		return false
	}
	if len(grouped) > 0 && !grouped[0].SenderEq(msg) {
		return false
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_SYSTEM) {
		return false
	}
	sysBod := msg.Valid().MessageBody.System()
	typ, err := sysBod.SystemType()
	if !(err == nil && typ == chat1.MessageSystemType_ADDEDTOTEAM) {
		return false
	}
	// We want to show a link to the bot settings
	if sysBod.Addedtoteam().Role.IsRestrictedBot() {
		return false
	}
	if gr.ownUsername == "" {
		un, err := gr.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(gr.uid.String()))
		if err == nil {
			gr.ownUsername = un.String()
		}
	}
	if gr.ownUsername == sysBod.Addedtoteam().Addee {
		return false
	}
	return true
}

func (gr *addedToTeamGrouper) makeCombined(ctx context.Context, grouped []chat1.MessageUnboxed) *chat1.MessageUnboxed {
	usernames := map[string]struct{}{}
	for _, j := range grouped {
		if j.Valid().MessageBody.IsType(chat1.MessageType_SYSTEM) {
			body := j.Valid().MessageBody.System()
			typ, err := body.SystemType()
			if err == nil && typ == chat1.MessageSystemType_ADDEDTOTEAM {
				sysBod := body.Addedtoteam()
				usernames[sysBod.Addee] = struct{}{}
			}
		}
	}
	if len(usernames) == 0 {
		return nil
	}

	bulkAdds := make([]string, 0, len(usernames))
	for username := range usernames {
		bulkAdds = append(bulkAdds, username)
	}

	mvalid := grouped[0].Valid()
	mvalid.ClientHeader.MessageType = chat1.MessageType_SYSTEM
	mvalid.MessageBody = chat1.NewMessageBodyWithSystem(chat1.NewMessageSystemWithAddedtoteam(chat1.MessageSystemAddedToTeam{
		BulkAdds: bulkAdds,
		Adder:    mvalid.MessageBody.System().Addedtoteam().Adder,
	}))
	msg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &msg
}

// group duplicate errors
type errGrouper struct{}

var _ msgGrouper = (*errGrouper)(nil)

func newErrGrouper(*globals.Context, gregor1.UID, chat1.ConversationID,
	types.InboxSourceDataSourceTyp) *errGrouper {
	return &errGrouper{}
}

func (gr *errGrouper) matches(ctx context.Context, msg chat1.MessageUnboxed, grouped []chat1.MessageUnboxed) bool {
	if !msg.IsError() {
		return false
	} else if msg.Error().IsEphemeralError() && msg.Error().IsEphemeralExpired(time.Now()) {
		return false
	}
	if len(grouped) > 0 && !grouped[0].SenderEq(msg) {
		return false
	}
	return true
}

func (gr *errGrouper) makeCombined(ctx context.Context, grouped []chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if len(grouped) == 0 {
		return nil
	}

	merr := grouped[0].Error()
	if grouped[0].IsEphemeral() {
		merr.ErrMsg = ephemeral.PluralizeErrorMessage(merr.ErrMsg, len(grouped))
	} else if len(grouped) > 1 {
		merr.ErrMsg = fmt.Sprintf("%s (occurred %d times)", merr.ErrMsg, len(grouped))
	}
	msg := chat1.NewMessageUnboxedWithError(merr)
	return &msg
}
