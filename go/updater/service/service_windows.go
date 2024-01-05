//go:build windows
// +build windows

package main

import "io"

type nopCloser struct{}

func (n *nopCloser) Close() error {
	return nil
}

func (s *service) lockPID() (io.Closer, error) {
	return &nopCloser{}, nil
}
