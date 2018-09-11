package resinit

import "net"

// Work around a glibc bug where cached configs from /etc/resolv.conf can cause
// DNS failures after the network changes. This is a no-op on non-Linux
// platforms. See implementation details in resinit_linux.go. The Rust standard
// library contains a similar workaround:
// https://github.com/rust-lang/rust/blob/028569ab1b/src/libstd/sys_common/net.rs#L186-L190
func ResInitIfDNSError(err error) {
	// There are two error cases we need to handle, a raw *net.DNSError, and
	// one wrapped in a *net.OpError. Detect that second case, and unwrap it.
	if opErr, isOpErr := err.(*net.OpError); isOpErr {
		err = opErr.Err
	}
	if _, isDNSError := err.(*net.DNSError); isDNSError {
		resInit()
	}
}
