package libkb

import (
	"crypto/tls"
	"net"
	"time"
)

//  ---------------
// | TimeoutDialer |
//  ---------------

// A wrapper around the standard Dialer that returns connections with
// read/write timeout's that are the same as the dial timeout.
type TimeoutDialer struct {
	Dialer    net.Dialer
	TlsConfig *tls.Config
}

// Create a TimeoutDialer with just the timeout configured, but no other dialer
// fields. This is a convenience constructor for the most common use case.
// Callers that need other Dialer settings can either instantiate a
// TimeoutDialer directly, or modify those fields after calling this. (The
// internal Dialer here is public.)
func NewTimeoutDialer(timeout time.Duration, tlsConfig *tls.Config) *TimeoutDialer {
	return &TimeoutDialer{
		Dialer: net.Dialer{
			Timeout: timeout,
		},
		TlsConfig: tlsConfig,
	}
}

func (d *TimeoutDialer) DialTLS(network, address string) (net.Conn, error) {
	// tls.DialWithDialer respects the timeout on the Dialer during the TLS
	// handshake.
	conn, err := tls.DialWithDialer(&d.Dialer, network, address, d.TlsConfig)
	if err != nil {
		return nil, err
	}
	return WrapConnWithTimeout(conn, d.Dialer.Timeout), nil
}

//  ---------------------
// | WrapDialWithTimeout |
//  ---------------------

// Wrapper for existing Dial functions, for cases where we can't supply a brand
// new one. Like WrapConnWithTimeout, this has no effect on the dial timeout.
// Prefer TimeoutDialer where possible.
func WrapDialWithTimeout(dial dialFunc, timeout time.Duration) dialFunc {
	return func(network, address string) (net.Conn, error) {
		conn, err := dial(network, address)
		if err != nil {
			return nil, err
		}
		return WrapConnWithTimeout(conn, timeout), nil
	}
}

type dialFunc func(network, address string) (net.Conn, error)

//  ---------------------
// | WrapConnWithTimeout |
//  ---------------------

// WrapConnWithTimeout takes an existing (already dialed) connection and wraps
// it so that each read and write sets a timeout. This doesn't affect the dial
// timeout, which will have already elapsed. Prefer TimeoutDialer where
// possible.
func WrapConnWithTimeout(inner net.Conn, timeout time.Duration) net.Conn {
	return &timeoutConn{inner, timeout}
}

// The net.Conn interface exposes a "deadline" interface for timing out read
// and write operations, but that requires an absolute time. This wrapper turns
// that feature into a per-operation timeout.
type timeoutConn struct {
	net.Conn
	timeout time.Duration
}

func (t *timeoutConn) setDeadline() error {
	// A timeout of zero is equivalent to no timeout.
	if t.timeout == 0 {
		return t.Conn.SetDeadline(time.Time{})
	} else {
		return t.Conn.SetDeadline(time.Now().Add(t.timeout))
	}
}

func (t *timeoutConn) Read(b []byte) (int, error) {
	err := t.setDeadline()
	if err != nil {
		return 0, err
	}
	return t.Conn.Read(b)
}

func (t *timeoutConn) Write(b []byte) (int, error) {
	err := t.setDeadline()
	if err != nil {
		return 0, err
	}
	return t.Conn.Write(b)
}
