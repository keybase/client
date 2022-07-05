// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/git.avdl

package keybase1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
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

type PutGitMetadataArg struct {
	Folder     FolderHandle     `codec:"folder" json:"folder"`
	RepoID     RepoID           `codec:"repoID" json:"repoID"`
	Metadata   GitLocalMetadata `codec:"metadata" json:"metadata"`
	NotifyTeam bool             `codec:"notifyTeam" json:"notifyTeam"`
}

type DeleteGitMetadataArg struct {
	Folder   FolderHandle `codec:"folder" json:"folder"`
	RepoName GitRepoName  `codec:"repoName" json:"repoName"`
}

type GetGitMetadataArg struct {
	Folder FolderHandle `codec:"folder" json:"folder"`
}

type GetAllGitMetadataArg struct {
}

type CreatePersonalRepoArg struct {
	RepoName GitRepoName `codec:"repoName" json:"repoName"`
}

type CreateTeamRepoArg struct {
	RepoName   GitRepoName `codec:"repoName" json:"repoName"`
	TeamName   TeamName    `codec:"teamName" json:"teamName"`
	NotifyTeam bool        `codec:"notifyTeam" json:"notifyTeam"`
}

type DeletePersonalRepoArg struct {
	RepoName GitRepoName `codec:"repoName" json:"repoName"`
}

type DeleteTeamRepoArg struct {
	RepoName   GitRepoName `codec:"repoName" json:"repoName"`
	TeamName   TeamName    `codec:"teamName" json:"teamName"`
	NotifyTeam bool        `codec:"notifyTeam" json:"notifyTeam"`
}

type GcPersonalRepoArg struct {
	RepoName GitRepoName `codec:"repoName" json:"repoName"`
	Force    bool        `codec:"force" json:"force"`
}

type GcTeamRepoArg struct {
	RepoName GitRepoName `codec:"repoName" json:"repoName"`
	TeamName TeamName    `codec:"teamName" json:"teamName"`
	Force    bool        `codec:"force" json:"force"`
}

type GetTeamRepoSettingsArg struct {
	Folder FolderHandle `codec:"folder" json:"folder"`
	RepoID RepoID       `codec:"repoID" json:"repoID"`
}

type SetTeamRepoSettingsArg struct {
	Folder       FolderHandle `codec:"folder" json:"folder"`
	RepoID       RepoID       `codec:"repoID" json:"repoID"`
	ChannelName  *string      `codec:"channelName,omitempty" json:"channelName,omitempty"`
	ChatDisabled bool         `codec:"chatDisabled" json:"chatDisabled"`
}

type GitInterface interface {
	PutGitMetadata(context.Context, PutGitMetadataArg) error
	DeleteGitMetadata(context.Context, DeleteGitMetadataArg) error
	GetGitMetadata(context.Context, FolderHandle) ([]GitRepoResult, error)
	GetAllGitMetadata(context.Context) ([]GitRepoResult, error)
	CreatePersonalRepo(context.Context, GitRepoName) (RepoID, error)
	CreateTeamRepo(context.Context, CreateTeamRepoArg) (RepoID, error)
	DeletePersonalRepo(context.Context, GitRepoName) error
	DeleteTeamRepo(context.Context, DeleteTeamRepoArg) error
	GcPersonalRepo(context.Context, GcPersonalRepoArg) error
	GcTeamRepo(context.Context, GcTeamRepoArg) error
	GetTeamRepoSettings(context.Context, GetTeamRepoSettingsArg) (GitTeamRepoSettings, error)
	SetTeamRepoSettings(context.Context, SetTeamRepoSettingsArg) error
}

