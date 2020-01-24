package client

import (
	"errors"
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type kvStoreAPIHandler struct {
	libkb.Contextified
	kvstore  keybase1.KvstoreClient
	selfTeam string
	indent   bool
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
	listMethod     = "list"
	delEntryMethod = "del"
)

var validKvstoreMethodsV1 = map[string]bool{
	getEntryMethod: true,
	putEntryMethod: true,
	listMethod:     true,
	delEntryMethod: true,
}

func (t *kvStoreAPIHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	if !validKvstoreMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	kvstore, err := GetKVStoreClient(t.G())
	if err != nil {
		return err
	}
	t.kvstore = kvstore

	config, err := GetConfigClient(t.G())
	if err != nil {
		return err
	}
	status, err := config.GetCurrentStatus(context.Background(), 0)
	if err != nil {
		return err
	}
	username := status.User.Username
	t.selfTeam = fmt.Sprintf("%s,%s", username, username)

	switch c.Method {
	case getEntryMethod:
		return t.getEntry(ctx, c, w)
	case putEntryMethod:
		return t.putEntry(ctx, c, w)
	case listMethod:
		return t.list(ctx, c, w)
	case delEntryMethod:
		return t.deleteEntry(ctx, c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

type getEntryOptions struct {
	Team      *string `json:"team,omitempty"`
	Namespace string  `json:"namespace"`
	EntryKey  string  `json:"entryKey"`
}

func (a *getEntryOptions) Check() error {
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
	if opts.Team == nil {
		opts.Team = &t.selfTeam
	}
	arg := keybase1.GetKVEntryArg{
		SessionID: 0,
		TeamName:  *opts.Team,
		Namespace: opts.Namespace,
		EntryKey:  opts.EntryKey,
	}
	res, err := t.kvstore.GetKVEntry(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, res, w)
}

type putEntryOptions struct {
	Team       *string `json:"team,omitempty"`
	Namespace  string  `json:"namespace"`
	EntryKey   string  `json:"entryKey"`
	Revision   *int    `json:"revision"`
	EntryValue string  `json:"entryValue"`
}

func (a *putEntryOptions) Check() error {
	if len(a.Namespace) == 0 {
		return errors.New("`namespace` field required")
	}
	if len(a.EntryKey) == 0 {
		return errors.New("`entryKey` field required")
	}
	if len(a.EntryValue) == 0 {
		return errors.New("`entryValue` field required")
	}
	if a.Revision != nil && *a.Revision <= 0 {
		return errors.New("if setting optional `revision` field, it needs to be a positive integer")
	}
	return nil
}

func (t *kvStoreAPIHandler) putEntry(ctx context.Context, c Call, w io.Writer) error {
	var opts putEntryOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}
	if opts.Team == nil {
		opts.Team = &t.selfTeam
	}
	var revision int
	if opts.Revision != nil {
		revision = *opts.Revision
	}
	arg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   *opts.Team,
		Namespace:  opts.Namespace,
		EntryKey:   opts.EntryKey,
		Revision:   revision,
		EntryValue: opts.EntryValue,
	}
	res, err := t.kvstore.PutKVEntry(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, res, w)
}

type deleteEntryOptions struct {
	Team      *string `json:"team,omitempty"`
	Namespace string  `json:"namespace"`
	EntryKey  string  `json:"entryKey"`
	Revision  *int    `json:"revision"`
}

func (a *deleteEntryOptions) Check() error {
	if len(a.Namespace) == 0 {
		return errors.New("`namespace` field required")
	}
	if len(a.EntryKey) == 0 {
		return errors.New("`entryKey` field required")
	}
	if a.Revision != nil && *a.Revision <= 0 {
		return errors.New("if setting optional `revision` field, it needs to be a positive integer")
	}
	return nil
}

func (t *kvStoreAPIHandler) deleteEntry(ctx context.Context, c Call, w io.Writer) error {
	var opts deleteEntryOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}
	if opts.Team == nil {
		opts.Team = &t.selfTeam
	}
	var revision int
	if opts.Revision != nil {
		revision = *opts.Revision
	}
	arg := keybase1.DelKVEntryArg{
		SessionID: 0,
		TeamName:  *opts.Team,
		Namespace: opts.Namespace,
		EntryKey:  opts.EntryKey,
		Revision:  revision,
	}
	res, err := t.kvstore.DelKVEntry(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, res, w)
}

type listOptions struct {
	Team      *string `json:"team,omitempty"`
	Namespace string  `json:"namespace"`
}

func (a *listOptions) Check() error {
	return nil
}

func (t *kvStoreAPIHandler) list(ctx context.Context, c Call, w io.Writer) error {
	var opts listOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}
	if opts.Team == nil {
		opts.Team = &t.selfTeam
	}
	if len(opts.Namespace) == 0 {
		// listing namespaces
		arg := keybase1.ListKVNamespacesArg{
			SessionID: 0,
			TeamName:  *opts.Team,
		}
		res, err := t.kvstore.ListKVNamespaces(ctx, arg)
		if err != nil {
			return t.encodeErr(c, err, w)
		}
		return t.encodeResult(c, res, w)
	}
	// listing entries inside a namespace
	arg := keybase1.ListKVEntriesArg{
		SessionID: 0,
		TeamName:  *opts.Team,
		Namespace: opts.Namespace,
	}
	res, err := t.kvstore.ListKVEntries(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, res, w)
}

func (t *kvStoreAPIHandler) encodeResult(call Call, result interface{}, w io.Writer) error {
	return encodeResult(call, result, w, t.indent)
}

func statusErrorCode(err error) (code int) {
	if err == nil {
		return 0
	}
	if aerr, ok := err.(libkb.AppStatusError); ok {
		return aerr.Code
	}
	return 0
}

func (t *kvStoreAPIHandler) encodeErr(call Call, err error, w io.Writer) error {
	errorCode := statusErrorCode(err)
	switch errorCode {
	case 0:
		return encodeErr(call, err, w, t.indent)
	default:
		// e.g. libkb.SCTeamStorageWrongRevision
		r := Reply{
			Error: &CallError{
				Message: err.Error(),
				Code:    errorCode,
			},
		}
		return encodeReply(call, r, w, t.indent)
	}
}
