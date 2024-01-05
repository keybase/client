// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
)

// Log is the logging interface for the service package
type Log interface {
	Debug(...interface{})
	Info(...interface{})
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
	Warningf(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}

type service struct {
	updater       *updater.Updater
	updateChecker *updater.UpdateChecker
	context       updater.Context
	log           Log
	appName       string
	ch            chan int
}

func newService(upd *updater.Updater, context updater.Context, log Log, appName string) *service {
	svc := service{
		updater: upd,
		context: context,
		log:     log,
		appName: appName,
		ch:      make(chan int),
	}
	return &svc
}

func (s *service) Start() {
	if s.updateChecker == nil {
		tickDuration := util.EnvDuration("KEYBASE_UPDATER_DELAY", updater.DefaultTickDuration)
		s.updater.SetTickDuration(tickDuration)
		updateChecker := updater.NewUpdateChecker(s.updater, s.context, tickDuration, s.log)
		s.updateChecker = &updateChecker
	}
	s.updateChecker.Start()
}

func (s *service) Run() {
	closer, err := s.lockPID()
	if err != nil {
		s.log.Errorf("updater service not starting due to lockPID error: %s", err)
		return
	}
	defer closer.Close()

	s.Start()
	<-s.ch
}

func (s *service) Quit() {
	s.ch <- 0
}