func GitProtocol(i GitInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.git",
		Methods: map[string]rpc.ServeHandlerDescription{
			"putGitMetadata": {
				MakeArg: func() interface{} {
					var ret [1]PutGitMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PutGitMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PutGitMetadataArg)(nil), args)
						return
					}
					err = i.PutGitMetadata(ctx, typedArgs[0])
					return
				},
			},
			"deleteGitMetadata": {
				MakeArg: func() interface{} {
					var ret [1]DeleteGitMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteGitMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteGitMetadataArg)(nil), args)
						return
					}
					err = i.DeleteGitMetadata(ctx, typedArgs[0])
					return
				},
			},
			"getGitMetadata": {
				MakeArg: func() interface{} {
					var ret [1]GetGitMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetGitMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetGitMetadataArg)(nil), args)
						return
					}
					ret, err = i.GetGitMetadata(ctx, typedArgs[0].Folder)
					return
				},
			},
			"getAllGitMetadata": {
				MakeArg: func() interface{} {
					var ret [1]GetAllGitMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetAllGitMetadata(ctx)
					return
				},
			},
			"createPersonalRepo": {
				MakeArg: func() interface{} {
					var ret [1]CreatePersonalRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CreatePersonalRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CreatePersonalRepoArg)(nil), args)
						return
					}
					ret, err = i.CreatePersonalRepo(ctx, typedArgs[0].RepoName)
					return
				},
			},
			"createTeamRepo": {
				MakeArg: func() interface{} {
					var ret [1]CreateTeamRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CreateTeamRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CreateTeamRepoArg)(nil), args)
						return
					}
					ret, err = i.CreateTeamRepo(ctx, typedArgs[0])
					return
				},
			},
			"deletePersonalRepo": {
				MakeArg: func() interface{} {
					var ret [1]DeletePersonalRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeletePersonalRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeletePersonalRepoArg)(nil), args)
						return
					}
					err = i.DeletePersonalRepo(ctx, typedArgs[0].RepoName)
					return
				},
			},
			"deleteTeamRepo": {
				MakeArg: func() interface{} {
					var ret [1]DeleteTeamRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteTeamRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteTeamRepoArg)(nil), args)
						return
					}
					err = i.DeleteTeamRepo(ctx, typedArgs[0])
					return
				},
			},
			"gcPersonalRepo": {
				MakeArg: func() interface{} {
					var ret [1]GcPersonalRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GcPersonalRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GcPersonalRepoArg)(nil), args)
						return
					}
					err = i.GcPersonalRepo(ctx, typedArgs[0])
					return
				},
			},
			"gcTeamRepo": {
				MakeArg: func() interface{} {
					var ret [1]GcTeamRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GcTeamRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GcTeamRepoArg)(nil), args)
						return
					}
					err = i.GcTeamRepo(ctx, typedArgs[0])
					return
				},
			},
			"getTeamRepoSettings": {
				MakeArg: func() interface{} {
					var ret [1]GetTeamRepoSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTeamRepoSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTeamRepoSettingsArg)(nil), args)
						return
					}
					ret, err = i.GetTeamRepoSettings(ctx, typedArgs[0])
					return
				},
			},
			"setTeamRepoSettings": {
				MakeArg: func() interface{} {
					var ret [1]SetTeamRepoSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetTeamRepoSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetTeamRepoSettingsArg)(nil), args)
						return
					}
					err = i.SetTeamRepoSettings(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type GitClient struct {
	Cli rpc.GenericClient
}

func (c GitClient) PutGitMetadata(ctx context.Context, __arg PutGitMetadataArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.putGitMetadata", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GitClient) DeleteGitMetadata(ctx context.Context, __arg DeleteGitMetadataArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.deleteGitMetadata", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GitClient) GetGitMetadata(ctx context.Context, folder FolderHandle) (res []GitRepoResult, err error) {
	__arg := GetGitMetadataArg{Folder: folder}
	err = c.Cli.Call(ctx, "keybase.1.git.getGitMetadata", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GitClient) GetAllGitMetadata(ctx context.Context) (res []GitRepoResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.getAllGitMetadata", []interface{}{GetAllGitMetadataArg{}}, &res, 0*time.Millisecond)
	return
}

func (c GitClient) CreatePersonalRepo(ctx context.Context, repoName GitRepoName) (res RepoID, err error) {
	__arg := CreatePersonalRepoArg{RepoName: repoName}
	err = c.Cli.Call(ctx, "keybase.1.git.createPersonalRepo", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GitClient) CreateTeamRepo(ctx context.Context, __arg CreateTeamRepoArg) (res RepoID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.createTeamRepo", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GitClient) DeletePersonalRepo(ctx context.Context, repoName GitRepoName) (err error) {
	__arg := DeletePersonalRepoArg{RepoName: repoName}
	err = c.Cli.Call(ctx, "keybase.1.git.deletePersonalRepo", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GitClient) DeleteTeamRepo(ctx context.Context, __arg DeleteTeamRepoArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.deleteTeamRepo", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GitClient) GcPersonalRepo(ctx context.Context, __arg GcPersonalRepoArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.gcPersonalRepo", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GitClient) GcTeamRepo(ctx context.Context, __arg GcTeamRepoArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.gcTeamRepo", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GitClient) GetTeamRepoSettings(ctx context.Context, __arg GetTeamRepoSettingsArg) (res GitTeamRepoSettings, err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.getTeamRepoSettings", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GitClient) SetTeamRepoSettings(ctx context.Context, __arg SetTeamRepoSettingsArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.git.setTeamRepoSettings", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
