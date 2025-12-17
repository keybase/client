//go:build (!darwin && !windows) || ios
// +build !darwin,!windows ios

package attachments

import "context"

func Quarantine(ctx context.Context, path string) error {
	return nil
}
