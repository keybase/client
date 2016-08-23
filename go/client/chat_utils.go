package client

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type uidUsernameMapper map[keybase1.UID]string

func (m uidUsernameMapper) getUsername(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (string, error) {
	if m == nil {
		m = make(uidUsernameMapper)
	}

	if username, ok := m[uid]; ok {
		return username, nil
	}

	userClient, err := GetUserClient(g)
	if err != nil {
		return "", err
	}
	var ret keybase1.User
	if ret, err = userClient.LoadUser(ctx, keybase1.LoadUserArg{
		Uid: uid,
	}); err != nil {
		return "", err
	}

	m[uid] = ret.Username
	return ret.Username, err
}

// parseDurationExtended is like time.ParseDuration, but adds "d" unit. "1d" is
// one day, defined as 24*time.Hour. Only whole days are supported for "d"
// unit, but it can be followed by smaller units, e.g., "1d1h".
func parseDurationExtended(s string) (d time.Duration, err error) {
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

	if p < len(s) {
		var dur time.Duration
		if dur, err = time.ParseDuration(s[p+1:]); err != nil {
			return time.Duration(0), err
		}
		d += dur
	}

	return d, nil
}

func parseTimeFromRFC3339OrDurationFromPast(s string) (t time.Time, err error) {
	var errt, errd error
	var d time.Duration

	if s == "" {
		return
	}

	if t, errt = time.Parse(time.RFC3339, s); errt == nil {
		return t, nil
	}
	if d, errd = parseDurationExtended(s); errd == nil {
		return time.Now().Add(-d), nil
	}

	return time.Time{}, fmt.Errorf("given string is neither a valid time (%s) nor a valid duration (%v)", errt, errd)

}
