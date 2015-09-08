package libfuse

import (
	"bytes"
	"time"

	"bazil.org/fuse"

	"github.com/rcrowley/go-metrics"
)

// MetricsFileName is the name of the KBFS metrics file -- it can be
// reached from any KBFS directory.
const MetricsFileName = ".kbfs_metrics"

func getEncodedMetrics(fs *FS) ([]byte, time.Time, error) {
	if registry := fs.config.MetricsRegistry(); registry != nil {
		b := bytes.NewBuffer(nil)
		metrics.WriteOnce(registry, b)
		return b.Bytes(), time.Time{}, nil
	}
	return []byte("Metrics have been turned off.\n"), time.Time{}, nil
}

// NewMetricsFile returns a special read file that contains a text
// representation of all metrics.
func NewMetricsFile(fs *FS, resp *fuse.LookupResponse) *SpecialReadFile {
	resp.EntryValid = 0
	return &SpecialReadFile{
		read: func() ([]byte, time.Time, error) {
			return getEncodedMetrics(fs)
		},
	}
}
