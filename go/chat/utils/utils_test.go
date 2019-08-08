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
			body:        "@mikem,@max @mikem/@max please check out #general, also @here you should too",
			atMentions:  []string{"mikem", "max"},
			chanMention: chat1.ChannelMention_HERE,
			channelNameMentions: []chat1.ChannelNameMention{chat1.ChannelNameMention{
				ConvID:    convID,
				TopicName: "general",
			}},
			// {"typ":1,"atmention":"mikem"}
			// {"typ":1,"atmention":"max"}
			// {"typ":1,"atmention":"mikem"}
			// {"typ":1,"atmention":"max"}
			// {"typ":2,"channelnamemention":{"name":"general","convID":"01020304"}}
			// {"typ":1,"atmention":"here"}
			result: "$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$,$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1heCJ9$<kb$ $>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$/$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1heCJ9$<kb$ please check out $>kb$eyJ0eXAiOjIsImNoYW5uZWxuYW1lbWVudGlvbiI6eyJuYW1lIjoiZ2VuZXJhbCIsImNvbnZJRCI6IjAxMDIwMzA0In19$<kb$, also $>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6ImhlcmUifQ==$<kb$ you should too",
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
		decorateMentionTest{
			body:        `\@mikem,\@max \@mikem/\@max please check out \#general, also \@here you should too`,
			atMentions:  []string{"mikem", "max"},
			chanMention: chat1.ChannelMention_HERE,
			channelNameMentions: []chat1.ChannelNameMention{chat1.ChannelNameMention{
				ConvID:    convID,
				TopicName: "general",
			}},
			result: `\@mikem,\@max \@mikem/\@max please check out \#general, also \@here you should too`,
		},
	}
	for _, c := range cases {
		res := DecorateWithMentions(context.TODO(), c.body, c.atMentions, nil, c.chanMention,
			c.channelNameMentions)
		require.Equal(t, c.result, res)
	}
}

type decorateLinkTest struct {
	body   string
	result string
}

