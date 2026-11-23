package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/stellarnet"
)

func FormatAmount(mctx libkb.MetaContext, amount string, precisionTwo bool, rounding stellarnet.FmtRoundingBehavior) (string, error) {
	if amount == "" {
		return "", fmt.Errorf("empty amount")
	}
	return stellarnet.FmtAmount(amount, precisionTwo, rounding)
}
