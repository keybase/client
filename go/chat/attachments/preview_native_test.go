//go:build darwin || android
// +build darwin android

package attachments

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPreviewAudioEmptyAmps(t *testing.T) {
	res, err := previewAudio(1234, nil)
	require.NoError(t, err)
	require.NotNil(t, res)
	require.True(t, res.BaseIsAudio)
	require.Equal(t, 1234, res.BaseDurationMs)
	require.Len(t, res.AudioAmps, audioAmpsCount)
	require.NotEmpty(t, res.Source)
	require.Positive(t, res.PreviewWidth)
	require.Positive(t, res.PreviewHeight)
}
