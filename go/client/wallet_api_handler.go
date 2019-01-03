package client

import (
	"encoding/json"
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

// walletAPIHandler is a type that can handle all the json api
// methods for the wallet API.
type walletAPIHandler struct {
	libkb.Contextified
	cli    stellar1.LocalClient
	indent bool
}

// newWalletAPIHandler makes a walletAPIHandler.
func newWalletAPIHandler(g *libkb.GlobalContext, indentOutput bool) *walletAPIHandler {
	return &walletAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

// handle processes the Call based on the version.
func (w *walletAPIHandler) handle(ctx context.Context, c Call, wr io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return w.handleV1(ctx, c, wr)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

// list of all supported methods:
const (
	balancesMethod = "balances"
)

// validWalletMethodsV1 is a map of the valid V1 methods for quick lookup.
var validWalletMethodsV1 = map[string]bool{
	balancesMethod: true,
}

// handleV1 processes Call for version 1 of the wallet JSON API.
func (w *walletAPIHandler) handleV1(ctx context.Context, c Call, wr io.Writer) error {
	if !validWalletMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	cli, err := GetWalletClient(w.G())
	if err != nil {
		return err
	}
	w.cli = cli

	switch c.Method {
	case balancesMethod:
		return w.balances(ctx, c, wr)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

// balances returns the account balances for all accounts owned by the current user.
func (w *walletAPIHandler) balances(ctx context.Context, c Call, wr io.Writer) error {
	accounts, err := w.cli.WalletGetAccountsCLILocal(ctx)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, accounts, wr)
}

// encodeResult JSON encodes a successful result to the wr writer.
func (w *walletAPIHandler) encodeResult(call Call, result interface{}, wr io.Writer) error {
	reply := Reply{
		Result: result,
	}
	return w.encodeReply(call, reply, wr)
}

// encodeErr JSON encodes an error.
func (w *walletAPIHandler) encodeErr(call Call, err error, wr io.Writer) error {
	reply := Reply{Error: &CallError{Message: err.Error()}}
	return w.encodeReply(call, reply, wr)
}

// encodeReply JSON encodes all replies.
func (w *walletAPIHandler) encodeReply(call Call, reply Reply, wr io.Writer) error {
	reply.Jsonrpc = call.Jsonrpc
	reply.ID = call.ID

	enc := json.NewEncoder(wr)
	if w.indent {
		enc.SetIndent("", "    ")
	}
	return enc.Encode(reply)
}
