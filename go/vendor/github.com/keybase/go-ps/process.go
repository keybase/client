// Package ps provides an API for finding and listing processes in a
// platform-agnostic way.
//
// NOTE: If you're reading these docs online via GoDocs or some other system,
// you might only see the Unix docs. This project makes heavy use of
// platform-specific implementations. We recommend reading the source if you
// are interested.
package ps

import "fmt"

// Process is the generic interface that is implemented on every platform
// and provides common operations for processes.
type Process interface {
	// Pid is the process ID for this process.
	Pid() int

	// PPid is the parent process ID for this process.
	PPid() int

	// Executable name running this process. This is not a path to the
	// executable.
	Executable() string

	// Path is full path to the executable. The path may be unavailable if the
	// exectuable was deleted from the system while it was still running.
	Path() (string, error)
}

type processesFn func() ([]Process, error)

// Processes returns all processes.
//
// This of course will be a point-in-time snapshot of when this method was
// called. Some operating systems don't provide snapshot capability of the
// process table, in which case the process table returned might contain
// ephemeral entities that happened to be running when this was called.
func Processes() ([]Process, error) {
	return processes()
}

// FindProcess looks up a single process by pid.
// This may require a full process listing depending on the platform, so
// consider using os.FindProcess instead.
// Process will be nil and error will be nil if a matching process is not found.
func FindProcess(pid int) (Process, error) {
	return findProcess(pid)
}

type matchFn func(Process) bool

// findProcessesWithFn finds processes using match function.
// If max is != 0, then we will return that max number of processes.
func findProcessesWithFn(processesFn processesFn, matchFn matchFn, max int) ([]Process, error) {
	processes, err := processesFn()
	if err != nil {
		return nil, fmt.Errorf("Error listing processes: %s", err)
	}
	if processes == nil {
		return nil, nil
	}
	procs := []Process{}
	for _, p := range processes {
		if matchFn(p) {
			procs = append(procs, p)
		}
		if max != 0 && len(procs) >= max {
			break
		}
	}
	return procs, nil
}

// Avoid linting error
var _ = findProcessesWithFn
