package utils

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// parseDurationExtended is like time.ParseDuration, but adds "d" unit. "1d" is
// one day, defined as 24*time.Hour. Only whole days are supported for "d"
// unit, but it can be followed by smaller units, e.g., "1d1h".
func ParseDurationExtended(s string) (d time.Duration, err error) {
	p := strings.Index(s, "d")
	if p == -1 {
		// no "d" suffix
		return time.ParseDuration(s)
	}

	var days int
	if days, err = strconv.Atoi(s[:p]); err != nil {
		return time.Duration(0), err
	}
	d = time.Duration(days) * 24 * time.Hour

	if p < len(s)-1 {
		var dur time.Duration
		if dur, err = time.ParseDuration(s[p+1:]); err != nil {
			return time.Duration(0), err
		}
		d += dur
	}

	return d, nil
}

func ParseTimeFromRFC3339OrDurationFromPast(g *libkb.GlobalContext, s string) (t time.Time, err error) {
	var errt, errd error
	var d time.Duration

	if s == "" {
		return
	}

	if t, errt = time.Parse(time.RFC3339, s); errt == nil {
		return t, nil
	}
	if d, errd = ParseDurationExtended(s); errd == nil {
		return g.Clock().Now().Add(-d), nil
	}

	return time.Time{}, fmt.Errorf("given string is neither a valid time (%s) nor a valid duration (%v)", errt, errd)
}

// upper bounds takes higher priority
func Collar(lower int, ideal int, upper int) int {
	if ideal > upper {
		return upper
	}
	if ideal < lower {
		return lower
	}
	return ideal
}

// AggRateLimitsP takes a list of rate limit responses and dedups them to the last one received
// of each category
func AggRateLimitsP(rlimits []*chat1.RateLimit) (res []chat1.RateLimit) {
	m := make(map[string]chat1.RateLimit)
	for _, l := range rlimits {
		if l != nil {
			m[l.Name] = *l
		}
	}
	for _, v := range m {
		res = append(res, v)
	}
	return res
}

func AggRateLimits(rlimits []chat1.RateLimit) (res []chat1.RateLimit) {
	m := make(map[string]chat1.RateLimit)
	for _, l := range rlimits {
		m[l.Name] = l
	}
	for _, v := range m {
		res = append(res, v)
	}
	return res
}

// Reorder participants based on the order in activeList.
// Only allows usernames from tlfname in the output.
// This never fails, worse comes to worst it just returns the split of tlfname.
func ReorderParticipants(ctx context.Context, upakLoader libkb.UPAKLoader, tlfname string, activeList []gregor1.UID) (writerNames []string, readerNames []string, err error) {
	srcWriterNames, srcReaderNames, _, err := splitAndNormalizeTLFNameCanonicalize(tlfname, false)
	if err != nil {
		return writerNames, readerNames, err
	}

	allowedWriters := make(map[string]bool)

	// Allow all writers from tlfname.
	for _, user := range srcWriterNames {
		allowedWriters[user] = true
	}

	// Fill from the active list first.
	for _, uid := range activeList {
		kbUID := keybase1.UID(uid.String())
		normalizedUsername, err := upakLoader.LookupUsername(ctx, kbUID)
		if err != nil {
			continue
		}
		user := normalizedUsername.String()
		user, err = normalizeAssertionOrName(user)
		if err != nil {
			continue
		}
		if allowed, _ := allowedWriters[user]; allowed {
			writerNames = append(writerNames, user)
			// Allow only one occurrence.
			allowedWriters[user] = false
		}
	}

	// Include participants even if they weren't in the active list, in stable order.
	for _, user := range srcWriterNames {
		if allowed, _ := allowedWriters[user]; allowed {
			writerNames = append(writerNames, user)
			allowedWriters[user] = false
		}
	}

	readerNames = srcReaderNames

	return writerNames, readerNames, nil
}

// Drive splitAndNormalizeTLFName with one attempt to follow TlfNameNotCanonical.
func splitAndNormalizeTLFNameCanonicalize(name string, public bool) (writerNames, readerNames []string, extensionSuffix string, err error) {
	writerNames, readerNames, extensionSuffix, err = splitAndNormalizeTLFName(name, public)
	if retryErr, retry := err.(TlfNameNotCanonical); retry {
		return splitAndNormalizeTLFName(retryErr.NameToTry, public)
	}
	return writerNames, readerNames, extensionSuffix, err
}

const (
	ChatTopicIDLen    = 16
	ChatTopicIDSuffix = 0x20
)

func NewChatTopicID() (id []byte, err error) {
	if id, err = libkb.RandBytes(ChatTopicIDLen); err != nil {
		return nil, err
	}
	id[len(id)-1] = ChatTopicIDSuffix
	return id, nil
}

func AllChatConversationStatuses() (res []chat1.ConversationStatus) {
	for _, s := range chat1.ConversationStatusMap {
		res = append(res, s)
	}
	return
}

func VisibleChatConversationStatuses() []chat1.ConversationStatus {
	return []chat1.ConversationStatus{
		chat1.ConversationStatus_UNFILED,
		chat1.ConversationStatus_FAVORITE,
	}
}

func IsVisibleChatConversationStatus(status chat1.ConversationStatus) bool {
	for _, s := range VisibleChatConversationStatuses() {
		if status == s {
			return true
		}
	}
	return false
}

func VisibleChatMessageTypes() []chat1.MessageType {
	return []chat1.MessageType{
		chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT,
	}
}

func IsVisibleChatMessageType(messageType chat1.MessageType) bool {
	for _, mt := range VisibleChatMessageTypes() {
		if messageType == mt {
			return true
		}
	}
	return false
}

type DebugLabeler struct {
	libkb.Contextified
	label   string
	verbose bool
}

func NewDebugLabeler(g *libkb.GlobalContext, label string, verbose bool) DebugLabeler {
	return DebugLabeler{
		Contextified: libkb.NewContextified(g),
		label:        label,
		verbose:      verbose,
	}
}

func (d DebugLabeler) showVerbose() bool {
	return false
}

func (d DebugLabeler) showLog() bool {
	if d.verbose {
		return d.showVerbose()
	}
	return true
}

func (d DebugLabeler) Debug(ctx context.Context, msg string, args ...interface{}) {
	if d.showLog() {
		d.G().Log.CDebugf(ctx, "++Chat: "+d.label+": "+msg, args...)
	}
}

func (d DebugLabeler) Trace(ctx context.Context, f func() error, msg string) func() {
	if d.showLog() {
		d.G().Log.CDebugf(ctx, "++Chat: %s: + %s", d.label, msg)
		return func() {
			d.G().Log.CDebugf(ctx, "++Chat: %s: - %s -> %s", d.label, msg,
				libkb.ErrToOk(f()))
		}
	}
	return func() {}
}
