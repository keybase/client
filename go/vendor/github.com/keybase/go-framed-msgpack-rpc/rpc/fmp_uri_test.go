package rpc

import (
	"net"
	"testing"
)

type fmpURITest struct {
	in  string
	out *FMPURI
	err string
	tls bool
}

var addrErr = net.AddrError{Err: "missing port in address", Addr: "gregor.api.keybase.io"}

var fmpURITests = []fmpURITest{
	{in: "fmprpc://gregor.api.keybase.io:80", out: &FMPURI{Scheme: fmpSchemeStandard, HostPort: "gregor.api.keybase.io:80", Host: "gregor.api.keybase.io"}},
	{in: "fmprpc+tls://gregor.api.keybase.io:443", out: &FMPURI{Scheme: fmpSchemeTLS, HostPort: "gregor.api.keybase.io:443", Host: "gregor.api.keybase.io"}, tls: true},
	{in: "fmprpc+tls://gregor.api.keybase.io:80", out: &FMPURI{Scheme: fmpSchemeTLS, HostPort: "gregor.api.keybase.io:80", Host: "gregor.api.keybase.io"}, tls: true},
	{in: "fmprpc://gregor.api.keybase.io:443", out: &FMPURI{Scheme: fmpSchemeStandard, HostPort: "gregor.api.keybase.io:443", Host: "gregor.api.keybase.io"}},
	{in: "https://gregor.api.keybase.io:443", err: "invalid framed msgpack rpc scheme https"},
	{in: "fmprpc://gregor.api.keybase.io", err: addrErr.Error()},
	{in: "fmprpc+tls://gregor.api.keybase.io", err: addrErr.Error()},
	{in: "fmprpc+tls://:443", err: "missing host in address :443"},
}

func TestParseFMPURI(t *testing.T) {
	for _, test := range fmpURITests {
		u, err := ParseFMPURI(test.in)
		if err != nil {
			if test.err == "" {
				t.Errorf("Parse(%q) error: %v, expected no error", test.in, err)
			}
			if err.Error() != test.err {
				t.Errorf("Parse(%q) error: %v, expected %v", test.in, err, test.err)
			}
			continue
		} else if test.err != "" {
			t.Errorf("Parse(%q) no error, expected %v", test.in, test.err)
			continue
		}
		if u.Scheme != test.out.Scheme {
			t.Errorf("Parse(%q) scheme: %q, expected %q", test.in, u.Scheme, test.out.Scheme)
		}
		if u.Host != test.out.Host {
			t.Errorf("Parse(%q) host: %q, expected %q", test.in, u.Host, test.out.Host)
		}
		if u.HostPort != test.out.HostPort {
			t.Errorf("Parse(%q) host: %q, expected %q", test.in, u.Host, test.out.Host)
		}
		if u.UseTLS() != test.tls {
			t.Errorf("Parse(%q) use tls: %v, expected %v", test.in, u.UseTLS(), test.tls)
		}
	}
}
