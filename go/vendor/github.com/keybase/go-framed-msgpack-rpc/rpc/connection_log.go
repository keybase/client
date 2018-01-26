// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package rpc

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"runtime"
	"strings"
)

const msgKey string = "msg"

type logField struct {
	key   string
	value interface{}
}

// Format implements the fmt.Formatter interface, to make the structured
// logField compatible with format-based non-structured loggers.
func (f logField) Format(s fmt.State, verb rune) {
	fmt.Fprintf(s, "%"+string(verb), f.value)
}

// connectionLog defines an interface used by connection.go for logging. An
// implementation that does structural logging may ignore `format` completely
// if `msgKey` is provided in logField.
type connectionLog interface {
	Warning(format string, fields ...logField)
	Debug(format string, fields ...logField)
	Info(format string, fields ...logField)
}

type connectionLogUnstructured struct {
	LogOutput
	logPrefix string
}

func newConnectionLogUnstructured(
	logOutput LogOutput, prefix string) *connectionLogUnstructured {
	randBytes := make([]byte, 4)
	rand.Read(randBytes)
	return &connectionLogUnstructured{
		LogOutput: logOutput,
		logPrefix: strings.Join(
			[]string{prefix, hex.EncodeToString(randBytes)}, " "),
	}
}

func formatLogFields(f string, lf ...logField) string {
	fields := make([]interface{}, 0, len(lf))
	for _, lf := range lf {
		fields = append(fields, lf)
	}
	return fmt.Sprintf(f, fields...)
}

func (l *connectionLogUnstructured) Warning(
	format string, fields ...logField) {
	l.LogOutput.Warning("(%s) %s", l.logPrefix,
		formatLogFields(format, fields...))
}

func (l *connectionLogUnstructured) Debug(
	format string, fields ...logField) {
	l.LogOutput.Debug("(%s) %s", l.logPrefix,
		formatLogFields(format, fields...))
}

func (l *connectionLogUnstructured) Info(
	format string, fields ...logField) {
	l.LogOutput.Info("(%s) %s", l.logPrefix,
		formatLogFields(format, fields...))
}

// LogrusEntry and LogrusLogger define methods we need from logrus to avoid
// pulling logrus as dependency.
type LogrusEntry interface {
	Debug(args ...interface{})
	Info(args ...interface{})
	Warning(args ...interface{})
}

// LogrusLogger maps to *logrus.Logger, but will need an adapter that converts
// map[string]interface{} to logrus.Fields, and adapt logrus.Entry to
// LogrusEntry.
type LogrusLogger interface {
	WithFields(map[string]interface{}) LogrusEntry
}

type connectionLogLogrus struct {
	log LogrusLogger

	section   string
	randBytes string
}

func newConnectionLogLogrus(
	log LogrusLogger, section string) *connectionLogLogrus {
	randBytes := make([]byte, 4)
	rand.Read(randBytes)
	return &connectionLogLogrus{
		log:       log,
		section:   section,
		randBytes: hex.EncodeToString(randBytes),
	}
}

func (l *connectionLogLogrus) getLogEntryAndExtractMsg(
	format string, fields []logField) (entry LogrusEntry, msg string) {
	_, file, line, ok := runtime.Caller(2)
	if !ok {
		file, line = "unknown", -1
	}
	mFields := make(map[string]interface{})
	for _, f := range fields {
		mFields[f.key] = f.value
	}
	mFields["section"] = l.section
	mFields["identifier"] = l.randBytes
	mFields["file"], mFields["line"] = file, line

	if msgI, ok := mFields[msgKey]; ok { // msgKey is present.
		// Try to cast it to a `string` and use it as msg. If cast fails, just
		// use "%v" of it as msg.
		if msg, ok = msgI.(string); !ok {
			msg = fmt.Sprintf("%v", msgI)
		}
	} else {
		// msgKey isn't present in fields, so just use "<empty>" to help make it
		// indexable.
		msg = "<empty>"
	}

	return l.log.WithFields(mFields), msg
}

func (l *connectionLogLogrus) Warning(format string, fields ...logField) {
	e, msg := l.getLogEntryAndExtractMsg(format, fields)
	e.Warning(msg)
}

func (l *connectionLogLogrus) Info(format string, fields ...logField) {
	e, msg := l.getLogEntryAndExtractMsg(format, fields)
	e.Info(msg)
}

func (l *connectionLogLogrus) Debug(format string, fields ...logField) {
	e, msg := l.getLogEntryAndExtractMsg(format, fields)
	e.Debug(msg)
}
