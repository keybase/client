package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func topicNameCacheFixture() (chat1.TLFID, chat1.TopicType, gregor1.UID, []chat1.ChannelNameMention) {
	tlfID := chat1.TLFID([]byte{0x01, 0x02})
	uid := gregor1.UID([]byte{0x0a})
	names := []chat1.ChannelNameMention{
		{ConvID: chat1.ConversationID([]byte{0x10}), TopicName: "general"},
		{ConvID: chat1.ConversationID([]byte{0x11}), TopicName: "random"},
	}
	return tlfID, chat1.TopicType_CHAT, uid, names
}

func TestTopicNameMemCacheRoundTrip(t *testing.T) {
	tlfID, topicType, uid, names := topicNameCacheFixture()
	c := newTopicNameMemCache()

	_, ok := c.Get(tlfID, topicType, uid)
	require.False(t, ok, "an empty cache must miss")

	c.Put(tlfID, topicType, uid, names)
	got, ok := c.Get(tlfID, topicType, uid)
	require.True(t, ok)
	require.Equal(t, names, got)
}

func TestTopicNameMemCacheKeysAreDistinct(t *testing.T) {
	tlfID, topicType, uid, names := topicNameCacheFixture()
	c := newTopicNameMemCache()
	c.Put(tlfID, topicType, uid, names)

	otherTLF := chat1.TLFID([]byte{0x09, 0x09})
	otherUID := gregor1.UID([]byte{0xbb})

	_, ok := c.Get(otherTLF, topicType, uid)
	require.False(t, ok, "a different TLF must not share an entry")
	_, ok = c.Get(tlfID, chat1.TopicType_DEV, uid)
	require.False(t, ok, "a different topic type must not share an entry")
	_, ok = c.Get(tlfID, topicType, otherUID)
	require.False(t, ok, "a different uid must not share an entry")

	// The original is still there and untouched by the misses.
	got, ok := c.Get(tlfID, topicType, uid)
	require.True(t, ok)
	require.Equal(t, names, got)
}

// The cached slice is shared with every caller, so neither side may be able to reach into it.
func TestTopicNameMemCacheCopiesBothWays(t *testing.T) {
	tlfID, topicType, uid, names := topicNameCacheFixture()
	c := newTopicNameMemCache()
	c.Put(tlfID, topicType, uid, names)

	// Mutating what the caller passed in must not reach the cache.
	names[0].TopicName = "mutated-input"
	got, ok := c.Get(tlfID, topicType, uid)
	require.True(t, ok)
	require.Equal(t, "general", got[0].TopicName)

	// Mutating what the caller got back must not reach the cache either.
	got[0].TopicName = "mutated-output"
	again, ok := c.Get(tlfID, topicType, uid)
	require.True(t, ok)
	require.Equal(t, "general", again[0].TopicName)
}

func TestTopicNameMemCacheExpires(t *testing.T) {
	tlfID, topicType, uid, names := topicNameCacheFixture()
	c := newTopicNameMemCache()
	c.Put(tlfID, topicType, uid, names)

	key := c.key(tlfID, topicType, uid)

	// Still inside the window.
	c.Lock()
	item := c.cache[key]
	item.mtime = gregor1.ToTime(time.Now().Add(-topicNameCacheDuration + time.Second))
	c.cache[key] = item
	c.Unlock()
	_, ok := c.Get(tlfID, topicType, uid)
	require.True(t, ok, "an entry inside the TTL must hit")

	// Past it. There is no explicit invalidation, so expiry is the only thing keeping a renamed
	// channel from being served forever.
	c.Lock()
	item = c.cache[key]
	item.mtime = gregor1.ToTime(time.Now().Add(-topicNameCacheDuration - time.Second))
	c.cache[key] = item
	c.Unlock()
	_, ok = c.Get(tlfID, topicType, uid)
	require.False(t, ok, "an entry past the TTL must miss")
}

// An empty conversation list is never a legitimate answer for a chat TLF, so it must not be cached.
// This pins the guard at the cache level; the caller-side guard lives in GetChannelsTopicName.
func TestTopicNameMemCacheEmptyIsStillAValue(t *testing.T) {
	tlfID, topicType, uid, _ := topicNameCacheFixture()
	c := newTopicNameMemCache()

	// The cache itself stores whatever it is given, including nothing - which is exactly why the
	// caller must not hand it a degraded read.
	c.Put(tlfID, topicType, uid, nil)
	got, ok := c.Get(tlfID, topicType, uid)
	require.True(t, ok, "an empty slice is a cached value, not a miss")
	require.Empty(t, got)
}

// The TTL is the only bound on staleness - there is no invalidation hook - and the comment on the
// constant argues from it being short. Pin the value so widening it is a deliberate act.
func TestTopicNameCacheDurationStaysShort(t *testing.T) {
	require.LessOrEqual(t, topicNameCacheDuration, 30*time.Second,
		"a longer window widens the hole where a resolution is stored stale into a message")
	require.Positive(t, topicNameCacheDuration)
}

func TestTopicNameMemCacheClear(t *testing.T) {
	tlfID, topicType, uid, names := topicNameCacheFixture()
	c := newTopicNameMemCache()
	c.Put(tlfID, topicType, uid, names)

	c.clearCache()
	_, ok := c.Get(tlfID, topicType, uid)
	require.False(t, ok, "clearCache must drop everything")

	// Logout and db nuke both go through the same clear, and both must leave the cache usable.
	c.Put(tlfID, topicType, uid, names)
	require.NoError(t, c.OnLogout(libkb.MetaContext{}))
	_, ok = c.Get(tlfID, topicType, uid)
	require.False(t, ok, "OnLogout must drop everything")

	c.Put(tlfID, topicType, uid, names)
	require.NoError(t, c.OnDbNuke(libkb.MetaContext{}))
	_, ok = c.Get(tlfID, topicType, uid)
	require.False(t, ok, "OnDbNuke must drop everything")
}
