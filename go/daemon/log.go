package main

import (
	"fmt"

	keybase_1 "github.com/keybase/client/protocol/go"
)

type LogUI struct {
	sessionId int
	cli       *keybase_1.LogUiClient
}

func (l *LogUI) log(level int, format string, args []interface{}) {
	msg := fmt.Sprintf(format, args...)
	l.cli.Log(keybase_1.LogArg{
		SessionID: l.sessionId,
		Level:     keybase_1.LogLevel(level),
		Text: keybase_1.Text{
			Markup: false,
			Data:   msg,
		},
	})
}

func (l *LogUI) Debug(format string, args ...interface{}) {
	l.log(keybase_1.LogLevel_DEBUG, format, args)
}
func (l *LogUI) Info(format string, args ...interface{}) {
	l.log(keybase_1.LogLevel_INFO, format, args)
}
func (l *LogUI) Critical(format string, args ...interface{}) {
	l.log(keybase_1.LogLevel_CRITICAL, format, args)
}
func (l *LogUI) Warning(format string, args ...interface{}) {
	l.log(keybase_1.LogLevel_WARN, format, args)
}
func (l *LogUI) Error(format string, args ...interface{}) {
	l.log(keybase_1.LogLevel_ERROR, format, args)
}
func (l *LogUI) Notice(format string, args ...interface{}) {
	l.log(keybase_1.LogLevel_NOTICE, format, args)
}
