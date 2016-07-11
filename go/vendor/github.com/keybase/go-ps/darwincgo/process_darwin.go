// +build darwin

package darwincgo

/*
#include <stdio.h>
#include <errno.h>
#include <libproc.h>
extern int darwinProcesses();
extern void darwinProcessPaths();
*/
import "C"

import (
	"path/filepath"
	"sync"
)

// This lock is what verifies that C calling back into Go is only
// modifying data once at a time.
var darwinLock sync.Mutex
var darwinProcsByPID map[int]*DarwinProcess

// DarwinProcess is process definition for OS X
type DarwinProcess struct {
	pid  int
	ppid int
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
	path, _ := p.Path()
	return filepath.Base(path)
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
	}
	darwinProcsByPID[proc.pid] = proc
}

//export goDarwinSetPath
func goDarwinSetPath(pid C.pid_t, comm *C.char) {
	if proc, ok := darwinProcsByPID[int(pid)]; ok && proc != nil {
		proc.path = C.GoString(comm)
	}
}

// ProcessMap returns a map of processes for the main library package.
func ProcessMap() (map[int]*DarwinProcess, error) {
	darwinLock.Lock()
	defer darwinLock.Unlock()
	darwinProcsByPID = make(map[int]*DarwinProcess)

	// To ignore deadcode warnings for exported functions
	_ = goDarwinAppendProc
	_ = goDarwinSetPath

	// TODO: Investigate why darwinProcesses returns error even if process list
	// succeeds
	C.darwinProcesses()
	C.darwinProcessPaths()

	return darwinProcsByPID, nil
}
