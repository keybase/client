// +build windows

package client

func HasColor() bool {
	// This is used for embedding color codes in UI strings,
	// which won't work in Windows
	return false
}
