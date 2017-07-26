package resinit

import "net"

// If we get a DNS error, it could be because glibc has cached an old version
// of /etc/resolv.conf. The res_init() libc function busts that cache and keeps
// us from getting stuck in a state where DNS requests keep failing even though
// the network is up. This is similar to what the Rust standard library does:
// https://github.com/rust-lang/rust/blob/028569ab1b/src/libstd/sys_common/net.rs#L186-L190
func ResInitIfDNSError(err error) {
	// There are two error cases we need to handle, a raw *net.DNSError, and
	// one wrapped in a *net.OpError. Detect that second case, and unwrap it.
	if opErr, isOpErr := err.(*net.OpError); isOpErr {
		err = opErr.Err
	}
	if _, isDNSError := err.(*net.DNSError); isDNSError {
		// defined per platform in resinit_*.go
		resInit()
	}
}
