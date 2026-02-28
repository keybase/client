package simplefs

import (
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLimitFilenameLengthForWindowsDownloads(t *testing.T) {
	if runtime.GOOS != "windows" {
		return
	}

	{
		fn := strings.Repeat("a", 251) + ".exe"
		limited := limitFilenameLengthForWindowsDownloads(fn)
		require.True(t, strings.HasSuffix(limited, ".exe"))
		require.True(t, len(limited) <= 200)
	}

	{
		fn := strings.Repeat("a", 100) + ".exe"
		limited := limitFilenameLengthForWindowsDownloads(fn)
		require.True(t, fn == limited)
	}
}
