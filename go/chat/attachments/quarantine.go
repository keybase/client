// +build !darwin,!windows ios

package attachments

import "golang.org/x/net/context"

func Quarantine(ctx context.Context, path string) error {
	return nil
}
