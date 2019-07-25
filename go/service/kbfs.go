// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/encrypteddb"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/offline"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/client/go/tlfupgrade"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type KBFSHandler struct {
	*BaseHandler
	libkb.Contextified
	globals.ChatContextified
	service *Service
}

func NewKBFSHandler(xp rpc.Transporter, g *libkb.GlobalContext, cg *globals.ChatContext, service *Service) *KBFSHandler {
	return &KBFSHandler{
		BaseHandler:      NewBaseHandler(g, xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(cg),
		service:          service,
	}
}

func (h *KBFSHandler) FSOnlineStatusChangedEvent(_ context.Context, online bool) error {
	h.G().NotifyRouter.HandleFSOnlineStatusChanged(online)
	return nil
}

func (h *KBFSHandler) FSEvent(_ context.Context, arg keybase1.FSNotification) error {
	h.G().NotifyRouter.HandleFSActivity(arg)

	h.checkConversationRekey(arg)

	return nil
}

func (h *KBFSHandler) FSPathUpdate(_ context.Context, path string) error {
	h.G().NotifyRouter.HandleFSPathUpdated(path)
	return nil
}

func (h *KBFSHandler) FSEditList(ctx context.Context, arg keybase1.FSEditListArg) error {
	h.G().NotifyRouter.HandleFSEditListResponse(ctx, arg)
	return nil
}

func (h *KBFSHandler) FSEditListRequest(ctx context.Context, arg keybase1.FSEditListRequest) error {
	h.G().NotifyRouter.HandleFSEditListRequest(ctx, arg)
	return nil
}

func (h *KBFSHandler) FSSyncStatus(ctx context.Context, arg keybase1.FSSyncStatusArg) (err error) {
	h.G().NotifyRouter.HandleFSSyncStatus(ctx, arg)
	return nil
}

func (h *KBFSHandler) FSSyncEvent(ctx context.Context, arg keybase1.FSPathSyncStatus) (err error) {
	h.G().NotifyRouter.HandleFSSyncEvent(ctx, arg)
	return nil
}

func (h *KBFSHandler) FSOverallSyncEvent(
	_ context.Context, arg keybase1.FolderSyncStatus) (err error) {
	h.G().NotifyRouter.HandleFSOverallSyncStatusChanged(arg)
	return nil
}

func (h *KBFSHandler) FSFavoritesChangedEvent(_ context.Context) (err error) {
	h.G().NotifyRouter.HandleFSFavoritesChanged()
	return nil
}

func (h *KBFSHandler) FSSubscriptionNotifyEvent(_ context.Context, arg keybase1.FSSubscriptionNotifyEventArg) error {
	h.G().NotifyRouter.HandleFSSubscriptionNotify(keybase1.FSSubscriptionNotifyArg{
		SubscriptionID: arg.SubscriptionID,
		Topic:          arg.Topic,
	})
	return nil
}

func (h *KBFSHandler) FSSubscriptionNotifyPathEvent(_ context.Context, arg keybase1.FSSubscriptionNotifyPathEventArg) error {
	h.G().NotifyRouter.HandleFSSubscriptionNotifyPath(keybase1.FSSubscriptionNotifyPathArg{
		SubscriptionID: arg.SubscriptionID,
		Path:           arg.Path,
		Topic:          arg.Topic,
	})
	return nil
}

// checkConversationRekey looks for rekey finished notifications and tries to
// find any conversations associated with the rekeyed TLF.  If it finds any,
// it will send ChatThreadsStale notifications for them.
func (h *KBFSHandler) checkConversationRekey(arg keybase1.FSNotification) {
	if arg.NotificationType != keybase1.FSNotificationType_REKEYING {
		return
	}
	h.G().Log.Debug("received rekey notification for %s, code: %v", arg.Filename, arg.StatusCode)
	if arg.StatusCode != keybase1.FSStatusCode_FINISH {
		return
	}

	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		h.G().Log.Debug("received rekey finished notification for %s, but have no UID", arg.Filename)
		return
	}

	h.G().Log.Debug("received rekey finished notification for %s, checking for conversations", arg.Filename)

	h.notifyConversation(uid, arg.Filename)
}

// findFolderList returns the type of KBFS folder list containing the
// given file, e.g., "private", "public", "team", etc.
func findFolderList(filename string) string {
	// KBFS always sets the filenames in the protocol to be like
	// `/keybase/private/alice/...`, regardless of the OS.  So we just
	// need to split by `/` and take the third component.
	components := strings.Split(filename, "/")
	if len(components) < 3 {
		return ""
	}
	return components[2]
}

func (h *KBFSHandler) notifyConversation(uid keybase1.UID, filename string) {
	tlf := filepath.Base(filename)
	public := findFolderList(filename) == "public"

	g := globals.NewContext(h.G(), h.ChatG())
	ctx := globals.ChatCtx(context.Background(), g, keybase1.TLFIdentifyBehavior_CHAT_SKIP,
		nil, chat.NewCachingIdentifyNotifier(g))
	h.ChatG().FetchRetrier.Rekey(ctx, tlf, chat1.ConversationMembersType_KBFS, public)
}

func (h *KBFSHandler) CreateTLF(ctx context.Context, arg keybase1.CreateTLFArg) error {
	return teams.CreateTLF(ctx, h.G(), arg)
}

func (h *KBFSHandler) GetKBFSTeamSettings(ctx context.Context, arg keybase1.GetKBFSTeamSettingsArg) (ret keybase1.KBFSTeamSettings, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("SETTINGS")
	loader := func(mctx libkb.MetaContext) (interface{}, error) {
		return teams.GetKBFSTeamSettings(mctx.Ctx(), mctx.G(), arg.TeamID.IsPublic(), arg.TeamID)
	}
	servedRet, err := h.service.offlineRPCCache.Serve(mctx, arg.Oa, offline.Version(1), "kbfs.getKBFSTeamSettings", false, arg, &ret, loader)
	if err != nil {
		return keybase1.KBFSTeamSettings{}, err
	}
	if s, ok := servedRet.(keybase1.KBFSTeamSettings); ok {
		ret = s
	}
	return ret, nil
}

func (h *KBFSHandler) UpgradeTLF(ctx context.Context, arg keybase1.UpgradeTLFArg) error {
	return tlfupgrade.UpgradeTLFForKBFS(ctx, h.G(), arg.TlfName, arg.Public)
}

// getKeyFn returns a function that gets an encryption key for storing
// favorites.
func (h *KBFSHandler) getKeyFn() func(context.Context) ([32]byte, error) {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return encrypteddb.GetSecretBoxKey(ctx, h.G(), encrypteddb.DefaultSecretUI,
			libkb.EncryptionReasonKBFSFavorites, "encrypting kbfs favorites")
	}
	return keyFn
}

// EncryptFavorites encrypts cached favorites to store on disk.
func (h *KBFSHandler) EncryptFavorites(ctx context.Context,
	dataToDecrypt []byte) (res []byte, err error) {
	return encrypteddb.EncodeBox(ctx, dataToDecrypt, h.getKeyFn())
}

// DecryptFavorites decrypts cached favorites stored on disk.
func (h *KBFSHandler) DecryptFavorites(ctx context.Context,
	dataToEncrypt []byte) (res []byte, err error) {
	err = encrypteddb.DecodeBox(ctx, dataToEncrypt, h.getKeyFn(), res)
	return res, err
}
