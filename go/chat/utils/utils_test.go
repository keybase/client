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
	text := "@Chat_1e2263952c hello! @Mike From @chat_5511c5e0ce. @ksjdskj 889@ds8 @_dskdjs @k1 @0011_"
	matches := parseRegexpNames(context.TODO(), text, atMentionRegExp)
	var names, normalizedNames []string
	for _, m := range matches {
		names = append(names, m.name)
		normalizedNames = append(normalizedNames, m.normalizedName)
	}

	expected := []string{"Chat_1e2263952c", "Mike", "chat_5511c5e0ce", "ksjdskj", "k1", "0011_"}
	require.Equal(t, expected, names)
	expectedNormalized := []string{"chat_1e2263952c", "mike", "chat_5511c5e0ce", "ksjdskj", "k1", "0011_"}
	require.Equal(t, expectedNormalized, normalizedNames)
	text = "@mike@jim"
	matches = parseRegexpNames(context.TODO(), text, atMentionRegExp)
	names = []string{}
	for _, m := range matches {
		names = append(names, m.name)
	}
	expected = []string{"mike"}
	require.Equal(t, expected, names)
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

func (t *testTeamChannelSource) GetLastActiveForTLF(ctx context.Context, uid gregor1.UID, tlfID chat1.TLFID,
	topicType chat1.TopicType) (gregor1.Time, error) {
	return 0, fmt.Errorf("testTeamChannelSource.GetLastActiveForTLF not implemented")
}

func (t *testTeamChannelSource) GetLastActiveForTeams(ctx context.Context, uid gregor1.UID,
	topicType chat1.TopicType) (res chat1.LastActiveTimeAll, err error) {
	return res, fmt.Errorf("testTeamChannelSource.GetLastActiveForTeams not implemented")
}

func (t *testTeamChannelSource) GetChannelTopicName(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType, convID chat1.ConversationID) (string, error) {
	return "", fmt.Errorf("testTeamChannelSource.GetChannelTopicName not implemented")
}

func (t *testTeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ConversationLocal, err error) {
	return res, nil
}

func (t *testTeamChannelSource) GetRecentJoins(ctx context.Context, convID chat1.ConversationID, remoteClient chat1.RemoteInterface) (int, error) {
	return 0, nil
}

func (t *testTeamChannelSource) GetLastActiveAt(ctx context.Context, teamID keybase1.TeamID, uid gregor1.UID, remoteClient chat1.RemoteInterface) (gregor1.Time, error) {
	return 0, nil
}

func (t *testTeamChannelSource) OnDbNuke(mctx libkb.MetaContext) error {
	return nil
}

func (t *testTeamChannelSource) OnLogout(mctx libkb.MetaContext) error {
	return nil
}

func TestParseChannelNameMentions(t *testing.T) {
	uid := gregor1.UID{0}
	teamID := chat1.TLFID{0}
	chans := []string{"general", "random", "miketime"}
	text := "#miketime is secret. #general has everyone. #random exists. #offtopic does not."
	matches := ParseChannelNameMentions(context.TODO(), text, uid, teamID,
		newTestTeamChannelSource(chans))
	expected := []chat1.ChannelNameMention{
		{TopicName: "miketime"},
		{TopicName: "general"},
		{TopicName: "random"},
	}
	require.Equal(t, expected, matches)
}

type testUIDSource struct {
	libkb.UPAKLoader
	users map[string]keybase1.UID
}

func newTestUIDSource() *testUIDSource {
	return &testUIDSource{
		users: make(map[string]keybase1.UID),
	}
}

type testInboxSource struct {
	types.InboxSource
}

