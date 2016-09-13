// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// GetJournalServer returns the JournalServer tied to a particular
// config.
func GetJournalServer(config Config) (*JournalServer, error) {
	bserver := config.BlockServer()
	jbserver, ok := bserver.(journalBlockServer)
	if !ok {
		return nil, errors.New("Write journal not enabled")
	}
	return jbserver.jServer, nil
}

// TLFJournalEnabled returns true if journaling is enabled for the
// given TLF.
func TLFJournalEnabled(config Config, tlfID TlfID) bool {
	if jServer, err := GetJournalServer(config); err == nil {
		_, err := jServer.JournalStatus(tlfID)
		return err == nil
	}
	return false
}

// WaitForTLFJournal waits for the corresponding journal to flush, if
// one exists.
func WaitForTLFJournal(ctx context.Context, config Config, tlfID TlfID,
	log logger.Logger) error {
	if jServer, err := GetJournalServer(config); err == nil {
		log.CDebugf(ctx, "Waiting for journal to flush")
		if err := jServer.Wait(ctx, tlfID); err != nil {
			return err
		}
	}
	return nil
}
