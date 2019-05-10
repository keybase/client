package chat

import (
	"context"
	"errors"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type teamMentionJob struct {
	uid               gregor1.UID
	maybeMention      chat1.MaybeMention
	knownTeamMentions []chat1.KnownTeamMention
	forceRemote       bool
}

type TeamMentionLoader struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler

	started    bool
	jobCh      chan teamMentionJob
	shutdownCh chan chan struct{}
}

func NewTeamMentionLoader(g *globals.Context) *TeamMentionLoader {
	return &TeamMentionLoader{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "TeamMentionLoader", false),
		jobCh:        make(chan teamMentionJob, 100),
		shutdownCh:   make(chan chan struct{}, 5),
	}
}

func (l *TeamMentionLoader) Start(ctx context.Context, uid gregor1.UID) {
	defer l.Trace(ctx, func() error { return nil }, "Start")()
	l.Lock()
	defer l.Unlock()
	if l.started {
		return
	}
	l.started = true
	go l.loadLoop()
}

func (l *TeamMentionLoader) Stop(ctx context.Context) chan struct{} {
	defer l.Trace(ctx, func() error { return nil }, "Stop")()
	l.Lock()
	defer l.Unlock()
	ch := make(chan struct{})
	if l.started {
		l.shutdownCh <- ch
		l.started = false
		return ch
	}
	close(ch)
	return ch
}

func (l *TeamMentionLoader) IsTeamMention(ctx context.Context, uid gregor1.UID,
	maybeMention chat1.MaybeMention, knownTeamMentions []chat1.KnownTeamMention) bool {
	if _, err := keybase1.TeamNameFromString(maybeMention.Name); err != nil {
		return false
	}
	for _, known := range knownTeamMentions {
		if known.Name == maybeMention.Name {
			return true
		}
	}
	res, err := l.G().InboxSource.IsTeam(ctx, uid, maybeMention.Name)
	if err != nil {
		l.Debug(ctx, "isTeam: failed to check if team: %s", err)
		return false
	}
	return res
}

func (l *TeamMentionLoader) LoadTeamMention(ctx context.Context, uid gregor1.UID,
	maybeMention chat1.MaybeMention, knownTeamMentions []chat1.KnownTeamMention, forceRemote bool) (err error) {
	defer l.Trace(ctx, func() error { return err }, "LoadTeamMention")()
	select {
	case l.jobCh <- teamMentionJob{
		uid:               uid,
		maybeMention:      maybeMention,
		knownTeamMentions: knownTeamMentions,
		forceRemote:       forceRemote,
	}:
	default:
		l.Debug(ctx, "Load: failed to queue job, full")
		return errors.New("queue full")
	}
	return nil
}

type mentionAPIResp struct {
	Status       libkb.AppStatus `json:"status"`
	Name         string
	InTeam       bool `json:"in_team"`
	Open         bool
	Description  string
	PublicAdmins []string `json:"public_admins"`
	NumMembers   int      `json:"num_members"`
}

func (r *mentionAPIResp) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func (l *TeamMentionLoader) getChatUI(ctx context.Context) (libkb.ChatUI, error) {
	ui, err := l.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		l.Debug(ctx, "getChatUI: no chat UI found: err: %s", err)
		if err == nil {
			err = errors.New("no chat UI found")
		}
		return nil, err
	}
	return ui, nil
}

func (l *TeamMentionLoader) loadMention(ctx context.Context, uid gregor1.UID,
	maybeMention chat1.MaybeMention, knownTeamMentions []chat1.KnownTeamMention,
	forceRemote bool) (err error) {
	defer l.Trace(ctx, func() error { return err }, "loadTeamMention: name: %s", maybeMention.Name)()
	ui, err := l.getChatUI(ctx)
	if err != nil {
		return err
	}
	if _, err := keybase1.TeamNameFromString(maybeMention.Name); err != nil {
		ui.ChatMaybeMentionUpdate(ctx, maybeMention.Name, maybeMention.Channel,
			chat1.NewUIMaybeMentionInfoWithNothing())
		return errors.New("not a team string")
	}
	if !forceRemote && !l.IsTeamMention(ctx, uid, maybeMention, knownTeamMentions) {
		ui.ChatMaybeMentionUpdate(ctx, maybeMention.Name, maybeMention.Channel,
			chat1.NewUIMaybeMentionInfoWithUnknown())
		return errors.New("not a team mention")
	}

	var info chat1.UITeamMention
	arg := libkb.APIArg{
		Endpoint:    "team/mentiondesc",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"name": libkb.S{Val: maybeMention.Name}},
	}
	var resp mentionAPIResp
	if err = l.G().API.GetDecode(libkb.NewMetaContext(ctx, l.G().ExternalG()), arg, &resp); err != nil {
		l.Debug(ctx, "loadMention: failed to get team info: %s", err)
		ui.ChatMaybeMentionUpdate(ctx, maybeMention.Name, maybeMention.Channel,
			chat1.NewUIMaybeMentionInfoWithNothing())
		return err
	}
	info.Open = resp.Open
	info.InTeam = resp.InTeam
	if len(resp.Description) > 0 {
		info.Description = new(string)
		*info.Description = resp.Description
	}
	if resp.NumMembers > 0 {
		info.NumMembers = new(int)
		*info.NumMembers = resp.NumMembers
	}
	info.PublicAdmins = resp.PublicAdmins

	if info.InTeam {
		var channel *string
		if len(maybeMention.Channel) > 0 {
			channel = new(string)
			*channel = maybeMention.Channel
		}
		convs, err := l.G().ChatHelper.FindConversations(ctx, maybeMention.Name, channel,
			chat1.TopicType_CHAT, chat1.ConversationMembersType_TEAM, keybase1.TLFVisibility_PRIVATE)
		if err != nil || len(convs) == 0 {
			l.Debug(ctx, "loadMention: failed to find conversation: %s", err)
		} else {
			info.ConvID = new(string)
			*info.ConvID = convs[0].GetConvID().String()
		}
	}
	return ui.ChatMaybeMentionUpdate(ctx, maybeMention.Name, maybeMention.Channel,
		chat1.NewUIMaybeMentionInfoWithTeam(info))
}

func (l *TeamMentionLoader) loadLoop() {
	ctx := context.Background()
	for {
		select {
		case job := <-l.jobCh:
			l.loadMention(ctx, job.uid, job.maybeMention, job.knownTeamMentions, job.forceRemote)
		case ch := <-l.shutdownCh:
			close(ch)
			return
		}
	}
}
