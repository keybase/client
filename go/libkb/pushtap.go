package libkb

import (
	"context"
	"encoding/json"
	"strings"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
)

// PendingPushTap holds the route a tapped notification resolved to until a
// client says it has acted on it.
//
// It is the whole of the exactly-once guarantee for a tap. A tap can arrive
// when no client exists -- on iOS a tap that launches the process, on Android a
// tap that starts PushTapActivity before the RN host -- so it has to wait
// somewhere that outlives the client, which is here.
//
// Reading does not clear, because a reply lost on the way out would take the
// tap with it and nothing would be left to say a tap had ever happened. The
// client is the only party that knows it acted, so the client says so: Peek
// leaves the route armed and Ack retires it. Each route carries an id, so an
// ack that crosses a newer tap retires nothing.
type PendingPushTap struct {
	Contextified
	sync.Mutex
	route  *keybase1.PushTapRoute
	lastID int
}

func NewPendingPushTap(g *GlobalContext) *PendingPushTap {
	return &PendingPushTap{Contextified: NewContextified(g)}
}

// Set stores the route a tap resolved to, gives it a fresh id, and nudges
// connected clients. A tap not yet acked is replaced: the newest tap is the one
// the user just made, and queueing them would navigate through a backlog.
//
// Ids count the taps of this process and start at 1, so 0 is never a route a
// client has seen and is safe as a client-side sentinel.
func (p *PendingPushTap) Set(ctx context.Context, route keybase1.PushTapRoute) {
	p.Lock()
	p.lastID++
	route.Id = p.lastID
	p.route = &route
	p.Unlock()
	p.G().NotifyRouter.HandlePushTapRouteAvailable(ctx)
}

// Peek returns the waiting route without retiring it, or nil when none is
// waiting. It stays armed for the next reader until it is acked. The result is
// a copy, so the holder's own route is never reachable through a reader.
func (p *PendingPushTap) Peek() *keybase1.PushTapRoute {
	p.Lock()
	defer p.Unlock()
	if p.route == nil {
		return nil
	}
	route := *p.route
	return &route
}

// Ack retires the waiting route if it is still the one with this id, and
// reports whether it did. A stale id means a newer tap arrived while the ack
// was in flight, and that one must survive to be acted on.
func (p *PendingPushTap) Ack(id int) bool {
	p.Lock()
	defer p.Unlock()
	if p.route == nil || p.route.Id != id {
		return false
	}
	p.route = nil
	return true
}

// pushTapNoRouteTypes are the push types a tap never opens anything for: they
// are acted on natively and here, and have no screen of their own.
var pushTapNoRouteTypes = map[string]bool{
	"autoreset":               true,
	"chat.failedpending":      true,
	"chat.newmessageSilent_2": true,
	"chat.readmessage":        true,
}

// pushTapContactPrefix is all that is read of a contact-joined message. The
// rest names a person, and only the prefix decides the destination.
const pushTapContactPrefix = "Your contact"

// ResolvePushTap turns the payload of a tapped notification into the route it
// opens. The second result is false when the tap only opens the app.
//
// payloadJSON is the push as the OS delivered it -- APNs userInfo on iOS, the
// FCM data Bundle on Android -- so every value is whatever the sender put
// there: fields may be missing, and a number is as likely as a string.
func ResolvePushTap(payloadJSON string) (keybase1.PushTapRoute, bool) {
	var none keybase1.PushTapRoute
	if !json.Valid([]byte(payloadJSON)) {
		return none, false
	}
	dec := json.NewDecoder(strings.NewReader(payloadJSON))
	// Numbers keep their literal text, so a numeric convID reads back as the
	// digits that were sent rather than a float rendering of them.
	dec.UseNumber()
	var parsed any
	if err := dec.Decode(&parsed); err != nil {
		return none, false
	}
	fields, isObject := parsed.(map[string]any)
	if !isObject {
		return none, false
	}
	get := func(key string) string {
		switch value := fields[key].(type) {
		case string:
			return value
		case json.Number:
			return value.String()
		default:
			return ""
		}
	}
	forAccount := func(url, uid string) (keybase1.PushTapRoute, bool) {
		return keybase1.PushTapRoute{Url: url, TargetUID: uid}, true
	}

	typ := get("type")
	switch {
	case typ == "chat.newmessage":
		if convID := get("convID"); convID != "" {
			return forAccount("keybase://convid/"+encodeURIComponent(convID), get("uid"))
		}
	case typ == "follow":
		if username := get("username"); username != "" {
			uid := get("uid")
			if uid == "" {
				uid = get("targetUID")
			}
			return forAccount("keybase://profile/show/"+encodeURIComponent(username), uid)
		}
	case typ == "device.new", typ == "device.revoked":
		if uid := get("uid"); uid != "" {
			return forAccount("keybase://devices", uid)
		}
	case pushTapNoRouteTypes[typ]:
	default:
		if strings.HasPrefix(get("message"), pushTapContactPrefix) {
			// No account: a contact-joined push is not account-scoped, so a tap
			// on it must not switch accounts.
			return keybase1.PushTapRoute{Url: "keybase://tabs.peopleTab"}, true
		}
	}
	return none, false
}

const pushTapUnreservedMarks = "-_.!~*'()"

// encodeURIComponent escapes a path segment the way JavaScript's function of
// that name does. Go's url escapers each differ from it somewhere -- a space,
// or one of the marks below -- and the result here is compared against URLs
// clients build with the JavaScript one.
func encodeURIComponent(s string) string {
	var out strings.Builder
	const hex = "0123456789ABCDEF"
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9',
			strings.IndexByte(pushTapUnreservedMarks, c) >= 0:
			out.WriteByte(c)
		default:
			out.WriteByte('%')
			out.WriteByte(hex[c>>4])
			out.WriteByte(hex[c&0xf])
		}
	}
	return out.String()
}
