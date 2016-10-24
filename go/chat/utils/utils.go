package utils

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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

func ParseTimeFromRFC3339OrDurationFromPast(kbCtx KeybaseContext, s string) (t time.Time, err error) {
	var errt, errd error
	var d time.Duration

	if s == "" {
		return
	}

	if t, errt = time.Parse(time.RFC3339, s); errt == nil {
		return t, nil
	}
	if d, errd = ParseDurationExtended(s); errd == nil {
		return kbCtx.Clock().Now().Add(-d), nil
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

func FilterByType(msgs []chat1.MessageUnboxed, query *chat1.GetThreadQuery) (res []chat1.MessageUnboxed) {
	if query != nil && len(query.MessageTypes) > 0 {
		typmap := make(map[chat1.MessageType]bool)
		for _, mt := range query.MessageTypes {
			typmap[mt] = true
		}
		for _, msg := range msgs {
			if _, ok := typmap[msg.GetMessageType()]; ok {
				res = append(res, msg)
			}
		}
	} else {
		res = msgs
	}
	return res
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
func ReorderParticipants(udc *UserDeviceCache, uimap *UserInfoMapper, tlfname string, activeList []gregor1.UID) []string {
	tlfnameList := splitTlfName(tlfname)
	allowedUsers := make(map[string]bool)
	var users []string

	// Allow all users from tlfname.
	for _, user := range tlfnameList {
		allowedUsers[user] = true
	}

	// Fill from the active list first.
	for _, uid := range activeList {
		kbUID := keybase1.UID(uid.String())
		user, err := udc.LookupUsername(uimap, kbUID)
		if err != nil {
			continue
		}
		if allowed, _ := allowedUsers[user]; allowed {
			users = append(users, user)
			// Allow only one occurrence.
			allowedUsers[user] = false
		}
	}

	// Include participants even if they weren't in the active list, in stable order.
	for _, user := range tlfnameList {
		if allowed, _ := allowedUsers[user]; allowed {
			users = append(users, user)
			allowedUsers[user] = false
		}
	}

	return users
}

// Split a tlf name into its users.
// Does not validate the usernames.
func splitTlfName(tlfname string) []string {
	writerSep := ","
	readerSep := "#"
	extensionSep := " "

	// Strip off the suffix
	s2 := strings.Split(tlfname, extensionSep)
	tlfname = s2[0]
	// Replace "#" with ","
	tlfname = strings.Replace(tlfname, writerSep, readerSep, -1)
	// Split on ","
	return strings.Split(tlfname, readerSep)
}
