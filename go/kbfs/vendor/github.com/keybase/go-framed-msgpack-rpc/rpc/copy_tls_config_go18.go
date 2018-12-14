// +build go1.8

package rpc

import "crypto/tls"

func copyTLSConfig(c *tls.Config) *tls.Config {
	if c == nil {
		return nil
	}
	return c.Clone()
}
