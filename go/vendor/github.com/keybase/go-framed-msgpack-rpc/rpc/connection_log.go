// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package rpc

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
)

const ConnectionLogMsgKey string = "msg"

type LogField struct {
	Key   string
	Value interface{}
}

// Format implements the fmt.Formatter interface, to make the structured
// LogField compatible with format-based non-structured loggers.
func (f LogField) Format(s fmt.State, verb rune) {
	fmt.Fprintf(s, "%"+string(verb), f.Value)
}

// ConnectionLog defines an interface used by connection.go for logging. An
// implementation that does structural logging may ignore `format` completely
// if `ConnectionLogMsgKey` is provided in LogField.
type ConnectionLog interface {
	Warning(format string, fields ...LogField)
	Debug(format string, fields ...LogField)
	Info(format string, fields ...LogField)
}

type ConnectionLogFactory interface {
	Make(section string) ConnectionLog
}

type connectionLogUnstructured struct {
	LogOutput
	logPrefix string
}

func newConnectionLogUnstructured(
	logOutput LogOutputWithDepthAdder, prefix string) *connectionLogUnstructured {
	randBytes := make([]byte, 4)
	_, _ = rand.Read(randBytes)
	return &connectionLogUnstructured{
		LogOutput: logOutput.CloneWithAddedDepth(1),
		logPrefix: strings.Join(
			[]string{prefix, hex.EncodeToString(randBytes)}, " "),
	}
}

func formatLogFields(f string, lf ...LogField) string {
	fields := make([]interface{}, 0, len(lf))
	for _, lf := range lf {
		fields = append(fields, lf)
	}
	return fmt.Sprintf(f, fields...)
}

func (l *connectionLogUnstructured) Warning(
	format string, fields ...LogField) {
	l.LogOutput.Warning("(%s) %s", l.logPrefix,
		formatLogFields(format, fields...))
}

func (l *connectionLogUnstructured) Debug(
	format string, fields ...LogField) {
	l.LogOutput.Debug("(%s) %s", l.logPrefix,
		formatLogFields(format, fields...))
}

func (l *connectionLogUnstructured) Info(
	format string, fields ...LogField) {
	l.LogOutput.Info("(%s) %s", l.logPrefix,
		formatLogFields(format, fields...))
}
