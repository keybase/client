// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type logRegister struct {
	forwarder *logFwd
	queue     *logQueue
	logger    logger.Logger
}

func newLogRegister(fwd *logFwd, logger logger.Logger) *logRegister {
	return &logRegister{
		forwarder: fwd,
		logger:    logger,
	}
}

func (r *logRegister) RegisterLogger(arg keybase1.RegisterLoggerArg, ui *LogUI) error {
	r.logger.Debug("Registering logger: %s @ level %d", arg.Name, arg.Level)
	if r.queue != nil {
		return errors.New("external logger already registered for this connection")
	}

	// create a new log queue and add it to the forwarder
	r.queue = newLogQueue(arg.Name, arg.Level, ui)
	r.forwarder.Add(r.queue)

	r.logger.Debug("Registered logger: %s", r.queue)

	return nil
}

func (r *logRegister) UnregisterLogger() {
	if r.queue == nil {
		return
	}
	// remove the log queue from the forwarder
	r.logger.Debug("Unregistering logger: %s", r.queue)
	r.forwarder.Remove(r.queue)
	r.logger.Debug("Unregistered logger: %s", r.queue)
}
