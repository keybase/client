package chat

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type IdentifyNotifier struct {
	libkb.Contextified
	sync.RWMutex
	identCache map[string]keybase1.CanonicalTLFNameAndIDWithBreaks
}

func NewIdentifyNotifier(g *libkb.GlobalContext) *IdentifyNotifier {
	return &IdentifyNotifier{
		Contextified: libkb.NewContextified(g),
		identCache:   make(map[string]keybase1.CanonicalTLFNameAndIDWithBreaks),
	}
}

func (i *IdentifyNotifier) Send(update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	i.RLock()
	tlfName := update.CanonicalName.String()
	stored, ok := i.identCache[tlfName]
	i.RUnlock()
	if ok {
		// We have the exact update stored, don't send it again
		if stored.Eq(update) {
			i.G().Log.Debug("IdentifyNotifier: hit cache, not sending notify: %s", tlfName)
			return
		}
	}

	i.Lock()
	i.identCache[tlfName] = update
	i.Unlock()

	i.G().Log.Debug("IdentifyNotifier: cache miss, sending notify: %s dat: %v", tlfName, update)
	i.G().NotifyRouter.HandleChatIdentifyUpdate(context.Background(), update)
}

type IdentifyChangedHandler struct {
	libkb.Contextified
	utils.DebugLabeler

	tlf func() keybase1.TlfInterface
}

func NewIdentifyChangedHandler(g *libkb.GlobalContext, tlf func() keybase1.TlfInterface) *IdentifyChangedHandler {
	return &IdentifyChangedHandler{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "IdentifyChangedHandler", false),
		tlf:          tlf,
	}
}

var errNoConvForUser = errors.New("user not found in inbox")

func (h *IdentifyChangedHandler) getTLFtoCrypt(ctx context.Context, uid gregor1.UID) (string, error) {

	me := h.G().Env.GetUID()
	inbox := storage.NewInbox(h.G(), me.ToBytes(), func() libkb.SecretUI {
		return DelivererSecretUI{}
	})

	_, allConvs, err := inbox.ReadAll(ctx)
	if err != nil {
		return "", err
	}

	for _, conv := range allConvs {
		if conv.Includes(uid) {
			maxText, err := conv.GetMaxMessage(chat1.MessageType_TEXT)
			if err != nil {
				h.Debug(ctx, "failed to get a max message from conv: uid: %s convID: %s err: %s",
					uid, conv.GetConvID(), err.Error())
				continue
			}

			return maxText.ClientHeader.TLFNameExpanded(conv.Metadata.FinalizeInfo), nil
		}
	}

	h.Debug(ctx, "no conversation found for update for uid: %s", uid)
	return "", errNoConvForUser
}

func (h *IdentifyChangedHandler) HandleUserChanged(uid keybase1.UID) (err error) {
	defer h.Trace(context.Background(), func() error { return err },
		fmt.Sprintf("HandleUserChanged(uid=%s)", uid))()

	// If this is about us we don't care
	me := h.G().Env.GetUID()
	if me.Equal(uid) {
		return nil
	}

	// Make a new chat context
	var breaks []keybase1.TLFIdentifyFailure
	ident := keybase1.TLFIdentifyBehavior_CHAT_GUI
	notifier := NewIdentifyNotifier(h.G())
	ctx := Context(context.Background(), ident, &breaks, notifier)

	// Find a TLF name from the local inbox that includes the user sent to us
	tlfName, err := h.getTLFtoCrypt(ctx, uid.ToBytes())
	if err != nil {
		if err != errNoConvForUser {
			h.Debug(ctx, "error finding TLF name for update: err: %s", err.Error())
			return err
		}
	}

	// Take this guy out of the cache, we want this to run fresh
	if err = h.G().Identify2Cache.Delete(uid); err != nil {
		// Charge through this error, probably doesn't matter
		h.Debug(ctx, "unable to delete cache entry: uid: %s: err: %s", uid, err.Error())
	}

	// Run against CryptKeys to generate notifications if necessary
	_, err = h.tlf().CryptKeys(ctx, keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: ident,
	})
	if err != nil {
		h.Debug(ctx, "failed to run CryptKeys: %s", err.Error())
	}

	return nil

}
