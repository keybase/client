// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build production

package stellarsvc

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/protocol/stellar1"
)

func (s *Server) WalletDumpLocal(ctx context.Context) (dump stellar1.Bundle, err error) {
	_, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        "WalletDumpLocal",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return dump, err
	}

	return dump, fmt.Errorf("WalletDumpLocal is disabled in prod mode")
}
