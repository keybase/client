package client

import (
	"errors"
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type kvStoreAPIHandler struct {
	libkb.Contextified
	cli    keybase1.KvstoreClient
	indent bool
}

func newKVStoreAPIHandler(g *libkb.GlobalContext, indentOutput bool) *kvStoreAPIHandler {
	return &kvStoreAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

func (t *kvStoreAPIHandler) handle(ctx context.Context, c Call, w io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return t.handleV1(ctx, c, w)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

const (
	getEntryMethod = "get"
	putEntryMethod = "put"
)

var validKvstoreMethodsV1 = map[string]bool{
	getEntryMethod: true,
	putEntryMethod: true,
}

func (t *kvStoreAPIHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	if !validKvstoreMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	cli, err := GetKVStoreClient(t.G())
	if err != nil {
		return err
	}
	t.cli = cli

	switch c.Method {
	case getEntryMethod:
		return t.getEntry(ctx, c, w)
	case putEntryMethod:
		return t.putEntry(ctx, c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

type getEntryOptions struct {
	Team      string `json:"team"`
	Namespace string `json:"namespace"`
	EntryKey  string `json:"entryKey"`
}

func (a *getEntryOptions) Check() error {
	if len(a.Team) == 0 {
		return errors.New("`team` field required")
	}
	if len(a.Namespace) == 0 {
		return errors.New("`namespace` field required")
	}
	if len(a.EntryKey) == 0 {
		return errors.New("`entryKey` field required")
	}
	return nil
}

func (t *kvStoreAPIHandler) getEntry(ctx context.Context, c Call, w io.Writer) error {
	var opts getEntryOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}
	arg := keybase1.GetKVEntryArg{
		SessionID: 0,
		TeamName:  opts.Team,
		Namespace: opts.Namespace,
		EntryKey:  opts.EntryKey,
	}
	res, err := t.cli.GetKVEntry(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, res, w)
}

type putEntryOptions struct {
	Team       string `json:"team"`
	Namespace  string `json:"namespace"`
	EntryKey   string `json:"entryKey"`
	EntryValue string `json:"entryValue"`
}

func (a *putEntryOptions) Check() error {
	if len(a.Team) == 0 {
		return errors.New("`team` field required")
	}
	if len(a.Namespace) == 0 {
		return errors.New("`namespace` field required")
	}
	if len(a.EntryKey) == 0 {
		return errors.New("`entryKey` field required")
	}
	if len(a.EntryValue) == 0 {
		return errors.New("`entryValue` field required")
	}
	return nil
}

func (t *kvStoreAPIHandler) putEntry(ctx context.Context, c Call, w io.Writer) error {
	var opts putEntryOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}
	arg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   opts.Team,
		Namespace:  opts.Namespace,
		EntryKey:   opts.EntryKey,
		EntryValue: opts.EntryValue,
	}
	res, err := t.cli.PutKVEntry(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, res, w)
}

func (t *kvStoreAPIHandler) encodeResult(call Call, result interface{}, w io.Writer) error {
	return encodeResult(call, result, w, t.indent)
}

func (t *kvStoreAPIHandler) encodeErr(call Call, err error, w io.Writer) error {
	return encodeErr(call, err, w, t.indent)
}
