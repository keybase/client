//go:build darwin || android
// +build darwin android

package attachments

import (
	"math"
	"path/filepath"
	"strings"
)

const audioAmpsCount = 60

func isAudioExtension(basename string) bool {
	switch strings.ToLower(filepath.Ext(basename)) {
	case ".m4a", ".mp3", ".aac", ".ogg", ".flac", ".wav", ".opus", ".aiff", ".caf":
		return true
	}
	return false
}

func normalizeAudioAmps(amps []float64) []float64 {
	if len(amps) == 0 {
		return make([]float64, audioAmpsCount)
	}
	return amps
}

// previewAudio generates a waveform preview image and packages amplitude data
// for an audio-only file. amps are linear RMS values in [0,1].
func previewAudio(duration int, amps []float64) (*PreviewRes, error) {
	amps = normalizeAudioAmps(amps)
	// audioVisualizer expects dB values; convert from linear RMS.
	dbAmps := make([]float64, len(amps))
	for i, a := range amps {
		if a <= 0 {
			dbAmps[i] = -80
		} else {
			dbAmps[i] = 20 * math.Log10(a)
		}
	}
	v := newAudioVisualizer(dbAmps)
	dat, width := v.visualize()
	return &PreviewRes{
		Source:         dat,
		ContentType:    "image/png",
		BaseWidth:      width,
		BaseHeight:     v.height,
		BaseDurationMs: duration,
		BaseIsAudio:    true,
		AudioAmps:      amps,
		PreviewWidth:   width,
		PreviewHeight:  v.height,
	}, nil
}
