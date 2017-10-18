package git

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-codec/codec"
)

type ServerResponseRepo struct {
	TeamID                keybase1.TeamID               `json:"team_id"`
	RepoID                keybase1.RepoID               `json:"repo_id"`
	CTime                 time.Time                     `json:"ctime"`
	MTime                 time.Time                     `json:"mtime"`
	EncryptedMetadata     string                        `json:"encrypted_metadata"`
	EncryptionVersion     int                           `json:"encryption_version"`
	Nonce                 string                        `json:"nonce"`
	KeyGeneration         keybase1.PerTeamKeyGeneration `json:"key_generation"`
	LastModifyingUID      keybase1.UID                  `json:"last_writer_uid"`
	LastModifyingDeviceID keybase1.DeviceID             `json:"last_writer_device_id"`
}

type ServerResponse struct {
	Repos  []ServerResponseRepo `json:"repos"`
	Status libkb.AppStatus      `json:"status"`
}

var _ libkb.APIResponseWrapper = (*ServerResponse)(nil)

// For GetDecode.
func (r *ServerResponse) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func formatRepoURL(folder keybase1.Folder, repoName string) string {
	return "keybase://" + folder.ToString() + "/" + repoName
}

// The GUI needs a way to refer to repos
func formatUniqueRepoID(teamID keybase1.TeamID, repoID keybase1.RepoID) string {
	return string(teamID) + "_" + string(repoID)
}

// Implicit teams need to be converted back into the folder that matches their
// display name. Regular teams become a regular team folder.
func folderFromTeamID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (keybase1.Folder, error) {
	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID:     teamID,
		Public: teamID.IsPublic(),
	})
	if err != nil {
		return keybase1.Folder{}, err
	}
	if team.IsImplicit() {
		// TODO: This function doesn't currently support conflict info.
		name, err := team.ImplicitTeamDisplayNameString(ctx)
		if err != nil {
			return keybase1.Folder{}, err
		}
		var folderType keybase1.FolderType
		if team.IsPublic() {
			folderType = keybase1.FolderType_PUBLIC
		} else {
			folderType = keybase1.FolderType_PRIVATE
		}
		return keybase1.Folder{
			Name:       name,
			FolderType: folderType,
			Private:    !team.IsPublic(),
		}, nil
	}
	return keybase1.Folder{
		Name:       team.Name().String(),
		FolderType: keybase1.FolderType_TEAM,
		Private:    !team.IsPublic(),
	}, nil
}

// If folder is nil, get for all folders.
func getMetadataInner(ctx context.Context, g *libkb.GlobalContext, folder *keybase1.Folder) ([]keybase1.GitRepoResult, error) {
	teamer := NewTeamer(g)

	apiArg := libkb.APIArg{
		Endpoint:    "kbfs/git/team/get",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args:        libkb.HTTPArgs{
		// a limit parameter exists, default 100, and we don't currently set it
		},
	}

	// The team_id parameter is optional. Add it in if the caller supplied it.
	if folder != nil {
		teamIDVis, err := teamer.LookupOrCreate(ctx, *folder)
		if err != nil {
			return nil, err
		}
		apiArg.Args["team_id"] = libkb.S{Val: string(teamIDVis.TeamID)}
	}
	var serverResponse ServerResponse
	err := g.GetAPI().GetDecode(apiArg, &serverResponse)
	if err != nil {
		return nil, err
	}

	// Initializing the results list to non-nil means that we end up seeing
	// "[]" instead of "null" in the final JSON output on the CLI, which is
	// preferable.
	resultList := []keybase1.GitRepoResult{}
	var firstErr error
	var anySuccess bool
	for _, responseRepo := range serverResponse.Repos {
		info, skip, err := getMetadataInnerSingle(ctx, g, folder, responseRepo)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			resultList = append(resultList, keybase1.NewGitRepoResultWithErr(err.Error()))
		} else {
			if !skip {
				anySuccess = true
				resultList = append(resultList, keybase1.NewGitRepoResultWithOk(*info))
			}
		}
	}

	// If there were no repos, return ok
	// If all repos failed, return the first error (something is probably wrong that's not repo-specific)
	// If no repos failed, return ok

	if len(resultList) == 0 {
		return resultList, nil
	}
	if !anySuccess {
		return resultList, firstErr
	}
	return resultList, nil
}

