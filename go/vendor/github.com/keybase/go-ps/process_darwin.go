// +build darwin

package ps

/*
#include <stdio.h>
#include <errno.h>
#include <libproc.h>
extern int darwinProcesses();
extern void darwinProcessPaths();
*/
import "C"

import (
	"fmt"
	"sync"
)

// This lock is what verifies that C calling back into Go is only
// modifying data once at a time.
var darwinLock sync.Mutex
var darwinProcs []Process
var darwinProcsByPID map[int]*DarwinProcess

// DarwinProcess is process definition for OS X
type DarwinProcess struct {
	pid  int
	ppid int
	name string
	path string
}

// Pid returns process id
func (p *DarwinProcess) Pid() int {
	return p.pid
}

// PPid returns parent process id
func (p *DarwinProcess) PPid() int {
	return p.ppid
}

// Executable returns process executable name
func (p *DarwinProcess) Executable() string {
	return p.name
}

// Path returns path to process executable
func (p *DarwinProcess) Path() (string, error) {
	return p.path, nil
}

//export goDarwinAppendProc
func goDarwinAppendProc(pid C.pid_t, ppid C.pid_t, comm *C.char) {
	proc := &DarwinProcess{
		pid:  int(pid),
		ppid: int(ppid),
		name: C.GoString(comm),
	}
	darwinProcs = append(darwinProcs, proc)
	darwinProcsByPID[proc.pid] = proc
}

//export goDarwinSetPath
func goDarwinSetPath(pid C.pid_t, comm *C.char) {
	if proc, ok := darwinProcsByPID[int(pid)]; ok && proc != nil {
		proc.path = C.GoString(comm)
	}
}

func findProcess(pid int) (Process, error) {
	return findProcessWithFn(processes, pid)
}

func findProcessWithFn(processesFn processesFn, pid int) (Process, error) {
	ps, err := processesFn()
	if err != nil {
		return nil, fmt.Errorf("Error listing processes: %s", err)
	}

	for _, p := range ps {
		if p.Pid() == pid {
			return p, nil
		}
	}

	return nil, nil
}

func processes() ([]Process, error) {
	darwinLock.Lock()
	defer darwinLock.Unlock()
	darwinProcs = make([]Process, 0, 50)
	darwinProcsByPID = make(map[int]*DarwinProcess)

	// To ignore deadcode warnings for exported functions
	_ = goDarwinAppendProc
	_ = goDarwinSetPath

	// TODO: Investigate why darwinProcesses returns error even if process list
	// succeeds
	C.darwinProcesses()
	C.darwinProcessPaths()

	return darwinProcs, nil
}
