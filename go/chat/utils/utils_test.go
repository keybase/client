package utils

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func TestParseDurationExtended(t *testing.T) {
	test := func(input string, expected time.Duration) {
		d, err := ParseDurationExtended(input)
		if err != nil {
			t.Fatal(err)
		}
		if d != expected {
			t.Fatalf("wrong parsed duration. Expected %v, got %v\n", expected, d)
		}
	}
	test("1d", time.Hour*24)
	test("123d12h2ns", 123*24*time.Hour+12*time.Hour+2*time.Nanosecond)
}

func TestParseAtMentionsNames(t *testing.T) {
	text := "@chat_1e2263952c hello! @mike From @chat_5511c5e0ce. @ksjdskj 889@ds8 @_dskdjs @k1 @0011_"
	matches := ParseAtMentionsNames(context.TODO(), text)
	expected := []string{"chat_1e2263952c", "mike", "chat_5511c5e0ce", "ksjdskj", "k1", "0011_"}
	require.Equal(t, expected, matches)
	text = "@mike@jim"
	matches = ParseAtMentionsNames(context.TODO(), text)
	expected = []string{"mike"}
	require.Equal(t, expected, matches)
}

type testTeamChannelSource struct {
	channels []string
}

var _ types.TeamChannelSource = (*testTeamChannelSource)(nil)

func newTestTeamChannelSource(channels []string) *testTeamChannelSource {
	return &testTeamChannelSource{
		channels: channels,
	}
}

func (t *testTeamChannelSource) GetChannelsTopicName(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ChannelNameMention, rl []chat1.RateLimit, err error) {
	for _, c := range t.channels {
		res = append(res, chat1.ChannelNameMention{
			TopicName: c,
		})
	}
	return res, rl, nil
}

func (t *testTeamChannelSource) GetChannelTopicName(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType, convID chat1.ConversationID) (string, []chat1.RateLimit, error) {
	return "", nil, fmt.Errorf("testTeamChannelSource.GetChannelTopicName not implemented")
}

func (t *testTeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {
	return res, rl, nil
}

func (t *testTeamChannelSource) ChannelsChanged(ctx context.Context, teamID chat1.TLFID) {}

func (t *testTeamChannelSource) IsOffline(ctx context.Context) bool {
	return false
}

func (t *testTeamChannelSource) Connected(ctx context.Context)    {}
func (t *testTeamChannelSource) Disconnected(ctx context.Context) {}

func TestParseChannelNameMentions(t *testing.T) {
	uid := gregor1.UID{0}
	teamID := chat1.TLFID{0}
	chans := []string{"general", "random", "miketime"}
	text := "#miketime is secret. #general has everyone. #random exists. #offtopic does not."
	matches := ParseChannelNameMentions(context.TODO(), text, uid, teamID,
		newTestTeamChannelSource(chans))
	expected := []chat1.ChannelNameMention{
		chat1.ChannelNameMention{TopicName: "miketime"},
		chat1.ChannelNameMention{TopicName: "general"},
		chat1.ChannelNameMention{TopicName: "random"},
	}
	require.Equal(t, expected, matches)
}

type testUIDSource struct {
	users map[string]keybase1.UID
}

func newTestUIDSource() *testUIDSource {
	return &testUIDSource{
		users: make(map[string]keybase1.UID),
	}
}

func (s *testUIDSource) LookupUID(ctx context.Context, un libkb.NormalizedUsername) (uid keybase1.UID, err error) {
	var ok bool
	if uid, ok = s.users[un.String()]; ok {
		return uid, nil
	}
	return uid, errors.New("invalid username")
}

func (s *testUIDSource) AddUser(username string, uid gregor1.UID) {
	s.users[username] = keybase1.UID(uid.String())
}

func TestSystemMessageMentions(t *testing.T) {
	// test all the system message types gives us the right mentions
	u1 := gregor1.UID([]byte{4, 5, 6})
	u2 := gregor1.UID([]byte{4, 5, 7})
	u3 := gregor1.UID([]byte{4, 5, 8})
	u1name := "mike"
	u2name := "lisa"
	u3name := "sara"
	usource := newTestUIDSource()
	usource.AddUser(u1name, u1)
	usource.AddUser(u2name, u2)
	usource.AddUser(u3name, u3)
	body := chat1.NewMessageSystemWithAddedtoteam(chat1.MessageSystemAddedToTeam{
		Adder: u1name,
		Addee: u2name,
	})
	atMentions, chanMention := SystemMessageMentions(context.TODO(), body, usource)
	require.Equal(t, 1, len(atMentions))
	require.Equal(t, u2, atMentions[0])
	require.Equal(t, chat1.ChannelMention_NONE, chanMention)
	body = chat1.NewMessageSystemWithInviteaddedtoteam(chat1.MessageSystemInviteAddedToTeam{
		Invitee: u3name,
		Inviter: u1name,
		Adder:   u2name,
	})
	atMentions, chanMention = SystemMessageMentions(context.TODO(), body, usource)
	require.Equal(t, 2, len(atMentions))
	require.Equal(t, u1, atMentions[0])
	require.Equal(t, u3, atMentions[1])
	require.Equal(t, chat1.ChannelMention_NONE, chanMention)
	body = chat1.NewMessageSystemWithComplexteam(chat1.MessageSystemComplexTeam{
		Team: "MIKE",
	})
	atMentions, chanMention = SystemMessageMentions(context.TODO(), body, usource)
	require.Zero(t, len(atMentions))
	require.Equal(t, chat1.ChannelMention_ALL, chanMention)
}
