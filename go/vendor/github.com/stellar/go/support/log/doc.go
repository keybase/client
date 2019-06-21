// Package log provides the common logging facilities used by the Stellar
// Development foundation.
//
// You may notice that this package does not expose the "Fatal" family of
// logging functions:  this is intentional.  This package is specifically geared
// to logging within the context of an http server, and our chosen path for
// responding to "Oh my god something is horribly wrong" within the context
// of an HTTP request is to panic on that request.
//
package log
