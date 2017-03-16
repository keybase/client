// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func (c *CmdSimpleFSList) output(listResult keybase1.SimpleFSListResult) error {

	ui := c.G().UI.GetTerminalUI()

	for _, e := range listResult.Entries {
		if e.DirentType == keybase1.DirentType_DIR {
			ui.Printf("%s\t<%s>\t\t%s\n", keybase1.FormatTime(e.Time), keybase1.DirentTypeRevMap[e.DirentType], e.Name)
		} else {
			ui.Printf("%s\t%s\t%d\t%s\n", keybase1.FormatTime(e.Time), keybase1.DirentTypeRevMap[e.DirentType], e.Size, e.Name)
		}
	}
	return nil
}