func (t testInboxSource) Read(ctx context.Context, uid gregor1.UID, localizeTyp types.ConversationLocalizerTyp,
	dataSource types.InboxSourceDataSourceTyp, maxLocalize *int, query *chat1.GetInboxLocalQuery) (types.Inbox, chan types.AsyncInboxResult, error) {
	return types.Inbox{
		Convs: []chat1.ConversationLocal{{
			Info: chat1.ConversationInfoLocal{
				TopicName: "mike",
			},
		},
		}}, nil, nil
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
	tc := externalstest.SetupTest(t, "chat-utils", 0)
	defer tc.Cleanup()

	g := globals.NewContext(tc.G, &globals.ChatContext{InboxSource: testInboxSource{}})
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
	tc.G.SetUPAKLoader(usource)
	body := chat1.NewMessageSystemWithAddedtoteam(chat1.MessageSystemAddedToTeam{
		Adder: u1name,
		Addee: u2name,
	})
	atMentions, chanMention, _ := SystemMessageMentions(context.TODO(), g, u1, body)
	require.Equal(t, 1, len(atMentions))
	require.Equal(t, u2, atMentions[0])
	require.Equal(t, chat1.ChannelMention_NONE, chanMention)
	body = chat1.NewMessageSystemWithInviteaddedtoteam(chat1.MessageSystemInviteAddedToTeam{
		Invitee: u3name,
		Inviter: u1name,
		Adder:   u2name,
	})
	atMentions, chanMention, _ = SystemMessageMentions(context.TODO(), g, u1, body)
	require.Equal(t, 2, len(atMentions))
	require.Equal(t, u1, atMentions[0])
	require.Equal(t, u3, atMentions[1])
	require.Equal(t, chat1.ChannelMention_NONE, chanMention)
	body = chat1.NewMessageSystemWithComplexteam(chat1.MessageSystemComplexTeam{
		Team: "MIKE",
	})
	atMentions, chanMention, _ = SystemMessageMentions(context.TODO(), g, u1, body)
	require.Zero(t, len(atMentions))
	require.Equal(t, chat1.ChannelMention_ALL, chanMention)

	body = chat1.NewMessageSystemWithNewchannel(chat1.MessageSystemNewChannel{})
	atMentions, chanMention, channelNameMentions := SystemMessageMentions(context.TODO(), g, u1, body)
	require.Zero(t, len(atMentions))
	require.Equal(t, chat1.ChannelMention_NONE, chanMention)
	require.Equal(t, 1, len(channelNameMentions))
	require.Equal(t, "mike", channelNameMentions[0].TopicName)
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
		{
			body:       "@mikem fix something",
			atMentions: []string{"mikem"},
			// {"typ":1,"atmention":"mikem"}
			result: "$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$ fix something",
		},
		{
			body:        "@Mikem,@Max @mikem/@max please check out #general, also @here you should too",
			atMentions:  []string{"mikem", "max"},
			chanMention: chat1.ChannelMention_HERE,
			channelNameMentions: []chat1.ChannelNameMention{{
				ConvID:    convID,
				TopicName: "general",
			}},
			// {"typ":1,"atmention":"Mikem"}
			// {"typ":1,"atmention":"Max"}
			// {"typ":1,"atmention":"mikem"}
			// {"typ":1,"atmention":"max"}
			// {"typ":2,"channelnamemention":{"name":"general","convID":"01020304"}}
			// {"typ":1,"atmention":"here"}
			result: "$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Ik1pa2VtIn0=$<kb$,$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Ik1heCJ9$<kb$ $>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$/$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1heCJ9$<kb$ please check out $>kb$eyJ0eXAiOjIsImNoYW5uZWxuYW1lbWVudGlvbiI6eyJuYW1lIjoiZ2VuZXJhbCIsImNvbnZJRCI6IjAxMDIwMzA0In19$<kb$, also $>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6ImhlcmUifQ==$<kb$ you should too",
		},
		{
			body:       "@mikem talk to @patrick",
			atMentions: []string{"mikem"},
			result:     "$>kb$eyJ0eXAiOjEsImF0bWVudGlvbiI6Im1pa2VtIn0=$<kb$ talk to @patrick",
		},
		{
			body:   "see #general",
			result: "see #general",
		},
		{
			body:   "@here what are you doing!",
			result: "@here what are you doing!",
		},
		{
			body:        `\@mikem,\@max \@mikem/\@max please check out \#general, also \@here you should too`,
			atMentions:  []string{"mikem", "max"},
			chanMention: chat1.ChannelMention_HERE,
			channelNameMentions: []chat1.ChannelNameMention{{
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

func BenchmarkDecorateLinks(b *testing.B) {
	var messages = []string{
		"The buttons have been \"encrypted\" and the plaintext is still there.",
		":joy: ",
		"it looked like \"CASINO\" to me ",
		"I like it, and I think that if you look at it closely you can see where it has \"CRYPTO\" almost hidden in the _charaters_. Same thing for the Try it button in the what's new.",
		"Actually I like it!",
		"Maybe a checkbox in settings to keep it if you want to?",
		"As in, once you click on the tab, the text stays normal",
		"I do think it's cool. but it should be a one-time thing",
		"then I realized it was a clever thing and embraced its quirkiness :D",
		"I thought it was a corrupted system font or something :P ",
		"I didn't see that label in the announce blog entry on the feature. If it's not there, I'd surmise it to be a bug.",
		"I first thought it was in hebrew or something",
		"I hope they'll remove the weird label, it's murdering my OCD",
		"Oh really?! Oh.. that’s a shame... :( ",
		"The program ended in December and was killed off by the influx of spammers and thieves. No January airdrop. There's a team for it #stellar where they will tell you the same (and worse) heh @rottentweetie Also search for a team called airdrop for more info and misc spammers galore.",
		"there is none in january. it ended. would be simple to google @rottentweetie ",
		"Hi there! How are ya’ll?? Question: I didn’t recieve the airdrop of lumens of januari. Did you guys do?! Or the same as I? ",
		"I am currently trying the \"linux\" path so far it has bot crashed",
		"Lovelly getting error saying that path from windows is not a KBFS path",
		"you should be able to find out the exact path from your windows explorer portion though",
		"i am not sure about windows. for linux/mac which i use it's /keybase/private/smms in my case. ",
		"go to https://keybase.io/docs/kbfs/understanding_kbfs ; under `Time travel` portion, it explains in details about how you gonna restore",
		"or something else? I am on windows",
		"would my path be K:/public/idah6?",
		":sweat_smile: ugh no...",
		"The hero has arrived. :tada:",
		"@idah6 go to console and `keybase fs stat`, it has the commands you need",
		"thanks for the help though",
		"you can restore, `keybase fs stat --show-archived <your_kbfs_path> `to check on the revision",
		"@chindraba yeah this was not something I had planned for, I kept checking before performing any operations, but whatever, this happens every now and then",
		"I don't know for sure, and don't know how to do it, but I think you have some hope. Be patient as this is sort of the dead time for here.",
		"Something about the merkle tree. ",
		"I think the files are stored in a manner that prior versions can be seen/copied/recoverd. Similar to git.",
		"@idah6 I think there is. I don't know it, but I don know one thing: STOP. Do nothing further until you have the answer. To continue could ruin the chance of recovery.",
		"I need help, I accidently was deleting files off of Keybase, and was asked to permanently deleting them (thinking it was the local copy in another location on the computer) I stopped the operation but is there any way of restoring those files?",
		"Type an @ and the first few letters, click the one you want and then copy that.",
		"Never had it self-activate though. And I very seldom close the main window anyway. It's set to show on all desktops, so I don't have to even look at the tray icon.",
		"@nevezen I think, now that you describe it, that I've seen that. When I click on the KB icon in the tray, it show \"Show Keybase\" which opens that window. I've always just clicked on one of the chats, or the chat icon on top, as that's where I'm going then anyway.",
		"why it need to copy a user's name btw?",
		"MacOS, btw.",
		"Hi. I love keybase, but I just had a really frustrating moment trying to copy a user's name. Ultimately I couldn't figure out a way to do it heh.",
		"Ah ok, 👌🏼",
		"\"Fast\"er than logging out user one and logging in with user two.",
		"Windows feature which allows multiple users to be \"logged in\" at the same time, even though only one is able to use the system at once.",
		"“Switch user” from the start menu",
		"What do u mean by fast uset switching ?",
		"More like a quick access contextual menu launched from the notifications bar icon.",
		"Has icons for people, chat, files, teams, hamburger and a window list of recent chats and files.",
		"Right now I’m just testing on a win 10 desktop with fast user switching. Tomorrow I’ll try on a true multi user server. ",
		"Does the first user, on K:, loose access to their files on K: when the second user has X: open?",
		"OK testing this... gone back and forth mis-interpreting results but... looks like first user to connect gets K:, second gets X:",
		"Have not seen that happen, yet. Is it a new window for each conversation, or just a new window which handles all conversations?",
		"The same with the try it! button on keybase fm. Looks intentional",
		"ugh, keybase now shows a dedicated mini-window for messages?",
		":)",
		"Mouse over",
		"I think intentional",
		"Only one Windows user at a time?",
		"Gak! Is this still true?",
		"meanwhile, my kbfs is stuck",
		"I had to join, and then turn off notifications ",
		"Yeah....",
		"It is",
		"Is that the spacedrop replay?",
		"why is keybase sending me notifications for a channel *I'm not even in* ugh",
		"good point. I was assuming this would be the case.",
		"So there will be some system storage usage ",
		"Don’t forget though that kbfs requires local scratch space to encrypt blocks before they’re sent to kbfs",
		"No worries",
		"You're welcome.",
		"NP, didn't do anything anyway.",
		"Thank you @smms, @chindraba, @stefan_claas for the input. ",
		"@alphydan maybe worth to take a look at GiHub and ask there. https://github.com/keybase/client/issues",
		"yeah, files stored on kbfs won't use your local storage. it's under kbfs storage quota. you could check by `keybase fs quota` ; simplest way is to think of it as a network mounted disk",
		"so if I `cp some-file /keybase/team/some-team/some-file` it doesn't occupy any space in the local machine?",
		"You could just save the files at your keybase/private or public folder path. no need special command. As long as your kbfs is mounted, it's a non issue saving there ",
		"(a use case is that I only have 2GB of space left on the server, but would like to store 4GB on kbfs, and whether it can be done programmatically) ",
		"my question is whether it is possible to save a file to the kbfs (in a server, using shell commands or the API) without using local storage ",
		"As I understand it, here. Answers might be ymmv styles though ",
		"Family voice mail is rare. Email most likey, text possibly. Most times when it's a missed call no messages are left.",
		"Where is the best place to ask some technical questions about the keybase api? ",
		"It's kindof annoying but also cute. I listen to them once in a while when i miss her",
		"I got too many from my grandmother saying something like: > Hey it's me [name]. I just wanted to hear how everything is going. you don't have to call back it's always the same. tried to say that it's nice and all, but if she only leaves a message when it is something out of the ordinary then i'll listen to them at that point. but nah",
		"I'm also not dissing people using it as a communication-of-choice, if it is consentual. I'm just, myself, trying to be less wired in because it fucks with your brain",
		"I don't even listen to phone voice mail except for family and doctors ",
		"By phone, voip,  even voice chat like discord. But, not messages or passing thoughts and notes.",
		"When I use voice it's for a conversation, not messages in a bottle.",
		"I'm all for new tech and shit. and evolution of society and shit. And obviously phones have done a lot of good. But is your life really that much of an action movie that you can't either pull into the side of the road or wait ? I mean we used to have to go home to use the phone. again.. not a \"new-tech-bad\". just.. people could chill",
		"Voice msg or not.. is personal preference, no real justification to remove it.  it's similar to request ability to send exloding message in group removed, and exploding msg should be available in 1/1 convo only. ",
		"😹 Yeah. I don't even *listen* to or accept audio messages or voice calls from anyone I don't care about.",
		"https://keybase.io/docs/teams/design",
		"subteams and their parent teams and other subteams under the same parent are all separate and can not see files or messages from one another. however, they'll all share the quota of the parent team (100gb total across all sub teams), and an admin/owner of a team can add themself to any subteam of the team they're admin/owner of",
		"😆 ",
		"It annoys me when my wife does it, but she gets a pass because I’m married to her. You guys, on the other hand....",
		`Right, and that’s exactly it. It places the burden on the listener. And this might be crazy, but hear me out:
		 - I get that you’re busy or on the go, but that doesn’t mean I’m not
		 - I get that sometimes you can’t type, like when you’re driving. Maybe you should wait? I’m probably not in a position that I can listen all the time.

		I feel like it proxies the burden, and (unfortunately and unintentionally) makes an implicit statement that their time is more important than your time right now. `,
		"If you're in group with peeps on the go it's easier for them to just record, but cumbersome to listen.",
		"I get that some people like them, but I’d prefer if my client deleted them and auto responded “ain’t got time for that”",
		"Making voice messages go away would be an equally acceptable solution 😆 ",
		"Super bowl ",
		"!en 슈퍼 볼 ",
		"Superbowl ",
		"!tl Superbowl",
		"슈퍼 볼 ",
		"!ko Superbowl",
		"Hi, new here",
		"오늘은 일요일입니다 ",
		"!ko today is sunday",
		"이것은 어느 봇입니까? ",
		"!ko Which bot is this?",
		"a bot that converts voice messages into text would also be very helpful. Voicy does it for Telegram.",
		"I made the webooks work, wee",
		"How does access to files belonging to teams work? Do members of subteams automatically have access to files of parents? Or do members of teams have access to files of subteams? Or none of the two?",
		"would be nice if they made this page work with saltpack https://keybase.io/verify",
		"thanks for finally implementing the direct messages \"blocks\" and moderation",
		"Has anyone has any luck with incoming webhooks, and has some examples? I havent been able to find any doc for it",
		":wave:",
		"Hey all :)",
		"Welcome",
		"Thanks!",
		"@greenarmor Here's an impressive list. https://awesomeopensource.com/projects/text-to-speech",
		"Might not be as good as Google, but run locally, much more private.",
		"Probably even OpenSource.",
		"None I know, but I suspect there are some TTS programs available.",
		"any alternative you can think of other than using Gtts?",
		"not wise but sound cool",
		":wave:",
		"@greenarmor is that wise? The transcript going from an E2E secure channel into Google for TTS?",
		"using google tts",
		"im working on a bot recording minutes of a meeting inside a team then after the meeting, bot can send back the minutes as audio file",
		"Learning curve for everyone. Huge teams, like this one, are bound to have more than a few complications.",
		"actaully theres 2 triggers same with @sholebot the !price. i already changed",
		"i cant changed mine the korean team used to it",
		"Yep, imagine single word triggers 10+ bots info. ",
		"Cute, for a puppy.",
		"!eyebleach",
		"Lesson to be had if you make your own bot :D",
		"Ah ok",
		"the help command was responded to by both bots",
		"Some keyword triggered it?",
		"How did this ssh0le bot suddenly appear?",
		"!urban whelp",
		"!cat",
		"!help",
		"Nada.",
		"뭐야 ",
		"All the work, all the blame, and none of the credit.",
		"!ko what's up",
		"No wonder they want to revolt.",
		"lol",
		"Sure.. blame the bot.",
		"his fault :P",
		"Syntactically probably more correct, however.",
		"its google translate",
		"That time it droped one of the commas.",
		"좋은 아침, 축복받은 날 러시아 친구. ",
		"!ko Good morning and blessed day my Russian friend.",
		"Something's lost in the translation.",
		"Good morning, blessed day, Russian friend. ",
		"!en 좋은 아침, 축복받은 날, 러시아 친구.",
		"im not sure",
		"Does Korean lack conjuctions?",
		"좋은 아침, 축복받은 날, 러시아 친구. ",
		"!ko Доброе утро и благословенный день, мой русский друг.",
		"어떻게 지내? ",
		"!ko how are you?",
		"!kor Доброе утро и благословенный день, мой русский друг.",
		"Use en as the input for korean and tagalog?",
		"all ready in",
		"all major languages to english",
		"So, the bot reads lots of stuff. only speaks the three?",
		"Philippines",
		"I don't even know what, or where from, tagalog is.",
		"Good morning and blessed day, my Russian friend. ",
		"!en Buenos días y bendito día, mi amigo ruso.",
		"Buenos días y bendito día, mi amigo ruso.",
		"i just add korean ang tagalog",
		"Why? didn't teach the bot Spanish?",
		"wont work",
		"!es Доброе утро и благословенный день, мой русский друг.",
		"ahaha",
		"Make a bot do all your work for you.",
		"cheating ?",
		"Nice trick, even if it is _cheating_.",
		"Good morning and blessed day, my Russian friend. ",
		"!en Доброе утро и благословенный день, мой русский друг.",
		"Доброе утро и благословенный день, мой русский друг.",
		"Good morning from fairy cold Russia ",
		":wave:",
		":wave:",
		"Mmm",
		"I think it worked on block quotes too.",
		"Something like \"see full text\".",
		"I've seen someplace where code blocks were limited to a few lines, and reading more required a click, and it reset if you left the room and came back. Not sure where, so I can't demo it. )-:",
		"the real feature request is always in the comments",
		"Or, if the other recepiant has copied it, perhaps the sender could delete it. ",
		"Or maybe allow us to collapse code blocks",
		"Wow feature request: hide message",
		"cool thanks @dxb ",
		"Dang, that's a boat-load of text for a short message.",
		"pm @b07 with `!help`, check out #discovery-channel, and check out keybase.io/popular-teams",
		"Is there anyway to search for big chat rooms on keybase?",
		"Well, that's a possible problem",
		"No cli of their own",
		"My mobiles only ssh to the desktop.",
		"maybe make sure there's actually something on your clipboard? :p",
		"Can't do that here. Only my desktop is usable for CLI",
		"i tested it with `termux-clipboard-get` and it worked though",
		"Perhaps the termux-clipboard-get isn't doing it correctly. Or something on the choosen options aren't set right.",
		"So it seems, Works for me with various options and no --message/-m flag",
		"you're right though, that's standard, and i'm sure it works that way too",
		"you don't need `-m` at all when piping to it",
		"The `-m` needs the clear text on the command line. To make  pipe work you need to use `-` as a the \"message\". `termux-clipboard-get | keybase encrypt -m - <user>`",
		"also, since your `&` was outside of the code tag on your message i assume that wasn't part of it right?",
		"try something simple first. `termux-clipboard-get | keybase encrypt <user>` (don't use -m when piping to stdin)",
		"works fine for me… are you encrypting for a team or some ridiculously large group?",
		"I tried with that param and without and it wouldn't read my piped input",
		"are you using the `-m` option?",
		" I'm curious; I'm trying to use `keybase encrypt` from the cli (as the feature isn't on mobile *yet*) and I'm unable to get keybase to read my `stdin` input. I'm piping the input in like so `termux-clipboard-get | keybase encrypt <params> <target> <flags>` & this isn't working",
		"ttfn",
		"Uncle did, August Dvorak",
		"In college I was proficient equally with that and QWERTY.",
		"Loved his keyboard, but don't use it anymore.",
		"Never hear a single one, nor read anyting from him.",
		"Dvorak",
		"Which he never claimed anyway.",
		"I was \"online\" years before Gore \"invented\" the Internet",
		"10 characters per second print speed. No \"screen\" just paper.",
		"Teletype Model 32 ASR connected to 110 baud dial-up.",
		"Don't recall what my first computer was, but I remember it being upgraded to an UNIVAC 1110",
		"Not my first computer. My first IGM-family computer.",
		"First build was PC-XT clone, 20 MB HDD, 640K RAM, dual 5.25 180K floppy.",
		"Until the current box I've always built my own box.",
		"It's probably a bit dated, but a good idea of how to work the whole thing is spelled out in one place. https://nodakengineering.com/?page_id=501",
		"The virtual box, usable linux, and linux from scratch are all free. ",
		"@damccull If you want to play with linux, and learn what's really going on under the hood with everything. Try the Linux From Scratch project. Of course it requires a running linux to build it, but that can be in a virtual box.",
		"Had full-suite integration working before MSO even tried to do it.",
		"I even got to like the extras they had, Director I think it was called.",
		"Up to WP 12 on XP",
		"I had WP on Win and never had an issue with it.",
		"WP had MSO beat 7 ways to sunday. Just didn't have the draconian marketing to keep it going",
		"I've adapted to gui, reasonably well anywya",
		"More of a cli-fan that finds gui handy, as long as it don't bury things too deep",
		"Haven't liked MS Office since they added the ribbon. 2003 or 2007.",
		"I've used win 8/8.1/10 enough to know I'm never going back.",
		"I've always had, and still have, a seldom-used boot into Win. Mostly to help others.",
		"Haven't really \"used\" win since vista came out and made my pc look like a new mac",
		"Haven't used Mac since pre-osx days, and then very little.",
		"That plus MS Office is just so....above all the competitors. If MS would port office365 to linux, and I could get a legit gaming capability that didn't require any tweaking and was completely transparent and could play all mah games, I'd switch today. Those are the only things holding me back.",
		"Do you spend significant time doing other things, in blocks of time rather than piece-meal?",
		"I keep wanting to switch to linux but I can't seem to break away from windows as a gaming platform, and that's basically what I do all the time so... :D",
		"I'm not. Linux now. Then I had a few installs under multi-boot. 3rd physical partition on 1st of 3 hdd installed.",
		"Not that it should be against the rules, but why are you using g:/ as the system disk?",
		"didn't worg so well when i was using `g:/` as the system disk.",
		"the official update did something relative to inventoring software in `c:/program files`",
		"Rebuilding the FAT table with debug was an experience not to be forgotten, nor repeated.",
		"It's hard to screw up windows unless you have a hobby of trying out warez",
		"Well, back in the old days of MSDOS I did accidentally format the wrong drive. My fault for not double checking the assignments after adding a new drive.",
		"Surprisingly enough the only time I've had anything happen to my system was back in my Windows days and M$ had a bad-acting update.",
		"The goal is to protect you from the software you run. Since that presumably includes a web browser, which is running JavaScript from who-knows-where, some of which may be trying to leverage runtime vulnerabilities, it's a prudent idea.",
		"Create `/etc/synthetic.conf` with `/keybase` in it.",
		"It's possible, just has to be configured before boot time.",
		"That's my only beef, so far anyway, with KDE",
		"that makes sense, thanks. bit of a bummer but all in the name of security innit",
		"I hate it when \"my\" system tries to protect me from _myself_.",
		"things aren't allowed to make folders in `/` anymore",
		"https://github.com/keybase/client/issues/17835",
		`> Keybase 4.4.0 (out today) has better file system support for Catalina now. Please let us know if you have more problems with it. Note that the /keybase mount point is no longer viable on fresh installs of Catalina due to macOS namespace restrictions, so now we mount at /Volumes/Keybase if /keybase does not already exist.

		`,
		"system integrity made it impossible",
		"can still run fs commands thru `/keybase` via `keybase` cli tho",
		"Linux here. Still works.",
		"did KBFS change in an update? I can no longer cd into `/keybase` like I used to but I can access through `/Volumes/Keybase (current_user)/` (this on macOS Catalina)",
		"Called `Kebase Key ID`",
		"`keybase pgp list` command gives the ID",
		"Ok I see it.",
		"Ah...I see. Thanks for pointing that out. I thought it was inconvenient to have to log into the website ;D",
		"then use \"keybase Key ID\"",
		"yeah you have to do `keybase pgp list`",
		"the ID must be keybase's internal ID for it",
		"ah, signing into the website gives a big long string when i click 'edit' next to the key",
		"\"Error parsing command line arguments: bad key: KID wrong length; wanted 35 but got 8 bytes\"",
		"Nope, same error. How strange.",
		"try using `f94da63df218aa31` as given on the profile",
		"grr. `keybase pgp drop` keeps telling me it wants 35 bytes but only got <number less than 35> bytes. Obviously I'm using the wrong thing. What hsould I be using?",
		"fair enough",
		"Not sure where I got that one from.",
		"Yep. I see two keys next to my picture but neither has that code you sent earlier.",
		"go to your main profile page",
		"how do you see the key id you were sending me earlier? I don't see that number anywhere.",
		"Same thing, except how you get it into your profile.",
		"So using a custom key or generating one is the same thing?",
		"Oh.",
		"Actually, they key isn't signed by Keybase. It's entry into the merkle tree is signed by your KB identity.",
		"If i had a preexisting cert, could I have keybase sign that somehow? I see that it signs your cert when you create one through them",
		"They use a \"gossip\" network. What one server knows, eventually they all know.",
		"Nice.",
		"One is all.",
		"Hmm. Are the key servers linked to share data, or is there a popular one I should use?",
		"Have to upload it to a regular keyserver.",
		"That's the part keybase doesn't work with.",
		"That way there system doesn't accidentally try to use it later",
		"So you upload the key back to keybase with the revoked part in it?",
		"Later, if you use the key with other people, it's nice to let them know it's revoked, and send them the revoked key to update their keyring.",
		"3) let others know it's revoked by sending the revoked key to the keyserver",
		"2) Actually \"revoke\" the key  by importing the revocation cert into the key",
		"1) create a revocation cert. Should have one handy for any key you make anyway.",
		"hmm. interesting. how do you send revocations out?",
		"Keybase, however, doesn't have a tool for revoking PGP certs. only removing them from the Keybase profile.",
		"It was listed on  your profile, so anyone could have goten it from there. Made easy on purpose.",
		"i only see F94DA63DF218AA31 and 43E0A440A5971D1B",
		"I've never posted any keys to a public server on my own. Unless keybase did it outside their own server, that's the only place that should exist.",
		"Now I see `f218aa31` not sure where I got that other one from",
		"While expirementing, try to keep copies of everything, in case you need to \"clear the record\" later.",
		"I'm enjoying it. I don't see af971d1b on my profile...there are two keys on the page though",
		"It's lots of fun, imho",
		"I'm newish to pgp.",
		"Oh yeah I added that one as a test just now lol.",
		"Nope, now I see another one `af971d1b`",
		"Oh, interesting. Ok, it's saying no secret key available, so perhaps I have lost that in the past.",
		"That's the id from your profile.",
		"The revoked key can be sent to one of the pgp key servers, and anyone trying touse it, if they got it from somewhere, will know it's revoked.",
		"No f21...found...should I replace with my own?",
		"That generates a revocation cert, and then imports it back into the keychain, merging them, and making the key now revoked.",
		"Then issue a revocation certificate for it, with `gpg --gen-revoke f218aa31 | gpg --import`",
		"Ok I did that. Now I see it in my local keychain. Doesn't look like something I recognize, though it has my name. I must have generated it as a test when keybase released back in the day.",
		"If not, add it with `keybase pgp export --unencrypted | gpg --import`",
		"It may, or may not, be in your computer's GPG keychain.",
		"Well, purging it would not cause any issues. However, I'd recomend a few other steps first.",
		"I don't know what it's for anymore, I'm getting ready to create a new one that I will know what it's for, and I don't really want it anymore. I haven't ever used it that I'm aware of.",
		"Why do you need to remove the key?",
		"I have a pgp key in my `keybase pgp list` and I'm not sure if I generated it in the past or if it was created automatically. Can I safely `keybase pgp purge` without screwing up my account?",
		"Achetez-en dans un échange. Ensuite, essayez d'utiliser l'anglais dans les zones où tout le monde l'utilise. Probabilité accrue de compréhension.",
		`Bonjour,
		Y-a-t-il des gens parlant français ici ? Besoin d'infos sur la façon la plus simple d'acquérir des Lumens.
		Bonne soirée.
		`,
		"the exchange account she mentioned seems unknowned but funded by interstellar, i dont think interstellar need a memo",
		"Np!! ",
		"Great! Thank you so much for this help! Much appreciated.",
		"You have to contact your exchange, usually they will able to resolve it for you with few additional steps fr them ",
		"What happens with the XLM if I indeed forgot to enter the memo field?",
		"I guess you forgot to key in memo field when you sent ? ",
		"this friend of mine also tried to send her XLM to the same exchange and she found the same problem.....",
		"Exchange usually requires you to enter memo field whereas personal wallet you don't have to. ",
		"yes this is the one",
		"yes",
		"Lumen = XLM and yes it's 918 xlm and I can see that they were sent from my wallet in Keybase but they never arrived in my wallet at the exchange. Does that complicate things that the receiving wallet is one of an exchange?",
		"@inep ",
		"Hmmmm.... what is the lumen? I am not sure that I know what that is...",
		"Is that 918xlm that you recently transferred. Looks like it went through .. ? Was it your another wallet or exchange ?",
		"I am nieuw to Keybase and Crypto and am verry excited. I was introdeuced to Keybase via a friend who gave me the possibility of joining in time for the Airdrop. Being new to Keybase I wanted to transfer my Lumen to another wallet. The address is correct but I have not received the Lumen in the wallet that I sent it to. Can anyone explain to me what I did wrong and if I can correct it?",
		"Hello Everyone,",
		"Very nice, thank you @chindraba ",
		":tada:",
		"For \"denyability\" you can create a shadow account, encrypt to that account, removing yourself, and save the file. Anyone with access to the creating account (including rubber-hose) will not be able to decrypt it. As long as they don't know the other account is you, it remains private.",
		"Being able to remove \"self\" from the encryption list, once there is someone else listed, is a nice trick too.",
		"That does not happen, however for the encrypt function. So if the same file is to be encrypted to multiple recipients individually, it has to be renamed manually between encryptions.",
		"Amazing and very useful for me. I have many folders and files and this greatly simplifies my workflow",
		"The decrypt/verify functions will not overwrite existing files. Adding a (1), (2),... to the file name (not the extension if any).",
		"It seems to be well behaved, in Linux at least.",
		"Yes, just tried it myself on Linux. Works the same as you report on Mac. Decryption works just as easily too.",
		"If I drag the file, I get binary which would be unsafe to paste in a message anywhere.",
		"If I enter the text directly I get text I can paste in a message somewhere.",
		"One problem is that it does not allow the option to have it ASCII armored, or what ever the term is relative to saltpack.",
		"its the same",
		"shut up",
		"lol",
		"never used a file manager",
		"don't know how to drag and drop a file in linux",
		"I tried the new update on a Mac. The crypto tab has an interesting behavior: If you drag and drop a file to sign or encrypt, the output is generated and stored in the same location as the original file. This works on both local and remote (Google Drive File Stream) folders. I am amazed! Does this work the same also on Windows and Linux?",
		":wave:",
		"Hello ",
		"Where ",
		":wave:",
		"Submit GitHub issue. Haa.. ",
		"True but... It can't be used for it's purpose anymore.",
		"i mean you can leave the channel lol",
		"So will it ever be deleted since it's basically useless now?",
		"Ah ok. Thought there was some issue after the update",
		"people would just flip constantly",
		"but as keybasefriends grew it ended up causing issues",
		"it was",
		"Huh, thought that's the purpose of the channel",
		"it ends up bogging down every single client connected and the server for minutes",
		"(i know it sounds silly)",
		"flip was disabled in #flip ",
		"You don't have to wait. Tell others about Keybase and about the security threats built into Whatsapp, and get everyone to use Keybase instead. No waiting and better security. What could be better?",
		"Quick question for any engineering managers here... for React Native (iOS, Android, Desktop + Web App) products, do you guys recommend typescript? Seems like extra overhead",
		"Hey everyone nice to meet you all of you guys",
		":wave:",
		"i mean they have @keybase but that's only for keybase employees lol :) ",
		"I hope it would be on phones soon. Can't wait to send encrypted messages on Whatsapp :grin:",
		"this is that place :) thanks for the kind words",
		"does the dev team at keybase have a team or channel (I assume they don't want to be TOO public). Bravo to them on the past few updates.",
		"Thanks",
		"that's what I thought",
		"a name is either a user or a team",
		"ok",
		"they can't overlap",
		"yes",
		"Do team names and user names share a namespace? In other words can a user have the same name as a team?",
		"༼ つ ◕‿◕ ༽つ ",
		"Keybase seems to only render the lower half of some of the weirder characters ",
		"ATM desktop only",
		"How does one install it?",
		"In development (hopefully)",
		"https://www.fsf.org/facebook",
		"Where is crypt on my android app?",
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, msg := range messages {
			DecorateWithLinks(context.TODO(), msg)
		}
	}
}

type decorateLinkTest struct {
	body   string
	result string
}

func TestDecorateLinks(t *testing.T) {
	cases := []decorateLinkTest{
		{
			body:   "click www.google.com",
			result: "click $>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoid3d3Lmdvb2dsZS5jb20iLCJwdW55Y29kZSI6IiJ9fQ==$<kb$",
		},
		{
			body:   "https://maps.google.com?q=Goddess%20and%20the%20Baker,%20Legacy%20Tower,%20S%20Wabash%20Ave,%20Chicago,%20IL%2060603&ftid=0x880e2ca4623987cb:0x8b9a49f6050a873a&hl=en-US&gl=us",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9tYXBzLmdvb2dsZS5jb20/cT1Hb2RkZXNzJTIwYW5kJTIwdGhlJTIwQmFrZXIsJTIwTGVnYWN5JTIwVG93ZXIsJTIwUyUyMFdhYmFzaCUyMEF2ZSwlMjBDaGljYWdvLCUyMElMJTIwNjA2MDNcdTAwMjZmdGlkPTB4ODgwZTJjYTQ2MjM5ODdjYjoweDhiOWE0OWY2MDUwYTg3M2FcdTAwMjZobD1lbi1VU1x1MDAyNmdsPXVzIiwicHVueWNvZGUiOiIifX0=$<kb$",
		},
		{
			body:   "10.0.0.24",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiMTAuMC4wLjI0IiwicHVueWNvZGUiOiIifX0=$<kb$",
		},
		{
			body:   "ws-0.localdomain",
			result: "ws-0.localdomain",
		},
		{
			body:   "https://companyname.sharepoint.com/:f:/s/site-collection-name/subsite-name/Ds10TaJKAKhMp1hE0B_42WcBVhTHD3EQJKWhGprKFP3vpQ?e=14ohmf",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9jb21wYW55bmFtZS5zaGFyZXBvaW50LmNvbS86Zjovcy9zaXRlLWNvbGxlY3Rpb24tbmFtZS9zdWJzaXRlLW5hbWUvRHMxMFRhSktBS2hNcDFoRTBCXzQyV2NCVmhUSEQzRVFKS1doR3ByS0ZQM3ZwUT9lPTE0b2htZiIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "http://keybase.io/mikem;",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cDovL2tleWJhc2UuaW8vbWlrZW0iLCJwdW55Y29kZSI6IiJ9fQ==$<kb$;",
		},
		{
			body:   "keybase.io, hi",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoia2V5YmFzZS5pbyIsInB1bnljb2RlIjoiIn19$<kb$, hi",
		},
		{
			body:   "https://en.wikipedia.org/wiki/J/Z_(New_York_City_Subway_service)",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSi9aXyhOZXdfWW9ya19DaXR5X1N1YndheV9zZXJ2aWNlKSIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "(keybase.io)",
			result: "($>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoia2V5YmFzZS5pbyIsInB1bnljb2RlIjoiIn19$<kb$)",
		},
		{
			body:   "https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL0Bmb250LWZhY2UvdW5pY29kZS1yYW5nZSIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "\u202ehttps://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range",
			result: "\u202ehttps://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range",
		},
		{
			body:   "\u202e\u202dhttps://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range",
			result: "\u202e\u202d$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL0Bmb250LWZhY2UvdW5pY29kZS1yYW5nZSIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "`www.google.com`",
			result: "`www.google.com`",
		},
		{
			body:   "```www.google.com```",
			result: "```www.google.com```",
		},
		{
			body:   "> www.google.com",
			result: "> $>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoid3d3Lmdvb2dsZS5jb20iLCJwdW55Y29kZSI6IiJ9fQ==$<kb$",
		},
		{
			body:   "nytimes.json",
			result: "nytimes.json",
		},
		{
			body:   "mike.maxim@gmail.com",
			result: "$>kb$eyJ0eXAiOjUsIm1haWx0byI6eyJ1cmwiOiJtaWtlLm1heGltQGdtYWlsLmNvbSIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "mailto:mike.maxim@gmail.com",
			result: "mailto:$>kb$eyJ0eXAiOjUsIm1haWx0byI6eyJ1cmwiOiJtaWtlLm1heGltQGdtYWlsLmNvbSIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "mike.maxim@gmail.com/google.com",
			result: "$>kb$eyJ0eXAiOjUsIm1haWx0byI6eyJ1cmwiOiJtaWtlLm1heGltQGdtYWlsLmNvbSIsInB1bnljb2RlIjoiIn19$<kb$/google.com",
		},
		{
			body:   "https://medium.com/@wouterarkink/https-medium-com-wouterarkink-how-to-send-money-to-anyone-in-the-world-by-only-knowing-their-social-handle-3180e6cd4e58",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9tZWRpdW0uY29tL0B3b3V0ZXJhcmtpbmsvaHR0cHMtbWVkaXVtLWNvbS13b3V0ZXJhcmtpbmstaG93LXRvLXNlbmQtbW9uZXktdG8tYW55b25lLWluLXRoZS13b3JsZC1ieS1vbmx5LWtub3dpbmctdGhlaXItc29jaWFsLWhhbmRsZS0zMTgwZTZjZDRlNTgiLCJwdW55Y29kZSI6IiJ9fQ==$<kb$",
		},
		{
			body:   "https://drive.google.com/open?id=1BKcMML-uqOFAK-D4btEBlcoyodfvE4gg&authuser=cecile@keyba.se&usp=drive_fs",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL29wZW4/aWQ9MUJLY01NTC11cU9GQUstRDRidEVCbGNveW9kZnZFNGdnXHUwMDI2YXV0aHVzZXI9Y2VjaWxlQGtleWJhLnNlXHUwMDI2dXNwPWRyaXZlX2ZzIiwicHVueWNvZGUiOiIifX0=$<kb$",
		},
		{
			body:   "@google.com",
			result: "@google.com",
		},
		{
			body:   "/keybase/team/keybase.staff_v8/candidates/feedback-template.md",
			result: "/keybase/team/keybase.staff_v8/candidates/feedback-template.md",
		},
		{
			body:   "#google.com",
			result: "#$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiZ29vZ2xlLmNvbSIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "client/go/profiling/aggregate_timers.py",
			result: "client/go/profiling/aggregate_timers.py",
		},
		{
			body:   "cnn.com/@mike/index.html",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiY25uLmNvbS9AbWlrZS9pbmRleC5odG1sIiwicHVueWNvZGUiOiIifX0=$<kb$",
		},
		{
			body:   "google.com/mike?email=mike@gmail.com",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiZ29vZ2xlLmNvbS9taWtlP2VtYWlsPW1pa2VAZ21haWwuY29tIiwicHVueWNvZGUiOiIifX0=$<kb$",
		},
		{
			body:   "@keybase.bots.build.macos",
			result: "@keybase.bots.build.macos",
		},
		{
			body:   "keybase://team-page/keybasefriends",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoia2V5YmFzZTovL3RlYW0tcGFnZS9rZXliYXNlZnJpZW5kcyIsInB1bnljb2RlIjoiIn19$<kb$",
		},
		{
			body:   "keybase://team-page/keybasefriends https://github.com",
			result: "$>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoia2V5YmFzZTovL3RlYW0tcGFnZS9rZXliYXNlZnJpZW5kcyIsInB1bnljb2RlIjoiIn19$<kb$ $>kb$eyJ0eXAiOjQsImxpbmsiOnsidXJsIjoiaHR0cHM6Ly9naXRodWIuY29tIiwicHVueWNvZGUiOiIifX0=$<kb$",
		},
	}
	for _, c := range cases {
		res := DecorateWithLinks(context.TODO(), c.body)
		require.Equal(t, c.result, res, "incorrect encoding for body %s", c.body)
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
		{
			Username:    "[tofurkey@example.com]@email",
			ContactName: &tofurkeyhq,
		},
		{
			Username:    "18005558638@phone",
			ContactName: &tofurus,
		},
		{
			Username: "ayoubd",
			Fullname: &danny,
		},
		{
			Username: "example@twitter",
		},
	}
	res := PresentConversationParticipantsLocal(context.TODO(), rawParticipants)

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
		{
			Username: "[tofurkey@example.com]@email",
		},
		{
			Username: "18005558638@phone",
		},
		{
			Username: "ayoubd",
		},
		{
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

func TestTLFIsTeamID(t *testing.T) {
	teamID := keybase1.MakeTestTeamID(3, false)
	tlfID := chat1.TLFID(teamID.ToBytes())
	require.True(t, tlfID.IsTeamID())

	tlfID = chat1.TLFID{0}
	require.False(t, tlfID.IsTeamID())

	uid := keybase1.MakeTestUID(3)
	tlfID = chat1.TLFID(uid.ToBytes())
	require.False(t, tlfID.IsTeamID())
}

func TestSearchableRemoteConversationName(t *testing.T) {
	require.Equal(t, "zoommikem", searchableRemoteConversationNameFromStr("mikem,zoommikem", "mikem"))
	require.Equal(t, "zoommikem", searchableRemoteConversationNameFromStr("zoommikem,mikem", "mikem"))
	require.Equal(t, "zoommikem,max",
		searchableRemoteConversationNameFromStr("zoommikem,mikem,max", "mikem"))
	require.Equal(t, "zoommikem,zoomua",
		searchableRemoteConversationNameFromStr("zoommikem,mikem,zoomua", "mikem"))
	require.Equal(t, "joshblum,zoommikem,zoomua",
		searchableRemoteConversationNameFromStr("joshblum,zoommikem,mikem,zoomua", "mikem"))
	require.Equal(t, "joshblum,zoommikem,zoomua",
		searchableRemoteConversationNameFromStr("joshblum,zoommikem,mikem,zoomua,mikem", "mikem"))
}
