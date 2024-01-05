// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/updater/keybase"
)

type logger struct{}

// Debug is log implementation
func (l logger) Debug(s ...interface{}) {
	log.Printf("DEBG %s\n", s)
}

// Info is log implementation
func (l logger) Info(s ...interface{}) {
	log.Printf("INFO %s\n", s)
}

// Debugf is log implementation
func (l logger) Debugf(s string, args ...interface{}) {
	log.Printf("DEBG %s\n", fmt.Sprintf(s, args...))
}

// Infof is log implementation
func (l logger) Infof(s string, args ...interface{}) {
	log.Printf("INFO %s\n", fmt.Sprintf(s, args...))
}

// Warning is log implementation
func (l logger) Warning(s ...interface{}) {
	log.Printf("WARN %s\n", s)
}

// Warningf is log implementation
func (l logger) Warningf(s string, args ...interface{}) {
	log.Printf("WARN %s\n", fmt.Sprintf(s, args...))
}

// Error is log implementation
func (l logger) Error(s ...interface{}) {
	log.Printf("ERR  %s\n", s)
}

// Errorf is log implementation
func (l logger) Errorf(s string, args ...interface{}) {
	log.Printf("ERR  %s\n", fmt.Sprintf(s, args...))
}

func (l logger) setLogToFile(appName string, fileName string) (*os.File, string, error) {
	dir, err := keybase.LogDir(appName)
	if err != nil {
		return nil, "", err
	}
	logPath := filepath.Join(dir, fileName)
	logFile, err := os.OpenFile(logPath, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0600)
	if err != nil {
		return nil, "", err
	}
	log.Printf("Logging to %s", logPath)
	log.SetOutput(logFile)
	return logFile, logPath, nil
}
