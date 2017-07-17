// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type LogUI struct {
	sessionID int
	cli       *keybase1.LogUiClient
}

func (l *LogUI) Log(level keybase1.LogLevel, format string, args []interface{}) {
	msg := fmt.Sprintf(format, args...)
	l.cli.Log(context.TODO(), keybase1.LogArg{
		SessionID: l.sessionID,
		Level:     keybase1.LogLevel(level),
		Text: keybase1.Text{
			Markup: false,
			Data:   msg,
		},
	})
}

func (l *LogUI) Debug(format string, args ...interface{}) {
	l.Log(keybase1.LogLevel_DEBUG, format, args)
}
func (l *LogUI) Info(format string, args ...interface{}) {
	l.Log(keybase1.LogLevel_INFO, format, args)
}
func (l *LogUI) Critical(format string, args ...interface{}) {
	l.Log(keybase1.LogLevel_CRITICAL, format, args)
}
func (l *LogUI) Warning(format string, args ...interface{}) {
	l.Log(keybase1.LogLevel_WARN, format, args)
}
func (l *LogUI) Errorf(format string, args ...interface{}) {
	l.Log(keybase1.LogLevel_ERROR, format, args)
}
func (l *LogUI) Notice(format string, args ...interface{}) {
	l.Log(keybase1.LogLevel_NOTICE, format, args)
}
