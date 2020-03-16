// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/git.avdl

package keybase1

import (
	"errors"
	"fmt"
)

type EncryptedGitMetadata struct {
	V   int                  `codec:"v" json:"v"`
	E   []byte               `codec:"e" json:"e"`
	N   BoxNonce             `codec:"n" json:"n"`
	Gen PerTeamKeyGeneration `codec:"gen" json:"gen"`
}

func (o EncryptedGitMetadata) DeepCopy() EncryptedGitMetadata {
	return EncryptedGitMetadata{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N:   o.N.DeepCopy(),
		Gen: o.Gen.DeepCopy(),
	}
}

type RepoID string

func (o RepoID) DeepCopy() RepoID {
	return o
}

type GitLocalMetadataVersion int

const (
	GitLocalMetadataVersion_V1 GitLocalMetadataVersion = 1
)

func (o GitLocalMetadataVersion) DeepCopy() GitLocalMetadataVersion { return o }

var GitLocalMetadataVersionMap = map[string]GitLocalMetadataVersion{
	"V1": 1,
}

var GitLocalMetadataVersionRevMap = map[GitLocalMetadataVersion]string{
	1: "V1",
}

func (e GitLocalMetadataVersion) String() string {
	if v, ok := GitLocalMetadataVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GitLocalMetadataV1 struct {
	RepoName GitRepoName `codec:"repoName" json:"repoName"`
}

func (o GitLocalMetadataV1) DeepCopy() GitLocalMetadataV1 {
	return GitLocalMetadataV1{
		RepoName: o.RepoName.DeepCopy(),
	}
}

type GitLocalMetadataVersioned struct {
	Version__ GitLocalMetadataVersion `codec:"version" json:"version"`
	V1__      *GitLocalMetadataV1     `codec:"v1,omitempty" json:"v1,omitempty"`
}

func (o *GitLocalMetadataVersioned) Version() (ret GitLocalMetadataVersion, err error) {
	switch o.Version__ {
	case GitLocalMetadataVersion_V1:
		if o.V1__ == nil {
			err = errors.New("unexpected nil value for V1__")
			return ret, err
		}
	}
	return o.Version__, nil
}

func (o GitLocalMetadataVersioned) V1() (res GitLocalMetadataV1) {
	if o.Version__ != GitLocalMetadataVersion_V1 {
		panic("wrong case accessed")
	}
	if o.V1__ == nil {
		return
	}
	return *o.V1__
}

func NewGitLocalMetadataVersionedWithV1(v GitLocalMetadataV1) GitLocalMetadataVersioned {
	return GitLocalMetadataVersioned{
		Version__: GitLocalMetadataVersion_V1,
		V1__:      &v,
	}
}

func (o GitLocalMetadataVersioned) DeepCopy() GitLocalMetadataVersioned {
	return GitLocalMetadataVersioned{
		Version__: o.Version__.DeepCopy(),
		V1__: (func(x *GitLocalMetadataV1) *GitLocalMetadataV1 {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V1__),
	}
}

type GitCommit struct {
	CommitHash  string `codec:"commitHash" json:"commitHash"`
	Message     string `codec:"message" json:"message"`
	AuthorName  string `codec:"authorName" json:"authorName"`
	AuthorEmail string `codec:"authorEmail" json:"authorEmail"`
	Ctime       Time   `codec:"ctime" json:"ctime"`
}

func (o GitCommit) DeepCopy() GitCommit {
	return GitCommit{
		CommitHash:  o.CommitHash,
		Message:     o.Message,
		AuthorName:  o.AuthorName,
		AuthorEmail: o.AuthorEmail,
		Ctime:       o.Ctime.DeepCopy(),
	}
}

type GitPushType int

const (
	GitPushType_DEFAULT    GitPushType = 0
	GitPushType_CREATEREPO GitPushType = 1
	GitPushType_RENAMEREPO GitPushType = 3
)

func (o GitPushType) DeepCopy() GitPushType { return o }

var GitPushTypeMap = map[string]GitPushType{
	"DEFAULT":    0,
	"CREATEREPO": 1,
	"RENAMEREPO": 3,
}

var GitPushTypeRevMap = map[GitPushType]string{
	0: "DEFAULT",
	1: "CREATEREPO",
	3: "RENAMEREPO",
}

func (e GitPushType) String() string {
	if v, ok := GitPushTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GitRefMetadata struct {
	RefName              string      `codec:"refName" json:"refName"`
	Commits              []GitCommit `codec:"commits" json:"commits"`
	MoreCommitsAvailable bool        `codec:"moreCommitsAvailable" json:"moreCommitsAvailable"`
	IsDelete             bool        `codec:"isDelete" json:"isDelete"`
}

func (o GitRefMetadata) DeepCopy() GitRefMetadata {
	return GitRefMetadata{
		RefName: o.RefName,
		Commits: (func(x []GitCommit) []GitCommit {
			if x == nil {
				return nil
			}
			ret := make([]GitCommit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Commits),
		MoreCommitsAvailable: o.MoreCommitsAvailable,
		IsDelete:             o.IsDelete,
	}
}

type GitLocalMetadata struct {
	RepoName         GitRepoName      `codec:"repoName" json:"repoName"`
	Refs             []GitRefMetadata `codec:"refs" json:"refs"`
	PushType         GitPushType      `codec:"pushType" json:"pushType"`
	PreviousRepoName GitRepoName      `codec:"previousRepoName" json:"previousRepoName"`
}

func (o GitLocalMetadata) DeepCopy() GitLocalMetadata {
	return GitLocalMetadata{
		RepoName: o.RepoName.DeepCopy(),
		Refs: (func(x []GitRefMetadata) []GitRefMetadata {
			if x == nil {
				return nil
			}
			ret := make([]GitRefMetadata, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Refs),
		PushType:         o.PushType.DeepCopy(),
		PreviousRepoName: o.PreviousRepoName.DeepCopy(),
	}
}

type GitServerMetadata struct {
	Ctime                   Time     `codec:"ctime" json:"ctime"`
	Mtime                   Time     `codec:"mtime" json:"mtime"`
	LastModifyingUsername   string   `codec:"lastModifyingUsername" json:"lastModifyingUsername"`
	LastModifyingDeviceID   DeviceID `codec:"lastModifyingDeviceID" json:"lastModifyingDeviceID"`
	LastModifyingDeviceName string   `codec:"lastModifyingDeviceName" json:"lastModifyingDeviceName"`
}

func (o GitServerMetadata) DeepCopy() GitServerMetadata {
	return GitServerMetadata{
		Ctime:                   o.Ctime.DeepCopy(),
		Mtime:                   o.Mtime.DeepCopy(),
		LastModifyingUsername:   o.LastModifyingUsername,
		LastModifyingDeviceID:   o.LastModifyingDeviceID.DeepCopy(),
		LastModifyingDeviceName: o.LastModifyingDeviceName,
	}
}

type GitRepoResultState int

const (
	GitRepoResultState_ERR GitRepoResultState = 0
	GitRepoResultState_OK  GitRepoResultState = 1
)

func (o GitRepoResultState) DeepCopy() GitRepoResultState { return o }

var GitRepoResultStateMap = map[string]GitRepoResultState{
	"ERR": 0,
	"OK":  1,
}

var GitRepoResultStateRevMap = map[GitRepoResultState]string{
	0: "ERR",
	1: "OK",
}

func (e GitRepoResultState) String() string {
	if v, ok := GitRepoResultStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GitRepoResult struct {
	State__ GitRepoResultState `codec:"state" json:"state"`
	Err__   *string            `codec:"err,omitempty" json:"err,omitempty"`
	Ok__    *GitRepoInfo       `codec:"ok,omitempty" json:"ok,omitempty"`
}

func (o *GitRepoResult) State() (ret GitRepoResultState, err error) {
	switch o.State__ {
	case GitRepoResultState_ERR:
		if o.Err__ == nil {
			err = errors.New("unexpected nil value for Err__")
			return ret, err
		}
	case GitRepoResultState_OK:
		if o.Ok__ == nil {
			err = errors.New("unexpected nil value for Ok__")
			return ret, err
		}
	}
	return o.State__, nil
}

func (o GitRepoResult) Err() (res string) {
	if o.State__ != GitRepoResultState_ERR {
		panic("wrong case accessed")
	}
	if o.Err__ == nil {
		return
	}
	return *o.Err__
}

func (o GitRepoResult) Ok() (res GitRepoInfo) {
	if o.State__ != GitRepoResultState_OK {
		panic("wrong case accessed")
	}
	if o.Ok__ == nil {
		return
	}
	return *o.Ok__
}

func NewGitRepoResultWithErr(v string) GitRepoResult {
	return GitRepoResult{
		State__: GitRepoResultState_ERR,
		Err__:   &v,
	}
}

func NewGitRepoResultWithOk(v GitRepoInfo) GitRepoResult {
	return GitRepoResult{
		State__: GitRepoResultState_OK,
		Ok__:    &v,
	}
}

func (o GitRepoResult) DeepCopy() GitRepoResult {
	return GitRepoResult{
		State__: o.State__.DeepCopy(),
		Err__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Err__),
		Ok__: (func(x *GitRepoInfo) *GitRepoInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Ok__),
	}
}

type GitRepoInfo struct {
	Folder           FolderHandle         `codec:"folder" json:"folder"`
	RepoID           RepoID               `codec:"repoID" json:"repoID"`
	LocalMetadata    GitLocalMetadata     `codec:"localMetadata" json:"localMetadata"`
	ServerMetadata   GitServerMetadata    `codec:"serverMetadata" json:"serverMetadata"`
	RepoUrl          string               `codec:"repoUrl" json:"repoUrl"`
	GlobalUniqueID   string               `codec:"globalUniqueID" json:"globalUniqueID"`
	CanDelete        bool                 `codec:"canDelete" json:"canDelete"`
	TeamRepoSettings *GitTeamRepoSettings `codec:"teamRepoSettings,omitempty" json:"teamRepoSettings,omitempty"`
}

func (o GitRepoInfo) DeepCopy() GitRepoInfo {
	return GitRepoInfo{
		Folder:         o.Folder.DeepCopy(),
		RepoID:         o.RepoID.DeepCopy(),
		LocalMetadata:  o.LocalMetadata.DeepCopy(),
		ServerMetadata: o.ServerMetadata.DeepCopy(),
		RepoUrl:        o.RepoUrl,
		GlobalUniqueID: o.GlobalUniqueID,
		CanDelete:      o.CanDelete,
		TeamRepoSettings: (func(x *GitTeamRepoSettings) *GitTeamRepoSettings {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TeamRepoSettings),
	}
}

type GitTeamRepoSettings struct {
	ChannelName  *string `codec:"channelName,omitempty" json:"channelName,omitempty"`
	ChatDisabled bool    `codec:"chatDisabled" json:"chatDisabled"`
}

func (o GitTeamRepoSettings) DeepCopy() GitTeamRepoSettings {
	return GitTeamRepoSettings{
		ChannelName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ChannelName),
		ChatDisabled: o.ChatDisabled,
	}
}
