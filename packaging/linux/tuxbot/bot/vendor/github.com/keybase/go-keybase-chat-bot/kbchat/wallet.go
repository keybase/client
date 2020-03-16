package kbchat

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/go-keybase-chat-bot/kbchat/types/stellar1"
)

type WalletOutput struct {
	Result stellar1.PaymentCLILocal `json:"result"`
}

func (a *API) GetWalletTxDetails(txID string) (wOut WalletOutput, err error) {
	a.Lock()
	defer a.Unlock()

	apiInput := fmt.Sprintf(`{"method": "details", "params": {"options": {"txid": "%s"}}}`, txID)
	cmd := a.runOpts.Command("wallet", "api")
	cmd.Stdin = strings.NewReader(apiInput)
	var out bytes.Buffer
	cmd.Stdout = &out
	err = cmd.Run()
	if err != nil {
		return wOut, err
	}

	if err := json.Unmarshal(out.Bytes(), &wOut); err != nil {
		return wOut, fmt.Errorf("unable to decode wallet output: %s", err.Error())
	}

	return wOut, nil
}
