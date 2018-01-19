package git

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

func PutMetadata(ctx context.Context, g *libkb.GlobalContext, arg keybase1.PutGitMetadataArg) error {
	teamer := NewTeamer(g)
	cryptoer := NewCrypto(g)

	teamIDVis, err := teamer.LookupOrCreate(ctx, arg.Folder)
	if err != nil {
		return err
	}

	// Translate the GitLocalMetadata struct into GitLocalMetadataVersioned,
	// for versioned storage.
	localMetadataVersioned := keybase1.NewGitLocalMetadataVersionedWithV1(
		keybase1.GitLocalMetadataV1{
			RepoName: arg.Metadata.RepoName})

	mh := codec.MsgpackHandle{WriteExt: true}
	var msgpackLocalMetadata []byte
	enc := codec.NewEncoderBytes(&msgpackLocalMetadata, &mh)
	err = enc.Encode(localMetadataVersioned)
	if err != nil {
		return fmt.Errorf("encoding git metadata:%v", err)
	}
	encryptedMetadata, err := cryptoer.Box(ctx, msgpackLocalMetadata, teamIDVis)
	if err != nil {
		return err
	}
	base64Ciphertext := base64.StdEncoding.EncodeToString(encryptedMetadata.E)
	base64Nonce := base64.StdEncoding.EncodeToString(encryptedMetadata.N[:])

	apiArg := libkb.APIArg{
		Endpoint:    "kbfs/git/team/put",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id":            libkb.S{Val: string(teamIDVis.TeamID)},
			"repo_id":            libkb.S{Val: string(arg.RepoID)},
			"encrypted_metadata": libkb.S{Val: base64Ciphertext},
			"nonce":              libkb.S{Val: base64Nonce},
			"key_generation":     libkb.I{Val: int(encryptedMetadata.Gen)},
			"device_id":          libkb.S{Val: string(g.Env.GetDeviceID())},
			"encryption_version": libkb.I{Val: encryptedMetadata.V},
			"notify_team":        libkb.B{Val: arg.NotifyTeam},
		},
	}
	_, err = g.GetAPI().Post(apiArg)

	if err == nil {
		err = sendChat(ctx, g, teamIDVis.TeamID, arg)
	}

	return err
}

func sendChat(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, arg keybase1.PutGitMetadataArg) error {
	if arg.Folder.FolderType != keybase1.FolderType_TEAM {
		// only send chat for team repos
		return nil
	}

	settingsArg := keybase1.GetTeamRepoSettingsArg{
		Folder: arg.Folder,
		RepoID: arg.RepoID,
	}
	settings, err := GetTeamRepoSettings(ctx, g, settingsArg)
	if err != nil {
		return err
	}
	if settings.ChatDisabled {
		return nil
	}
	if settings.ChannelName == nil {
		// this shouldn't happen, but protect it if it does:
		g.Log.CDebugf(ctx, "invalid team repo settings:  chat enabled, but nil ChannelName.  using default.")
		settings.ChannelName = &globals.DefaultTeamTopic
	}

	if g.ChatHelper == nil {
		g.Log.CDebugf(ctx, "cannot send chat on git push to team channel because no ChatHelper")
		return nil
	}

	g.StartStandaloneChat()

	subBody := chat1.NewMessageSystemWithGitpush(chat1.MessageSystemGitPush{
		Team:     arg.Folder.Name,
		Pusher:   g.Env.GetUsername().String(),
		RepoID:   arg.RepoID,
		RepoName: string(arg.Metadata.RepoName),
		Refs:     arg.Metadata.Refs,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	g.Log.CDebugf(ctx, "sending git push system chat message to %s/%s", arg.Folder.Name, *settings.ChannelName)
	return g.ChatHelper.SendMsgByNameNonblock(ctx, arg.Folder.Name, settings.ChannelName,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM)
}
