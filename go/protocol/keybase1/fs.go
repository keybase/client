// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/fs.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type File struct {
	Path string `codec:"path" json:"path"`
}

func (o File) DeepCopy() File {
	return File{
		Path: o.Path,
	}
}

type ListResult struct {
	Files []File `codec:"files" json:"files"`
}

func (o ListResult) DeepCopy() ListResult {
	return ListResult{
		Files: (func(x []File) []File {
			if x == nil {
				return nil
			}
			ret := make([]File, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Files),
	}
}

type ListArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Path      string `codec:"path" json:"path"`
}

type FsInterface interface {
	// List files in a path. Implemented by KBFS service.
	List(context.Context, ListArg) (ListResult, error)
}

func FsProtocol(i FsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.fs",
		Methods: map[string]rpc.ServeHandlerDescription{
			"List": {
				MakeArg: func() interface{} {
					var ret [1]ListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListArg)(nil), args)
						return
					}
					ret, err = i.List(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type FsClient struct {
	Cli rpc.GenericClient
}

// List files in a path. Implemented by KBFS service.
func (c FsClient) List(ctx context.Context, __arg ListArg) (res ListResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.fs.List", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