// if skip is true the other return values are nil
func getMetadataInnerSingle(ctx context.Context, g *libkb.GlobalContext,
	folder *keybase1.Folder, responseRepo ServerResponseRepo) (info *keybase1.GitRepoInfo, skip bool, err error) {

	cryptoer := NewCrypto(g)

	// If the folder was passed in, use it. Otherwise, load the team to
	// figure it out.
	var repoFolder keybase1.Folder
	if folder != nil {
		repoFolder = *folder
	} else {
		repoFolder, err = folderFromTeamID(ctx, g, responseRepo.TeamID)
		if err != nil {
			return nil, false, err
		}

		// Currently we want to pretend that multi-user personal repos
		// (/keybase/{private,public}/chris,max/...) don't exist. Short circuit here
		// to keep those out of the results list.
		if repoFolder.Name != g.Env.GetUsername().String() &&
			(repoFolder.FolderType == keybase1.FolderType_PRIVATE || repoFolder.FolderType == keybase1.FolderType_PUBLIC) {

			return nil, true, nil
		}
	}

	teamIDVis := keybase1.TeamIDWithVisibility{
		TeamID: responseRepo.TeamID,
	}
	if repoFolder.Private {
		teamIDVis.Visibility = keybase1.TLFVisibility_PRIVATE
	} else {
		teamIDVis.Visibility = keybase1.TLFVisibility_PUBLIC
	}

	ciphertext, err := base64.StdEncoding.DecodeString(responseRepo.EncryptedMetadata)
	if err != nil {
		return nil, false, err
	}

	nonceSlice, err := base64.StdEncoding.DecodeString(responseRepo.Nonce)
	if err != nil {
		return nil, false, err
	}
	if len(nonceSlice) != len(keybase1.BoxNonce{}) {
		return nil, false, fmt.Errorf("expected a nonce of length %d, found %d", len(keybase1.BoxNonce{}), len(nonceSlice))
	}
	var nonce keybase1.BoxNonce
	copy(nonce[:], nonceSlice)

	encryptedMetadata := keybase1.EncryptedGitMetadata{
		V:   responseRepo.EncryptionVersion,
		E:   ciphertext,
		N:   nonce,
		Gen: responseRepo.KeyGeneration,
	}
	msgpackPlaintext, err := cryptoer.Unbox(ctx, teamIDVis, &encryptedMetadata)
	if err != nil {
		return nil, false, fmt.Errorf("repo tid:%v visibility:%s: %v", teamIDVis.TeamID, teamIDVis.Visibility, err)
	}

	var localMetadataVersioned keybase1.GitLocalMetadataVersioned
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(msgpackPlaintext, &mh)
	err = dec.Decode(&localMetadataVersioned)
	if err != nil {
		return nil, false, err
	}

	// Translate back from GitLocalMetadataVersioned to the decoupled type
	// that we use for local RPC.
	version, err := localMetadataVersioned.Version()
	if err != nil {
		return nil, false, err
	}
	var localMetadata keybase1.GitLocalMetadata
	switch version {
	case keybase1.GitLocalMetadataVersion_V1:
		localMetadata = keybase1.GitLocalMetadata{
			RepoName: localMetadataVersioned.V1().RepoName,
		}
	default:
		return nil, false, fmt.Errorf("unrecognized variant of GitLocalMetadataVersioned: %#v", version)
	}

	// Load UPAKs to get the last writer username and device name.
	lastWriterUPAK, _, err := g.GetUPAKLoader().LoadV2(libkb.NewLoadUserArg(g).WithUID(responseRepo.LastModifyingUID))
	if err != nil {
		return nil, false, err
	}
	var deviceName string
	for _, deviceKey := range lastWriterUPAK.Current.DeviceKeys {
		if deviceKey.DeviceID.Eq(responseRepo.LastModifyingDeviceID) {
			deviceName = deviceKey.DeviceDescription
			break
		}
	}
	if deviceName == "" {
		return nil, false, fmt.Errorf("can't find device name for %s's device ID %s", lastWriterUPAK.Current.Username, responseRepo.LastModifyingDeviceID)
	}

	// Load the team to get the current user's role, for canDelete.
	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID:     responseRepo.TeamID,
		Public: !repoFolder.Private,
	})
	if err != nil {
		return nil, false, err
	}
	selfUPAK, _, err := g.GetUPAKLoader().LoadV2(libkb.NewLoadUserArg(g).WithSelf(true).WithUID(g.GetMyUID()))
	if err != nil {
		return nil, false, err
	}
	role, err := team.MemberRole(ctx, selfUPAK.Current.ToUserVersion())
	if err != nil {
		return nil, false, err
	}

	return &keybase1.GitRepoInfo{
		Folder:         repoFolder,
		RepoID:         responseRepo.RepoID,
		RepoUrl:        formatRepoURL(repoFolder, string(localMetadata.RepoName)),
		GlobalUniqueID: formatUniqueRepoID(responseRepo.TeamID, responseRepo.RepoID),
		CanDelete:      role.IsAdminOrAbove(),
		LocalMetadata:  localMetadata,
		ServerMetadata: keybase1.GitServerMetadata{
			Ctime: keybase1.ToTime(responseRepo.CTime),
			Mtime: keybase1.ToTime(responseRepo.MTime),
			LastModifyingUsername:   lastWriterUPAK.Current.Username,
			LastModifyingDeviceID:   responseRepo.LastModifyingDeviceID,
			LastModifyingDeviceName: deviceName,
		},
	}, false, nil
}

func GetMetadata(ctx context.Context, g *libkb.GlobalContext, folder keybase1.Folder) ([]keybase1.GitRepoResult, error) {
	return getMetadataInner(ctx, g, &folder)
}

func GetAllMetadata(ctx context.Context, g *libkb.GlobalContext) ([]keybase1.GitRepoResult, error) {
	return getMetadataInner(ctx, g, nil)
}
