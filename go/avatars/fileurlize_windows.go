//go:build windows
// +build windows

package avatars

import (
	"strings"
)

func fileUrlize(path string) string {
	return `/` + strings.ReplaceAll(path, `\`, `/`)
}
