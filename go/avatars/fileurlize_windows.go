// +build windows

package avatars

import (
	"strings"
)

func fileUrlize(path string) string {
	return `/` + strings.Replace(path, `\`, `/`, -1)
}
