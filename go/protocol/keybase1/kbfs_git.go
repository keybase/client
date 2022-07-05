// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kbfs_git.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type GcOptions struct {
	MaxLooseRefs         int  `codec:"maxLooseRefs" json:"maxLooseRefs"`
	PruneMinLooseObjects int  `codec:"pruneMinLooseObjects" json:"pruneMinLooseObjects"`
	PruneExpireTime      Time `codec:"pruneExpireTime" json:"pruneExpireTime"`
	MaxObjectPacks       int  `codec:"maxObjectPacks" json:"maxObjectPacks"`
}

func (o GcOptions) DeepCopy() GcOptions {
	return GcOptions{
		MaxLooseRefs:         o.MaxLooseRefs,
		PruneMinLooseObjects: o.PruneMinLooseObjects,
		PruneExpireTime:      o.PruneExpireTime.DeepCopy(),
		MaxObjectPacks:       o.MaxObjectPacks,
	}
}

type CreateRepoArg struct {
	Folder FolderHandle `codec:"folder" json:"folder"`
	Name   GitRepoName  `codec:"name" json:"name"`
}

type DeleteRepoArg struct {
	Folder FolderHandle `codec:"folder" json:"folder"`
	Name   GitRepoName  `codec:"name" json:"name"`
}

type GcArg struct {
	Folder  FolderHandle `codec:"folder" json:"folder"`
	Name    GitRepoName  `codec:"name" json:"name"`
	Options GcOptions    `codec:"options" json:"options"`
}

type KBFSGitInterface interface {
	// * createRepo creates a bare empty repo on KBFS under the given name in the given TLF.
	// * It returns the ID of the repo created.
	CreateRepo(context.Context, CreateRepoArg) (RepoID, error)
	// * deleteRepo deletes repo on KBFS under the given name in the given TLF.
	DeleteRepo(context.Context, DeleteRepoArg) error
	// * gc runs garbage collection on the given repo, using the given options to
	// * see whether anything needs to be done.
	Gc(context.Context, GcArg) error
}

func KBFSGitProtocol(i KBFSGitInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.KBFSGit",
		Methods: map[string]rpc.ServeHandlerDescription{
			"createRepo": {
				MakeArg: func() interface{} {
					var ret [1]CreateRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CreateRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CreateRepoArg)(nil), args)
						return
					}
					ret, err = i.CreateRepo(ctx, typedArgs[0])
					return
				},
			},
			"deleteRepo": {
				MakeArg: func() interface{} {
					var ret [1]DeleteRepoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteRepoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteRepoArg)(nil), args)
						return
					}
					err = i.DeleteRepo(ctx, typedArgs[0])
					return
				},
			},
			"gc": {
				MakeArg: func() interface{} {
					var ret [1]GcArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GcArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GcArg)(nil), args)
						return
					}
					err = i.Gc(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type KBFSGitClient struct {
	Cli rpc.GenericClient
}

// * createRepo creates a bare empty repo on KBFS under the given name in the given TLF.
// * It returns the ID of the repo created.
func (c KBFSGitClient) CreateRepo(ctx context.Context, __arg CreateRepoArg) (res RepoID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.KBFSGit.createRepo", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// * deleteRepo deletes repo on KBFS under the given name in the given TLF.
func (c KBFSGitClient) DeleteRepo(ctx context.Context, __arg DeleteRepoArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.KBFSGit.deleteRepo", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// * gc runs garbage collection on the given repo, using the given options to
// * see whether anything needs to be done.
func (c KBFSGitClient) Gc(ctx context.Context, __arg GcArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.KBFSGit.gc", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