func TestDecorateLinks(t *testing.T) {
	cases := []decorateLinkTest{
		decorateLinkTest{
			body:   "click www.google.com",
			result: "click $>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Ind3dy5nb29nbGUuY29tIiwidXJsIjoiaHR0cDovL3d3dy5nb29nbGUuY29tIn19$<kb$",
		},
		decorateLinkTest{
			body:   "https://maps.google.com?q=Goddess%20and%20the%20Baker,%20Legacy%20Tower,%20S%20Wabash%20Ave,%20Chicago,%20IL%2060603&ftid=0x880e2ca4623987cb:0x8b9a49f6050a873a&hl=en-US&gl=us",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vbWFwcy5nb29nbGUuY29tP3E9R29kZGVzcyUyMGFuZCUyMHRoZSUyMEJha2VyLCUyMExlZ2FjeSUyMFRvd2VyLCUyMFMlMjBXYWJhc2glMjBBdmUsJTIwQ2hpY2FnbywlMjBJTCUyMDYwNjAzXHUwMDI2ZnRpZD0weDg4MGUyY2E0NjIzOTg3Y2I6MHg4YjlhNDlmNjA1MGE4NzNhXHUwMDI2aGw9ZW4tVVNcdTAwMjZnbD11cyIsInVybCI6Imh0dHBzOi8vbWFwcy5nb29nbGUuY29tP3E9R29kZGVzcyUyMGFuZCUyMHRoZSUyMEJha2VyLCUyMExlZ2FjeSUyMFRvd2VyLCUyMFMlMjBXYWJhc2glMjBBdmUsJTIwQ2hpY2FnbywlMjBJTCUyMDYwNjAzXHUwMDI2ZnRpZD0weDg4MGUyY2E0NjIzOTg3Y2I6MHg4YjlhNDlmNjA1MGE4NzNhXHUwMDI2aGw9ZW4tVVNcdTAwMjZnbD11cyJ9fQ==$<kb$",
		},
		decorateLinkTest{
			body:   "10.0.0.24",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6IjEwLjAuMC4yNCIsInVybCI6Imh0dHA6Ly8xMC4wLjAuMjQifX0=$<kb$",
		},
		decorateLinkTest{
			body:   "ws-0.localdomain",
			result: "ws-0.localdomain",
		},
		decorateLinkTest{
			body:   "https://companyname.sharepoint.com/:f:/s/site-collection-name/subsite-name/Ds10TaJKAKhMp1hE0B_42WcBVhTHD3EQJKWhGprKFP3vpQ?e=14ohmf",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vY29tcGFueW5hbWUuc2hhcmVwb2ludC5jb20vOmY6L3Mvc2l0ZS1jb2xsZWN0aW9uLW5hbWUvc3Vic2l0ZS1uYW1lL0RzMTBUYUpLQUtoTXAxaEUwQl80MldjQlZoVEhEM0VRSktXaEdwcktGUDN2cFE/ZT0xNG9obWYiLCJ1cmwiOiJodHRwczovL2NvbXBhbnluYW1lLnNoYXJlcG9pbnQuY29tLzpmOi9zL3NpdGUtY29sbGVjdGlvbi1uYW1lL3N1YnNpdGUtbmFtZS9EczEwVGFKS0FLaE1wMWhFMEJfNDJXY0JWaFRIRDNFUUpLV2hHcHJLRlAzdnBRP2U9MTRvaG1mIn19$<kb$",
		},
		decorateLinkTest{
			body:   "http://keybase.io/mikem;",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHA6Ly9rZXliYXNlLmlvL21pa2VtIiwidXJsIjoiaHR0cDovL2tleWJhc2UuaW8vbWlrZW0ifX0=$<kb$;",
		},
		decorateLinkTest{
			body:   "keybase.io, hi",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6ImtleWJhc2UuaW8iLCJ1cmwiOiJodHRwOi8va2V5YmFzZS5pbyJ9fQ==$<kb$, hi",
		},
		decorateLinkTest{
			body:   "https://en.wikipedia.org/wiki/J/Z_(New_York_City_Subway_service)",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0ovWl8oTmV3X1lvcmtfQ2l0eV9TdWJ3YXlfc2VydmljZSkiLCJ1cmwiOiJodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9KL1pfKE5ld19Zb3JrX0NpdHlfU3Vid2F5X3NlcnZpY2UpIn19$<kb$",
		},
		decorateLinkTest{
			body:   "(keybase.io)",
			result: "($>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6ImtleWJhc2UuaW8iLCJ1cmwiOiJodHRwOi8va2V5YmFzZS5pbyJ9fQ==$<kb$)",
		},
		decorateLinkTest{
			body:   "https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0NTUy9AZm9udC1mYWNlL3VuaWNvZGUtcmFuZ2UiLCJ1cmwiOiJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvQGZvbnQtZmFjZS91bmljb2RlLXJhbmdlIn19$<kb$",
		},
		decorateLinkTest{
			body:   "`www.google.com`",
			result: "`www.google.com`",
		},
		decorateLinkTest{
			body:   "```www.google.com```",
			result: "```www.google.com```",
		},
		decorateLinkTest{
			body:   "> www.google.com",
			result: "> $>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Ind3dy5nb29nbGUuY29tIiwidXJsIjoiaHR0cDovL3d3dy5nb29nbGUuY29tIn19$<kb$",
		},
		decorateLinkTest{
			body:   "nytimes.json",
			result: "nytimes.json",
		},
		decorateLinkTest{
			body:   "mike.maxim@gmail.com",
			result: "$>kb$eyJ0eXAiOjUsIm1haWx0byI6eyJkaXNwbGF5IjoibWlrZS5tYXhpbUBnbWFpbC5jb20iLCJ1cmwiOiJtYWlsdG86bWlrZS5tYXhpbUBnbWFpbC5jb20ifX0=$<kb$",
		},
		decorateLinkTest{
			body:   "mailto:mike.maxim@gmail.com",
			result: "mailto:$>kb$eyJ0eXAiOjUsIm1haWx0byI6eyJkaXNwbGF5IjoibWlrZS5tYXhpbUBnbWFpbC5jb20iLCJ1cmwiOiJtYWlsdG86bWlrZS5tYXhpbUBnbWFpbC5jb20ifX0=$<kb$",
		},
		decorateLinkTest{
			body:   "mike.maxim@gmail.com/google.com",
			result: "$>kb$eyJ0eXAiOjUsIm1haWx0byI6eyJkaXNwbGF5IjoibWlrZS5tYXhpbUBnbWFpbC5jb20iLCJ1cmwiOiJtYWlsdG86bWlrZS5tYXhpbUBnbWFpbC5jb20ifX0=$<kb$/google.com",
		},
		decorateLinkTest{
			body:   "https://medium.com/@wouterarkink/https-medium-com-wouterarkink-how-to-send-money-to-anyone-in-the-world-by-only-knowing-their-social-handle-3180e6cd4e58",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vbWVkaXVtLmNvbS9Ad291dGVyYXJraW5rL2h0dHBzLW1lZGl1bS1jb20td291dGVyYXJraW5rLWhvdy10by1zZW5kLW1vbmV5LXRvLWFueW9uZS1pbi10aGUtd29ybGQtYnktb25seS1rbm93aW5nLXRoZWlyLXNvY2lhbC1oYW5kbGUtMzE4MGU2Y2Q0ZTU4IiwidXJsIjoiaHR0cHM6Ly9tZWRpdW0uY29tL0B3b3V0ZXJhcmtpbmsvaHR0cHMtbWVkaXVtLWNvbS13b3V0ZXJhcmtpbmstaG93LXRvLXNlbmQtbW9uZXktdG8tYW55b25lLWluLXRoZS13b3JsZC1ieS1vbmx5LWtub3dpbmctdGhlaXItc29jaWFsLWhhbmRsZS0zMTgwZTZjZDRlNTgifX0=$<kb$",
		},
		decorateLinkTest{
			body:   "https://drive.google.com/open?id=1BKcMML-uqOFAK-D4btEBlcoyodfvE4gg&authuser=cecile@keyba.se&usp=drive_fs",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS9vcGVuP2lkPTFCS2NNTUwtdXFPRkFLLUQ0YnRFQmxjb3lvZGZ2RTRnZ1x1MDAyNmF1dGh1c2VyPWNlY2lsZUBrZXliYS5zZVx1MDAyNnVzcD1kcml2ZV9mcyIsInVybCI6Imh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS9vcGVuP2lkPTFCS2NNTUwtdXFPRkFLLUQ0YnRFQmxjb3lvZGZ2RTRnZ1x1MDAyNmF1dGh1c2VyPWNlY2lsZUBrZXliYS5zZVx1MDAyNnVzcD1kcml2ZV9mcyJ9fQ==$<kb$",
		},
		decorateLinkTest{
			body:   "@google.com",
			result: "@google.com",
		},
		decorateLinkTest{
			body:   "/keybase/team/keybase.staff_v8/candidates/feedback-template.md",
			result: "/keybase/team/keybase.staff_v8/candidates/feedback-template.md",
		},
		decorateLinkTest{
			body:   "#google.com",
			result: "#$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imdvb2dsZS5jb20iLCJ1cmwiOiJodHRwOi8vZ29vZ2xlLmNvbSJ9fQ==$<kb$",
		},
		decorateLinkTest{
			body:   "client/go/profiling/aggregate_timers.py",
			result: "client/go/profiling/aggregate_timers.py",
		},
		decorateLinkTest{
			body:   "cnn.com/@mike/index.html",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6ImNubi5jb20vQG1pa2UvaW5kZXguaHRtbCIsInVybCI6Imh0dHA6Ly9jbm4uY29tL0BtaWtlL2luZGV4Lmh0bWwifX0=$<kb$",
		},
		decorateLinkTest{
			body:   "google.com/mike?email=mike@gmail.com",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imdvb2dsZS5jb20vbWlrZT9lbWFpbD1taWtlQGdtYWlsLmNvbSIsInVybCI6Imh0dHA6Ly9nb29nbGUuY29tL21pa2U/ZW1haWw9bWlrZUBnbWFpbC5jb20ifX0=$<kb$",
		},
		decorateLinkTest{
			body:   "@keybase.bots.build.macos",
			result: "@keybase.bots.build.macos",
		},
	}
	for _, c := range cases {
		res := DecorateWithLinks(context.TODO(), c.body)
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
	defer tc.Cleanup()

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

func TestPresentConversationParticipantsLocal(t *testing.T) {
	tofurkeyhq := "Tofurkey HQ"
	tofurus := "Tofu-R-Us"
	danny := "Danny"
	rawParticipants := []chat1.ConversationLocalParticipant{
		chat1.ConversationLocalParticipant{
			Username:    "[tofurkey@example.com]@email",
			ContactName: &tofurkeyhq,
		},
		chat1.ConversationLocalParticipant{
			Username:    "18005558638@phone",
			ContactName: &tofurus,
		},
		chat1.ConversationLocalParticipant{
			Username: "ayoubd",
			Fullname: &danny,
		},
		chat1.ConversationLocalParticipant{
			Username: "example@twitter",
		},
	}
	res := presentConversationParticipantsLocal(context.TODO(), rawParticipants)

	require.Equal(t, res[0].ContactName, &tofurkeyhq)
	require.Equal(t, res[0].Type, chat1.UIParticipantType_EMAIL)

	require.Equal(t, res[1].ContactName, &tofurus)
	require.Equal(t, res[1].Type, chat1.UIParticipantType_PHONENO)

	require.Equal(t, res[2].Assertion, "ayoubd")
	require.Equal(t, res[2].FullName, &danny)
	require.Equal(t, res[2].Type, chat1.UIParticipantType_USER)

	require.Equal(t, res[3].Assertion, "example@twitter")
	require.Equal(t, res[3].Type, chat1.UIParticipantType_USER)
}

type contactStoreMock struct {
	assertionToName map[string]string
}

func (c *contactStoreMock) SaveProcessedContacts(libkb.MetaContext, []keybase1.ProcessedContact) error {
	return errors.New("contactStoreMock not impl")
}

func (c *contactStoreMock) RetrieveContacts(libkb.MetaContext) ([]keybase1.ProcessedContact, error) {
	return nil, errors.New("contactStoreMock not impl")
}

func (c *contactStoreMock) RetrieveAssertionToName(libkb.MetaContext) (map[string]string, error) {
	return c.assertionToName, nil
}

func (c *contactStoreMock) UnresolveContactsWithComponent(mctx libkb.MetaContext,
	phoneNumber *keybase1.PhoneNumber, email *keybase1.EmailAddress) {
	panic("unexpected call to UnresolveContactsWithComponent in mock")
}

func TestAttachContactNames(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat-utils", 0)
	defer tc.Cleanup()

	assertionToName := map[string]string{
		"[tofurkey@example.com]@email": "Tofu R-Key",
		"18005558638@phone":            "Alice",
	}

	mock := &contactStoreMock{assertionToName}
	tc.G.SyncedContactList = mock

	rawParticipants := []chat1.ConversationLocalParticipant{
		chat1.ConversationLocalParticipant{
			Username: "[tofurkey@example.com]@email",
		},
		chat1.ConversationLocalParticipant{
			Username: "18005558638@phone",
		},
		chat1.ConversationLocalParticipant{
			Username: "ayoubd",
		},
		chat1.ConversationLocalParticipant{
			Username: "example@twitter",
		},
	}

	AttachContactNames(tc.MetaContext(), rawParticipants)
	require.NotNil(t, rawParticipants[0].ContactName)
	require.Equal(t, "Tofu R-Key", *rawParticipants[0].ContactName)
	require.NotNil(t, rawParticipants[1].ContactName)
	require.Equal(t, "Alice", *rawParticipants[1].ContactName)
	require.Nil(t, rawParticipants[2].ContactName)
	require.Nil(t, rawParticipants[3].ContactName)
}
