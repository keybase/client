package chat

import (
	"context"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
)

// All devices are presumed active for the first 24 hours. See comment below.
var InitialAssumedActiveInterval = 24 * time.Hour
var ActiveIntervalAfterSend = 30 * 24 * time.Hour

func chatActiveDBKey(name string) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatActive,
		Key: name,
	}
}

func firstQueryTimeDbKey() libkb.DbKey {
	return chatActiveDBKey("first_query_time")
}

func lastSendTimeDbKey() libkb.DbKey {
	return chatActiveDBKey("last_send_time")
}

// If no first query time is found in the local db, this function writes the
// current time.
func TouchFirstChatActiveQueryTime(ctx context.Context, g *globals.Context, log utils.DebugLabeler) time.Time {
	now := time.Now()
	var firstQueryUnixTime int64
	found, err := g.LocalChatDb.GetInto(&firstQueryUnixTime, firstQueryTimeDbKey())
	// Warn for errors and bail.
	if err != nil {
		log.Debug(ctx, "Failed to get chat active query time: %s", err)
		return now
	}
	// If the first query time doesn't exist, store Now(). Don't return Now()
	// directly, though, since that has extra metadata in it what won't be
	// there when we deserialize from the db.
	if !found {
		log.Debug(ctx, "Chat active query time not found. Storing current time.")
		firstQueryUnixTime = now.Unix()
		err := g.LocalChatDb.PutObj(firstQueryTimeDbKey(), nil, firstQueryUnixTime)
		if err != nil {
			log.Debug(ctx, "Failed to store chat active query time: %s", err)
		}
	}
	// Otherwise return what we found.
	return time.Unix(firstQueryUnixTime, 0)
}

// Returns the zero time if there is no recorded last send time (either because
// the device has never sent a message, or because it hasn't sent one since we
// started recording).
func GetLastSendTime(ctx context.Context, g *globals.Context, log utils.DebugLabeler) time.Time {
	var zeroTime time.Time
	var lastSendUnixTime int64
	found, err := g.LocalChatDb.GetInto(&lastSendUnixTime, lastSendTimeDbKey())
	// Warn for errors and return zero.
	if err != nil {
		log.Debug(ctx, "Failed to get chat active last send time: %s", err)
		return zeroTime
	}
	// If the last time doesn't exist, again return zero.
	if !found {
		return zeroTime
	}
	// Otherwise return what we found.
	return time.Unix(lastSendUnixTime, 0)
}

func RecordChatSend(ctx context.Context, g *globals.Context, log utils.DebugLabeler) {
	err := g.LocalChatDb.PutObj(lastSendTimeDbKey(), nil, time.Now().Unix())
	if err != nil {
		log.Debug(ctx, "Failed to store chat last send time: %s", err)
	}
}
