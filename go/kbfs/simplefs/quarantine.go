// +build !darwin,!windows ios

package simplefs

import "golang.org/x/net/context"

// Quarantine is for adding the mark of the web
func Quarantine(ctx context.Context, path string) error {
	return nil
}
