// +build !windows,!darwin,!linux

// A stub for mobile platforms and others that don't support notifications
// via popup-style windows.

package notifier

import (
	"errors"
)

// NewNotifier running on a non-linux, non-windows and non-darwin platform
// should just return the nil no-op notifier.
func NewNotifier() (Notifier, error) {
	return nil, errors.New("no notifier available on this platform")
}
