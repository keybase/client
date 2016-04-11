package service

import "testing"

type fmpURITest struct {
	in  string
	out fmpURI
	err string
	tls bool
}

var fmpURITests = []fmpURITest{
	{in: "fmprpc://gregor.api.keybase.io:80", out: fmpURI{Scheme: fmpSchemeStandard, HostPort: "gregor.api.keybase.io:80", Host: "gregor.api.keybase.io"}},
	{in: "fmprpc+tls://gregor.api.keybase.io:443", out: fmpURI{Scheme: fmpSchemeTLS, HostPort: "gregor.api.keybase.io:443", Host: "gregor.api.keybase.io"}, tls: true},
	{in: "fmprpc+tls://gregor.api.keybase.io:80", out: fmpURI{Scheme: fmpSchemeTLS, HostPort: "gregor.api.keybase.io:80", Host: "gregor.api.keybase.io"}, tls: true},
	{in: "fmprpc://gregor.api.keybase.io:443", out: fmpURI{Scheme: fmpSchemeStandard, HostPort: "gregor.api.keybase.io:443", Host: "gregor.api.keybase.io"}},
	{in: "https://gregor.api.keybase.io:443", err: "invalid framed msgpack rpc scheme https"},
	{in: "fmprpc://gregor.api.keybase.io", err: "missing port in address gregor.api.keybase.io"},
	{in: "fmprpc+tls://gregor.api.keybase.io", err: "missing port in address gregor.api.keybase.io"},
	{in: "fmprpc+tls://:443", err: "missing host in address :443"},
}

func TestParseFMPURI(t *testing.T) {
	for _, test := range fmpURITests {
		u, err := parseFMPURI(test.in)
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
