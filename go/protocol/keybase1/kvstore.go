// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kvstore.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type KVGetResult struct {
	TeamName   string  `codec:"teamName" json:"teamName"`
	Namespace  string  `codec:"namespace" json:"namespace"`
	EntryKey   string  `codec:"entryKey" json:"entryKey"`
	EntryValue *string `codec:"entryValue" json:"entryValue"`
	Revision   int     `codec:"revision" json:"revision"`
}

func (o KVGetResult) DeepCopy() KVGetResult {
	return KVGetResult{
		TeamName:  o.TeamName,
		Namespace: o.Namespace,
		EntryKey:  o.EntryKey,
		EntryValue: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.EntryValue),
		Revision: o.Revision,
	}
}

type KVPutResult struct {
	TeamName  string `codec:"teamName" json:"teamName"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
	Revision  int    `codec:"revision" json:"revision"`
}

func (o KVPutResult) DeepCopy() KVPutResult {
	return KVPutResult{
		TeamName:  o.TeamName,
		Namespace: o.Namespace,
		EntryKey:  o.EntryKey,
		Revision:  o.Revision,
	}
}

type KVEntryID struct {
	TeamID    TeamID `codec:"teamID" json:"teamID"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
}

func (o KVEntryID) DeepCopy() KVEntryID {
	return KVEntryID{
		TeamID:    o.TeamID.DeepCopy(),
		Namespace: o.Namespace,
		EntryKey:  o.EntryKey,
	}
}

type EncryptedKVEntry struct {
	V int    `codec:"v" json:"v"`
	E []byte `codec:"e" json:"e"`
	N []byte `codec:"n" json:"n"`
}

func (o EncryptedKVEntry) DeepCopy() EncryptedKVEntry {
	return EncryptedKVEntry{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.N),
	}
}

type KVListNamespaceResult struct {
	TeamName   string   `codec:"teamName" json:"teamName"`
	Namespaces []string `codec:"namespaces" json:"namespaces"`
}

func (o KVListNamespaceResult) DeepCopy() KVListNamespaceResult {
	return KVListNamespaceResult{
		TeamName: o.TeamName,
		Namespaces: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Namespaces),
	}
}

type KVListEntryKey struct {
	EntryKey string `codec:"entryKey" json:"entryKey"`
	Revision int    `codec:"revision" json:"revision"`
}

func (o KVListEntryKey) DeepCopy() KVListEntryKey {
	return KVListEntryKey{
		EntryKey: o.EntryKey,
		Revision: o.Revision,
	}
}

type KVListEntryResult struct {
	TeamName  string           `codec:"teamName" json:"teamName"`
	Namespace string           `codec:"namespace" json:"namespace"`
	EntryKeys []KVListEntryKey `codec:"entryKeys" json:"entryKeys"`
}

func (o KVListEntryResult) DeepCopy() KVListEntryResult {
	return KVListEntryResult{
		TeamName:  o.TeamName,
		Namespace: o.Namespace,
		EntryKeys: (func(x []KVListEntryKey) []KVListEntryKey {
			if x == nil {
				return nil
			}
			ret := make([]KVListEntryKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.EntryKeys),
	}
}

type KVDeleteEntryResult struct {
	TeamName  string `codec:"teamName" json:"teamName"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
	Revision  int    `codec:"revision" json:"revision"`
}

func (o KVDeleteEntryResult) DeepCopy() KVDeleteEntryResult {
	return KVDeleteEntryResult{
		TeamName:  o.TeamName,
		Namespace: o.Namespace,
		EntryKey:  o.EntryKey,
		Revision:  o.Revision,
	}
}

type GetKVEntryArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamName  string `codec:"teamName" json:"teamName"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
}

type PutKVEntryArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	TeamName   string `codec:"teamName" json:"teamName"`
	Namespace  string `codec:"namespace" json:"namespace"`
	EntryKey   string `codec:"entryKey" json:"entryKey"`
	Revision   int    `codec:"revision" json:"revision"`
	EntryValue string `codec:"entryValue" json:"entryValue"`
}

type ListKVNamespacesArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamName  string `codec:"teamName" json:"teamName"`
}

type ListKVEntriesArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamName  string `codec:"teamName" json:"teamName"`
	Namespace string `codec:"namespace" json:"namespace"`
}

type DelKVEntryArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamName  string `codec:"teamName" json:"teamName"`
	Namespace string `codec:"namespace" json:"namespace"`
	EntryKey  string `codec:"entryKey" json:"entryKey"`
	Revision  int    `codec:"revision" json:"revision"`
}

type KvstoreInterface interface {
	GetKVEntry(context.Context, GetKVEntryArg) (KVGetResult, error)
	PutKVEntry(context.Context, PutKVEntryArg) (KVPutResult, error)
	ListKVNamespaces(context.Context, ListKVNamespacesArg) (KVListNamespaceResult, error)
	ListKVEntries(context.Context, ListKVEntriesArg) (KVListEntryResult, error)
	DelKVEntry(context.Context, DelKVEntryArg) (KVDeleteEntryResult, error)
}

func KvstoreProtocol(i KvstoreInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.kvstore",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getKVEntry": {
				MakeArg: func() interface{} {
					var ret [1]GetKVEntryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetKVEntryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetKVEntryArg)(nil), args)
						return
					}
					ret, err = i.GetKVEntry(ctx, typedArgs[0])
					return
				},
			},
			"putKVEntry": {
				MakeArg: func() interface{} {
					var ret [1]PutKVEntryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PutKVEntryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PutKVEntryArg)(nil), args)
						return
					}
					ret, err = i.PutKVEntry(ctx, typedArgs[0])
					return
				},
			},
			"listKVNamespaces": {
				MakeArg: func() interface{} {
					var ret [1]ListKVNamespacesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListKVNamespacesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListKVNamespacesArg)(nil), args)
						return
					}
					ret, err = i.ListKVNamespaces(ctx, typedArgs[0])
					return
				},
			},
			"listKVEntries": {
				MakeArg: func() interface{} {
					var ret [1]ListKVEntriesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListKVEntriesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListKVEntriesArg)(nil), args)
						return
					}
					ret, err = i.ListKVEntries(ctx, typedArgs[0])
					return
				},
			},
			"delKVEntry": {
				MakeArg: func() interface{} {
					var ret [1]DelKVEntryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DelKVEntryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DelKVEntryArg)(nil), args)
						return
					}
					ret, err = i.DelKVEntry(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type KvstoreClient struct {
	Cli rpc.GenericClient
}

func (c KvstoreClient) GetKVEntry(ctx context.Context, __arg GetKVEntryArg) (res KVGetResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kvstore.getKVEntry", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c KvstoreClient) PutKVEntry(ctx context.Context, __arg PutKVEntryArg) (res KVPutResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kvstore.putKVEntry", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c KvstoreClient) ListKVNamespaces(ctx context.Context, __arg ListKVNamespacesArg) (res KVListNamespaceResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kvstore.listKVNamespaces", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c KvstoreClient) ListKVEntries(ctx context.Context, __arg ListKVEntriesArg) (res KVListEntryResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kvstore.listKVEntries", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c KvstoreClient) DelKVEntry(ctx context.Context, __arg DelKVEntryArg) (res KVDeleteEntryResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kvstore.delKVEntry", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
