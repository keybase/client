package service

import (
	"context"
	"encoding/json"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
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

func buildGregorUIPrefs(s gregor1.State) keybase1.GregorUIPrefs {
	res := keybase1.GregorUIPrefs{
		PinnedConvs:             []string{},
		ExplodingModes:          map[string]int{},
		ChosenChannelsTeamnames: []string{},
		BlockButtonsAdders:      map[string]string{},
		TeamAccessRequests:      map[string][]string{},
		AllowAnimatedEmojis:     true,
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
			if secs, err := strconv.Atoi(strings.TrimSpace(string(body))); err == nil {
				res.ExplodingModes[strings.TrimPrefix(category, explodingModeGregorPrefix)] = secs
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

	// held across the send so pushes from concurrent pushStateOnce calls go out in the order
	// last records
	mu   sync.Mutex
	last *keybase1.GregorUIPrefs
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

func (h *gregorUIPrefsHandler) PushState(s gregor1.State, r keybase1.PushReason) {
	prefs := buildGregorUIPrefs(s)
	h.mu.Lock()
	defer h.mu.Unlock()
	if r != keybase1.PushReason_RECONNECTED && h.last != nil && reflect.DeepEqual(*h.last, prefs) {
		return
	}
	h.last = &prefs
	if err := h.cli.PushUIPrefs(context.Background(), prefs); err != nil {
		h.G().Log.Errorf("Error in gregor UI prefs push: %s", err)
	}
}

func (h *gregorUIPrefsHandler) PushOutOfBandMessages([]gregor1.OutOfBandMessage) {}
