package remote

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

// Getting server config - like currency definitions - from the
// server, using `stellar/config` API.

type configResult struct {
	Status     libkb.AppStatus                                                     `json:"status"`
	Revision   int                                                                 `json:"revision"`
	Currencies map[stellar1.OutsideCurrencyCode]stellar1.OutsideCurrencyDefinition `json:"currencies"`
}

func (b *configResult) GetAppStatus() *libkb.AppStatus {
	return &b.Status
}

func FetchServerConfig(ctx context.Context, g *libkb.GlobalContext) (ret stellar1.StellarServerDefinitions, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/config",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
	}

	var res configResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return ret, err
	}

	ret.Revision = res.Revision
	ret.Currencies = res.Currencies
	return ret, nil
}
