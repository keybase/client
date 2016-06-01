// +build windows

package ps

import (
	"fmt"
	"syscall"
	"unsafe"
)

// Windows API functions
var (
	modKernel32                  = syscall.NewLazyDLL("kernel32.dll")
	procCloseHandle              = modKernel32.NewProc("CloseHandle")
	procCreateToolhelp32Snapshot = modKernel32.NewProc("CreateToolhelp32Snapshot")
	procProcess32First           = modKernel32.NewProc("Process32FirstW")
	procProcess32Next            = modKernel32.NewProc("Process32NextW")
	procModule32First            = modKernel32.NewProc("Module32FirstW")
	procModule32Next             = modKernel32.NewProc("Module32NextW")
)

// Some constants from the Windows API
const (
	ERROR_NO_MORE_FILES = 0x12
	MAX_PATH            = 260
	MAX_MODULE_NAME32   = 255
)

type PROCESSENTRY32 struct {
	Size              uint32
	CntUsage          uint32
	ProcessID         uint32
	DefaultHeapID     uintptr
	ModuleID          uint32
	CntThreads        uint32
	ParentProcessID   uint32
	PriorityClassBase int32
	Flags             uint32
	ExeFile           [MAX_PATH]uint16
}

// WindowsProcess is an implementation of Process for Windows.
type WindowsProcess struct {
	pid  int
	ppid int
	exe  string
}

// Pid returns process id
func (p *WindowsProcess) Pid() int {
	return p.pid
}

// PPid returns parent process id
func (p *WindowsProcess) PPid() int {
	return p.ppid
}

// Executable returns process executable name
func (p *WindowsProcess) Executable() string {
	return p.exe
}

// Path returns path to process executable
func (p *WindowsProcess) Path() (string, error) {
	processModules, err := modules(p.pid)
	if err != nil {
		return "", err
	}
	if len(processModules) == 0 {
		return "", fmt.Errorf("No modules found for process")
	}
	return processModules[0].path, nil
}

func ptrToString(c []uint16) string {
	i := 0
	for {
		if c[i] == 0 {
			return syscall.UTF16ToString(c[:i])
		}
		i++
	}
}

func newWindowsProcess(e *PROCESSENTRY32) *WindowsProcess {
	return &WindowsProcess{
		pid:  int(e.ProcessID),
		ppid: int(e.ParentProcessID),
		exe:  ptrToString(e.ExeFile[:]),
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
	handle, _, _ := procCreateToolhelp32Snapshot.Call(
		0x00000002,
		0)
	if handle < 0 {
		return nil, syscall.GetLastError()
	}
	defer procCloseHandle.Call(handle)

	var entry PROCESSENTRY32
	entry.Size = uint32(unsafe.Sizeof(entry))
	ret, _, _ := procProcess32First.Call(handle, uintptr(unsafe.Pointer(&entry)))
	if ret == 0 {
		return nil, fmt.Errorf("Error retrieving process info.")
	}

	results := make([]Process, 0, 50)
	for {
		results = append(results, newWindowsProcess(&entry))

		ret, _, _ := procProcess32Next.Call(handle, uintptr(unsafe.Pointer(&entry)))
		if ret == 0 {
			break
		}
	}

	return results, nil
}

// MODULEENTRY32 is the Windows API structure that contains a modules's
// information.
type MODULEENTRY32 struct {
	Size         uint32
	ModuleID     uint32
	ProcessID    uint32
	GlblcntUsage uint32
	ProccntUsage uint32
	ModBaseAddr  *uint8
	ModBaseSize  uint32
	HModule      uintptr
	SzModule     [MAX_MODULE_NAME32 + 1]uint16
	SzExePath    [MAX_PATH]uint16
}

type windowsModule struct {
	name string
	path string
}

func newWindowsModule(e *MODULEENTRY32) windowsModule {
	return windowsModule{
		name: ptrToString(e.SzModule[:]),
		path: ptrToString(e.SzExePath[:]),
	}
}

func modules(pid int) ([]windowsModule, error) {
	handle, _, _ := procCreateToolhelp32Snapshot.Call(
		0x00000008, // TH32CS_SNAPMODULE
		uintptr(uint32(pid)))
	if handle < 0 {
		return nil, syscall.GetLastError()
	}
	defer procCloseHandle.Call(handle)

	var entry MODULEENTRY32
	entry.Size = uint32(unsafe.Sizeof(entry))
	ret, _, _ := procModule32First.Call(handle, uintptr(unsafe.Pointer(&entry)))
	if ret == 0 {
		return nil, fmt.Errorf("Error retrieving module info")
	}

	results := make([]windowsModule, 0, 50)
	for {
		results = append(results, newWindowsModule(&entry))

		ret, _, _ := procModule32Next.Call(handle, uintptr(unsafe.Pointer(&entry)))
		if ret == 0 {
			break
		}
	}

	return results, nil
}
