// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"golang.org/x/crypto/nacl/secretbox"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/client/go/tlfupgrade"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type KBFSHandler struct {
	*BaseHandler
	libkb.Contextified
	globals.ChatContextified
}

func NewKBFSHandler(xp rpc.Transporter, g *libkb.GlobalContext, cg *globals.ChatContext) *KBFSHandler {
	return &KBFSHandler{
		BaseHandler:      NewBaseHandler(g, xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(cg),
	}
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
	ctx := chat.Context(context.Background(), g, keybase1.TLFIdentifyBehavior_CHAT_SKIP,
		nil, chat.NewCachingIdentifyNotifier(g))
	h.ChatG().FetchRetrier.Rekey(ctx, tlf, chat1.ConversationMembersType_KBFS, public)
}

func (h *KBFSHandler) CreateTLF(ctx context.Context, arg keybase1.CreateTLFArg) error {
	return teams.CreateTLF(ctx, h.G(), arg)
}

func (h *KBFSHandler) GetKBFSTeamSettings(ctx context.Context, teamID keybase1.TeamID) (keybase1.KBFSTeamSettings, error) {
	return teams.GetKBFSTeamSettings(ctx, h.G(), teamID.IsPublic(), teamID)
}

func (h *KBFSHandler) UpgradeTLF(ctx context.Context, arg keybase1.UpgradeTLFArg) error {
	return tlfupgrade.UpgradeTLFForKBFS(ctx, h.G(), arg.TlfName, arg.Public)
}

// TODO: much of these definitions are copied from EncryptedDB.
// Maybe we should refactor that slightly to allow this to use it,
// instead of cherrypicking the code we use here.

// ***
// If we change this, make sure to update the key derivation reason below!
// ***
const cryptoVersion = 1

type boxedData struct {
	V int
	N [24]byte
	E []byte
}

// EncryptFavorites encrypts cached favorites to store on disk.
func (h *KBFSHandler) EncryptFavorites(ctx context.Context, dataToEncrypt []byte) (res []byte, err error) {
	enckey, err := teams.GetLocalStorageSecretBoxKeyGeneric(ctx, h.G(),
		"kbfs.favorites")
	if err != nil {
		return nil, err
	}
	var nonce []byte
	nonce, err = libkb.RandBytes(24)
	if err != nil {
		return nil, err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, dataToEncrypt, &fnonce, &enckey)
	boxed := boxedData{
		V: cryptoVersion,
		E: sealed,
		N: fnonce,
	}

	var dat []byte
	if dat, err = libkb.MPackEncode(boxed); err != nil {
		return nil, err
	}
	return dat, nil
}

// DecryptFavorites decrypts cached favorites stored on disk.
func (h *KBFSHandler) DecryptFavorites(ctx context.Context, dataToEncrypt []byte) (res []byte, err error) {
	// Decode encrypted box
	var boxed boxedData
	if err := libkb.MPackDecode(dataToEncrypt, &boxed); err != nil {
		return nil, err
	}
	if boxed.V > cryptoVersion {
		return nil, fmt.Errorf("bad crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := teams.GetLocalStorageSecretBoxKeyGeneric(ctx, h.G(),
		"kbfs.favorites")
	if err != nil {
		return nil, err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return nil, fmt.Errorf("failed to decrypt item")
	}
	return pt, nil
}
