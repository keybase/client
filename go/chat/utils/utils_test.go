package utils

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
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
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ChannelNameMention, err error) {
	for _, c := range t.channels {
		res = append(res, chat1.ChannelNameMention{
			TopicName: c,
		})
	}
	return res, nil
}

func (t *testTeamChannelSource) GetChannelTopicName(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType, convID chat1.ConversationID) (string, error) {
	return "", fmt.Errorf("testTeamChannelSource.GetChannelTopicName not implemented")
}

func (t *testTeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ConversationLocal, err error) {
	return res, nil
}

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

func TestFormatVideoDuration(t *testing.T) {
	testCase := func(ms int, expected string) {
		require.Equal(t, expected, formatVideoDuration(ms))
	}
	testCase(1000, "0:01")
	testCase(10000, "0:10")
	testCase(60000, "1:00")
	testCase(60001, "1:00")
	testCase(72000, "1:12")
	testCase(3600000, "1:00:00")
	testCase(4500000, "1:15:00")
	testCase(4536000, "1:15:36")
	testCase(3906000, "1:05:06")
}

func TestGetQueryRe(t *testing.T) {
	queries := []string{
		"foo",
		"foo bar",
		"foo bar, baz? :+1:",
	}
	expectedRe := []string{
		"foo",
		"foo bar",
		"foo bar, baz\\? :\\+1:",
	}
	for i, query := range queries {
		re, err := GetQueryRe(query)
		require.NoError(t, err)
		expected := regexp.MustCompile("(?i)" + expectedRe[i])
		require.Equal(t, expected, re)
		t.Logf("query: %v, expectedRe: %v, re: %v", query, expectedRe, re)
		ok := re.MatchString(query)
		require.True(t, ok)
	}
}

type decorateMentionTest struct {
	body                string
	atMentions          []string
	chanMention         chat1.ChannelMention
	channelNameMentions []chat1.ChannelNameMention
	result              string
}

func TestDecorateMentions(t *testing.T) {
	convID := chat1.ConversationID([]byte{1, 2, 3, 4})
	cases := []decorateMentionTest{
		decorateMentionTest{
			body:       "@mikem fix something",
			atMentions: []string{"mikem"},
			// {"typ":1,"atmention":"mikem"}
			result: "$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$ fix something",
		},
		decorateMentionTest{
			body:        "@mikem,@max please check out #general, also @here you should too",
			atMentions:  []string{"mikem", "max"},
			chanMention: chat1.ChannelMention_HERE,
			channelNameMentions: []chat1.ChannelNameMention{chat1.ChannelNameMention{
				ConvID:    convID,
				TopicName: "general",
			}},
			// {"typ":1,"atmention":"mikem"}
			// {"typ":1,"atmention":"max"}
			// {"typ":2,"channelnamemention":{"name":"general","convID":"01020304"}}
			// {"typ":1,"atmention":"here"}
			result: "$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$,$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1heCJ9$<kb$ please check out $>kb$eyJ0eXAiOjIsImNoYW5uZWxuYW1lbWVudGlvbiI6eyJuYW1lIjoiZ2VuZXJhbCIsImNvbnZJRCI6IjAxMDIwMzA0In19$<kb$, also $>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6ImhlcmUifQ==$<kb$ you should too",
		},
		decorateMentionTest{
			body:       "@mikem talk to @patrick",
			atMentions: []string{"mikem"},
			result:     "$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$ talk to @patrick",
		},
		decorateMentionTest{
			body:   "see #general",
			result: "see #general",
		},
		decorateMentionTest{
			body:   "@here what are you doing!",
			result: "@here what are you doing!",
		},
	}
	for _, c := range cases {
		res := DecorateWithMentions(context.TODO(), c.body, c.atMentions, c.chanMention,
			c.channelNameMentions)
		require.Equal(t, c.result, res)
	}
}

type configUsernamer struct {
	libkb.ConfigReader
	username libkb.NormalizedUsername
}

func (c configUsernamer) GetUsername() libkb.NormalizedUsername {
	return c.username
}

func TestAddUserToTlfName(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat-utils", 0)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	g.Env.SetConfig(
		&configUsernamer{g.Env.GetConfig(), "charlie"}, g.Env.GetConfigWriter())

	priv := keybase1.TLFVisibility_PRIVATE
	mem := chat1.ConversationMembersType_IMPTEAMNATIVE
	s := AddUserToTLFName(g, "alice,bob", priv, mem)
	require.Equal(t, "alice,bob,charlie", s)
	s = AddUserToTLFName(g, "charlie", priv, mem)
	require.Equal(t, "charlie,charlie", s)
	s = AddUserToTLFName(
		g, "alice,bob (conflicted copy 2019-02-14 #1)", priv, mem)
	require.Equal(t, "alice,bob,charlie (conflicted copy 2019-02-14 #1)", s)
	s = AddUserToTLFName(
		g, "alice#bob", priv, mem)
	require.Equal(t, "alice,charlie#bob", s)
	s = AddUserToTLFName(
		g, "alice#bob (conflicted copy 2019-02-14 #1)", priv, mem)
	require.Equal(t, "alice,charlie#bob (conflicted copy 2019-02-14 #1)", s)

	pub := keybase1.TLFVisibility_PUBLIC
	s = AddUserToTLFName(g, "alice,bob", pub, mem)
	require.Equal(t, "alice,bob", s)
}
