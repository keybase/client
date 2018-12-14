package rpc

import "fmt"

type testLogOutput struct {
	t TestLogger
}

func (t testLogOutput) log(ch string, fmts string, args []interface{}) {
	t.t.Helper()
	fmts = fmt.Sprintf("[%s] %s", ch, fmts)
	t.t.Logf(fmts, args...)
}

func (t testLogOutput) Info(fmt string, args ...interface{}) {
	t.t.Helper()
	t.log("I", fmt, args)
}

func (t testLogOutput) Error(fmt string, args ...interface{}) {
	t.t.Helper()
	t.log("E", fmt, args)
}

func (t testLogOutput) Debug(fmt string, args ...interface{}) {
	t.t.Helper()
	t.log("D", fmt, args)
}

func (t testLogOutput) Warning(fmt string, args ...interface{}) {
	t.t.Helper()
	t.log("W", fmt, args)
}

func (t testLogOutput) Profile(fmt string, args ...interface{}) {
	t.t.Helper()
	t.log("P", fmt, args)
}

func (t testLogOutput) CloneWithAddedDepth(depth int) LogOutputWithDepthAdder { return t }

func newTestLog(t TestLogger) SimpleLog {
	return SimpleLog{nil, testLogOutput{t}, SimpleLogOptions{}}
}
