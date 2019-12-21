package client

import (
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type contactSettingsAPIHandler struct {
	libkb.Contextified
	cli    keybase1.AccountClient
	indent bool
}

func newContactSettingsAPIHandler(g *libkb.GlobalContext, indentOutput bool) *contactSettingsAPIHandler {
	return &contactSettingsAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

func (t *contactSettingsAPIHandler) handle(ctx context.Context, c Call, w io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return t.handleV1(ctx, c, w)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

const (
	getMethod = "get"
	setMethod = "set"
)

var validContactSettingsMethodsV1 = map[string]bool{
	getMethod: true,
	setMethod: true,
}

func (t *contactSettingsAPIHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	if !validContactSettingsMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	cli, err := GetAccountClient(t.G())
	if err != nil {
		return err
	}
	t.cli = cli

	switch c.Method {
	case getMethod:
		return t.get(ctx, c, w)
	case setMethod:
		return t.set(ctx, c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

func (t *contactSettingsAPIHandler) get(ctx context.Context, c Call, w io.Writer) error {
	res, err := t.cli.UserGetContactSettings(ctx)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, res, w)
}

type setOptions struct {
	Settings keybase1.ContactSettings `json:"settings"`
}

func (a *setOptions) Check() error {
	// expect server-side checks
	return nil
}

func (t *contactSettingsAPIHandler) set(ctx context.Context, c Call, w io.Writer) error {
	var opts setOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	arg := keybase1.ContactSettings{
		Enabled:              opts.Settings.Enabled,
		AllowGoodTeams:       opts.Settings.AllowGoodTeams,
		AllowFolloweeDegrees: opts.Settings.AllowFolloweeDegrees,
		Teams:                opts.Settings.Teams,
	}
	err := t.cli.UserSetContactSettings(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.get(ctx, c, w)
}

func (t *contactSettingsAPIHandler) encodeResult(call Call, result interface{}, w io.Writer) error {
	return encodeResult(call, result, w, t.indent)
}

func (t *contactSettingsAPIHandler) encodeErr(call Call, err error, w io.Writer) error {
	return encodeErr(call, err, w, t.indent)
}
