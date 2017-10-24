package utils

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"

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
	text := "@chat_1e2263952c @9mike hello! @mike From @chat_5511c5e0ce. @ksjdskj 889@ds8 @_dskdjs @k1"
	matches := ParseAtMentionsNames(context.TODO(), text)
	expected := []string{"chat_1e2263952c", "mike", "chat_5511c5e0ce", "ksjdskj", "k1"}
	require.Equal(t, expected, matches)
	text = "@mike@jim"
	matches = ParseAtMentionsNames(context.TODO(), text)
	expected = []string{"mike"}
	require.Equal(t, expected, matches)
}

type testTeamChannelSource struct {
	channels []string
}

func newTestTeamChannelSource(channels []string) *testTeamChannelSource {
	return &testTeamChannelSource{
		channels: channels,
	}
}

func (t *testTeamChannelSource) GetChannelsTopicName(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType, membersType chat1.ConversationMembersType) (res []types.ConvIDAndTopicName, rl []chat1.RateLimit, err error) {
	for _, c := range t.channels {
		res = append(res, types.ConvIDAndTopicName{
			TopicName: c,
		})
	}
	return res, rl, nil
}

func (t *testTeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType, membersType chat1.ConversationMembersType) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {
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
	matches := ParseChannelNameMentions(context.TODO(), text, uid, teamID, chat1.ConversationMembersType_TEAM,
		newTestTeamChannelSource(chans))
	expected := []string{"miketime", "general", "random"}
	require.Equal(t, expected, matches)
}
