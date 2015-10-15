// +build !windows

package client

func HasColor() bool {
	// TODO Color should be based on whether log format supports it
	logFormatHasColor := map[string]bool{
		"":        true,
		"default": true,
		"fancy":   true,
	}
	return logFormatHasColor[G.Env.GetLogFormat()]
}
