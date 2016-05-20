package rpc

import (
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"golang.org/x/net/context"
)

type testConnectionHandler struct{}

var _ ConnectionHandler = testConnectionHandler{}

func (testConnectionHandler) OnConnect(context.Context, *Connection, GenericClient, *Server) error {
	return nil
}

func (testConnectionHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
}

func (testConnectionHandler) OnDoCommandError(err error, nextTime time.Duration) {
}

func (testConnectionHandler) OnDisconnected(ctx context.Context, status DisconnectStatus) {
}

func (testConnectionHandler) ShouldRetry(name string, err error) bool {
	return false
}

func (testConnectionHandler) ShouldRetryOnConnect(err error) bool {
	return false
}

func (testConnectionHandler) HandlerName() string {
	return "testConnectionHandler"
}

type singleTransport struct {
	t Transporter
}

var _ ConnectionTransport = singleTransport{}

// Dial is an implementation of the ConnectionTransport interface.
func (st singleTransport) Dial(ctx context.Context) (Transporter, error) {
	if !st.t.IsConnected() {
		return nil, io.EOF
	}
	return st.t, nil
}

// IsConnected is an implementation of the ConnectionTransport interface.
func (st singleTransport) IsConnected() bool {
	return st.t.IsConnected()
}

// Finalize is an implementation of the ConnectionTransport interface.
func (st singleTransport) Finalize() {}

// Close is an implementation of the ConnectionTransport interface.
func (st singleTransport) Close() {}

type testStatus struct {
	Code int
}
type testUnwrapper struct{}

func testWrapError(err error) interface{} {
	return &testStatus{}
}

func testLogTags(ctx context.Context) (map[interface{}]string, bool) {
	return nil, false
}

type throttleError struct {
	Err error
}

func (e throttleError) ToStatus() (s testStatus) {
	s.Code = 15
	return
}

func (e throttleError) Error() string {
	return e.Err.Error()
}

type testErrorUnwrapper struct{}

var _ ErrorUnwrapper = testErrorUnwrapper{}

func (eu testErrorUnwrapper) MakeArg() interface{} {
	return &testStatus{}
}

func (eu testErrorUnwrapper) UnwrapError(arg interface{}) (appError error, dispatchError error) {
	s, ok := arg.(*testStatus)
	if !ok {
		return nil, errors.New("Error converting arg to testStatus object")
	}
	if s == nil || s.Code == 0 {
		return nil, nil
	}

	switch s.Code {
	case 15:
		appError = throttleError{errors.New("throttle")}
		break
	default:
		panic("Unknown testing error")
	}
	return appError, nil
}

// TestLogger is an interface for things, like *testing.T, that have a
// Logf function.
type TestLogger interface {
	Logf(format string, args ...interface{})
}

type testLogOutput struct {
	t TestLogger
}

func (t testLogOutput) log(ch string, fmts string, args []interface{}) {
	fmts = fmt.Sprintf("[%s] %s", ch, fmts)
	t.t.Logf(fmts, args...)
}

func (t testLogOutput) Info(fmt string, args ...interface{})    { t.log("I", fmt, args) }
func (t testLogOutput) Error(fmt string, args ...interface{})   { t.log("E", fmt, args) }
func (t testLogOutput) Debug(fmt string, args ...interface{})   { t.log("D", fmt, args) }
func (t testLogOutput) Warning(fmt string, args ...interface{}) { t.log("W", fmt, args) }
func (t testLogOutput) Profile(fmt string, args ...interface{}) { t.log("P", fmt, args) }

// MakeConnectionForTest returns a Connection object, and a net.Conn
// object representing the other end of that connection.
func MakeConnectionForTest(t TestLogger) (net.Conn, *Connection) {
	clientConn, serverConn := net.Pipe()
	logOutput := testLogOutput{t}
	logFactory := NewSimpleLogFactory(logOutput, nil)
	transporter := NewTransport(clientConn, logFactory, testWrapError)
	st := singleTransport{transporter}
	conn := NewConnectionWithTransport(testConnectionHandler{}, st,
		testErrorUnwrapper{}, true, testWrapError,
		logOutput, testLogTags)
	return serverConn, conn
}
