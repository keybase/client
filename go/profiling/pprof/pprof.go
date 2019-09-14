package pprof

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime/pprof"
	"runtime/trace"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

type TimedPprofProfiler interface {
	Name() string

	MaxFileCount() int
	MakeFilename(dir string, start time.Time, duration time.Duration) string
	GetSortedFiles(dir string) ([]string, error)

	Start(w io.Writer) error
	Stop()
}

func durationSecToDuration(s keybase1.DurationSec) time.Duration {
	return time.Duration(float64(s) * float64(time.Second))
}

// DoTimedPprofProfile asynchronously runs a profile with the given
// timedProfiler and associated parameters.
func DoTimedPprofProfile(log libkb.LogUI, delayedLog logger.Logger,
	profiler TimedPprofProfiler, outputFile string,
	durationSeconds keybase1.DurationSec) (err error) {
	if !filepath.IsAbs(outputFile) {
		return fmt.Errorf("%q is not an absolute path", outputFile)
	}

	close := func(c io.Closer) {
		err := c.Close()
		if err != nil {
			log.Warning("Failed to close %s: %s", outputFile, err)
		}
	}

	name := profiler.Name()

	defer func() {
		if err != nil {
			log.Warning("Failed to do %s profile to %s for %.2f second(s): %s", name, outputFile, durationSeconds, err)
		}
	}()

	f, err := os.Create(outputFile)
	if err != nil {
		return err
	}

	err = profiler.Start(f)
	if err != nil {
		close(f)
		return err
	}

	log.Info("Doing %s profile to %s for %.2f second(s)", name, outputFile, durationSeconds)

	go func() {
		time.Sleep(durationSecToDuration(durationSeconds))
		profiler.Stop()
		close(f)
		delayedLog.Info("%s profile to %s done", name, outputFile)
	}()

	return nil
}

func DoTimedPprofProfileInDir(log libkb.LogUI, delayedLog logger.Logger,
	profiler TimedPprofProfiler, dir string,
	durationSeconds keybase1.DurationSec) (err error) {
	name := profiler.Name()
	maxFileCount := profiler.MaxFileCount()
	files, err := profiler.GetSortedFiles(dir)
	if err != nil {
		log.Warning("Error getting %s profile files in %q: %s",
			name, dir, err)
	} else if len(files)+1 > maxFileCount {
		// Remove old trace files.
		toRemove := files[:len(files)+1-maxFileCount]
		for _, path := range toRemove {
			log.Info("Removing old %s profile file %q", name, path)
			err := os.Remove(path)
			if err != nil {
				log.Warning("Error on os.Remove(%q): %s", path, err)
			}
		}
	}

	outputFile := profiler.MakeFilename(dir, time.Now(), durationSecToDuration(durationSeconds))
	return DoTimedPprofProfile(log, delayedLog, profiler, outputFile, durationSeconds)
}

type CpuPprofProfiler struct{}

func (CpuPprofProfiler) Name() string { return "CPU" }

func (CpuPprofProfiler) MaxFileCount() int {
	return libkb.MaxCPUProfileFileCount
}

func (CpuPprofProfiler) MakeFilename(dir string, start time.Time, duration time.Duration) string {
	return libkb.MakeCPUProfileFilename(dir, start, duration)
}

func (CpuPprofProfiler) GetSortedFiles(dir string) ([]string, error) {
	return libkb.GetSortedCPUProfileFiles(dir)
}

func (CpuPprofProfiler) Start(w io.Writer) error {
	return pprof.StartCPUProfile(w)
}

func (CpuPprofProfiler) Stop() {
	pprof.StopCPUProfile()
}

type TracePprofProfiler struct{}

func (TracePprofProfiler) Name() string { return "trace" }

func (TracePprofProfiler) MaxFileCount() int { return libkb.MaxTraceFileCount }

func (TracePprofProfiler) MakeFilename(dir string, start time.Time, duration time.Duration) string {
	return libkb.MakeTraceFilename(dir, start, duration)
}

func (TracePprofProfiler) GetSortedFiles(dir string) ([]string, error) {
	return libkb.GetSortedTraceFiles(dir)
}

func (TracePprofProfiler) Start(w io.Writer) error {
	return trace.Start(w)
}

func (TracePprofProfiler) Stop() {
	trace.Stop()
}
