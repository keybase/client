package git

import (
	"context"
	"encoding/base64"

	"github.com/keybase/client/go/libkb"
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
		return err
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
	if err != nil {
		return err
	}

	g.NotifyRouter.HandleRepoChanged(ctx, arg.Folder, teamIDVis.TeamID, arg.RepoID, formatUniqueRepoID(teamIDVis.TeamID, arg.RepoID))

	return nil
}
