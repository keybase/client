package service

import (
	"context"
	"encoding/json"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"sync"
	"unicode"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// Categories written by the GUI or the server that only the GUI reads.
const (
	chosenChannelsGregorKey       = "chosenChannelsForTeam"
	emojiAnimationsGregorKey      = "emojianimations"
	explodingModeGregorPrefix     = "exploding:"
	teamAccessRequestGregorPrefix = "team.request_access:"
)

func pinnedConvsFromState(s gregor1.State) []chat1.ConvIDStr {
	for _, it := range s.Items_ {
		if it.Item_ != nil && it.Item_.Category_.String() == utils.PinnedConvsGregorKey {
			return utils.ParsePinnedConvs(it.Item_.Body_.Bytes())
		}
	}
	return nil
}

// parseLeadingInt reads an integer the way JS parseInt(s, 10) does: optional leading whitespace
// and sign, then digits, ignoring anything after them. The GUI wrote these values and read them
// back with parseInt, so it accepted those forms.
func parseLeadingInt(s string) (int, bool) {
	s = strings.TrimLeftFunc(s, unicode.IsSpace)
	end := 0
	if end < len(s) && (s[end] == '+' || s[end] == '-') {
		end++
	}
	digits := end
	for end < len(s) && s[end] >= '0' && s[end] <= '9' {
		end++
	}
	if end == digits {
		return 0, false
	}
	n, err := strconv.Atoi(s[:end])
	return n, err == nil
}

func buildGregorUIPrefs(ctx context.Context, log logger.Logger, s gregor1.State) keybase1.GregorUIPrefs {
	res := keybase1.GregorUIPrefs{
		PinnedConvs:              []string{},
		ExplodingModes:           map[string]int{},
		UnreadableExplodingModes: []string{},
		ChosenChannelsTeamnames:  []string{},
		BlockButtonsAdders:       map[string]string{},
		TeamAccessRequests:       map[string][]string{},
		AllowAnimatedEmojis:      true,
	}
	for _, id := range pinnedConvsFromState(s) {
		res.PinnedConvs = append(res.PinnedConvs, id.String())
	}
	for _, it := range s.Items_ {
		if it.Item_ == nil {
			continue
		}
		category := it.Item_.Category_.String()
		body := it.Item_.Body_.Bytes()
		switch {
		case category == emojiAnimationsGregorKey:
			res.AllowAnimatedEmojis = false
		case category == chosenChannelsGregorKey:
			var names []any
			if json.Unmarshal(body, &names) == nil {
				for _, n := range names {
					if name, ok := n.(string); ok && !slices.Contains(res.ChosenChannelsTeamnames, name) {
						res.ChosenChannelsTeamnames = append(res.ChosenChannelsTeamnames, name)
					}
				}
			}
		case strings.HasPrefix(category, explodingModeGregorPrefix):
			convID := strings.TrimPrefix(category, explodingModeGregorPrefix)
			if secs, ok := parseLeadingInt(string(body)); ok {
				res.ExplodingModes[convID] = secs
			} else {
				log.CWarningf(ctx, "buildGregorUIPrefs: unreadable exploding mode %q for %s", body, convID)
				res.UnreadableExplodingModes = append(res.UnreadableExplodingModes, convID)
			}
		case strings.HasPrefix(category, blockButtonsGregorPrefix):
			var b struct {
				Adder string `json:"adder"`
			}
			if json.Unmarshal(body, &b) == nil && b.Adder != "" {
				res.BlockButtonsAdders[strings.TrimPrefix(category, blockButtonsGregorPrefix)] = b.Adder
			}
		case strings.HasPrefix(category, teamAccessRequestGregorPrefix):
			var r struct {
				ID       string `json:"id"`
				Username string `json:"username"`
			}
			if json.Unmarshal(body, &r) == nil && r.ID != "" && r.Username != "" &&
				!slices.Contains(res.TeamAccessRequests[r.ID], r.Username) {
				res.TeamAccessRequests[r.ID] = append(res.TeamAccessRequests[r.ID], r.Username)
			}
		}
	}
	for _, names := range res.TeamAccessRequests {
		slices.Sort(names)
	}
	return res
}

// gregorUIPrefsHandler is a firehose handler that sends the GUI GregorUIPrefs instead of the
// raw state, and only when they changed. A RECONNECTED push (login, or this handler being
// registered) always sends, since the GUI clears its copy on logout.
type gregorUIPrefsHandler struct {
	libkb.Contextified
	connID libkb.ConnectionID
	cli    keybase1.GregorUIClient

	// held across the send, so each push either goes out after the pushes of every older read or
	// is dropped
	mu      sync.Mutex
	lastSeq uint64
	last    *keybase1.GregorUIPrefs
}

var _ libkb.GregorFirehoseHandler = (*gregorUIPrefsHandler)(nil)

func newGregorUIPrefsHandler(g *libkb.GlobalContext, connID libkb.ConnectionID, xp rpc.Transporter) *gregorUIPrefsHandler {
	return &gregorUIPrefsHandler{
		Contextified: libkb.NewContextified(g),
		connID:       connID,
		cli:          keybase1.GregorUIClient{Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), nil)},
	}
}

func (h *gregorUIPrefsHandler) IsAlive() bool {
	return h.G().ConnectionManager.LookupConnection(h.connID) != nil
}

// PushState is unused: the gregor handler pushes through pushStateRead, which knows the read order.
func (h *gregorUIPrefsHandler) PushState(gregor1.State, keybase1.PushReason) {}

func (h *gregorUIPrefsHandler) pushStateRead(s gregor1.State, r keybase1.PushReason, read gregorStateRead) {
	ctx := context.Background()
	prefs := buildGregorUIPrefs(ctx, h.G().Log, s)
	h.mu.Lock()
	defer h.mu.Unlock()
	if read.seq <= h.lastSeq || read.sessionEnded() {
		return
	}
	h.lastSeq = read.seq
	if r != keybase1.PushReason_RECONNECTED && h.last != nil && reflect.DeepEqual(*h.last, prefs) {
		return
	}
	h.last = &prefs
	if err := h.cli.PushUIPrefs(ctx, keybase1.PushUIPrefsArg{Prefs: prefs, Uid: read.uid}); err != nil {
		h.G().Log.Errorf("Error in gregor UI prefs push: %s", err)
	}
}

func (h *gregorUIPrefsHandler) PushOutOfBandMessages([]gregor1.OutOfBandMessage) {}
