// +build openbsd

package ps

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"syscall"
	"unsafe"
)

// copied from sys/sysctl.h
const (
	CTL_KERN       = 1
	KERN_PROC      = 66
	KERN_PROC_PID  = 1
	KERN_PROC_ARGS = 55
	KERN_PROC_ARGV = 1
	KERN_PROC_ALL  = 0
)

/* Generated via cgo:

$ cat /tmp/gen_defs.go
// +build ignore
package ps
// #include <sys/types.h>
// #include <sys/sysctl.h>
import "C"

type Kinfo_proc C.struct_kinfo_proc

$ go tool cgo -godefs temp.go

*/

type Kinfo_proc struct {
	Ki_forw       uint64
	Ki_back       uint64
	Ki_paddr      uint64
	Ki_addr       uint64
	Ki_fd         uint64
	Ki_stats      uint64
	Ki_limit      uint64
	Ki_vmspace    uint64
	Ki_sigacts    uint64
	Ki_sess       uint64
	Ki_tsess      uint64
	Ki_ru         uint64
	Ki_eflag      int32
	Ki_exitsig    int32
	Ki_flag       int32
	Ki_pid        int32
	Ki_ppid       int32
	Ki_sid        int32
	Ki_x_pgid     int32
	Ki_tpgid      int32
	Ki_uid        uint32
	Ki_ruid       uint32
	Ki_gid        uint32
	Ki_rgid       uint32
	Ki_groups     [16]uint32
	Ki_ngroups    int16
	Ki_jobc       int16
	Ki_tdev       uint32
	Ki_estcpu     uint32
	Ki_rtime_sec  uint32
	Ki_rtime_usec uint32
	Ki_cpticks    int32
	Ki_pctcpu     uint32
	Ki_swtime     uint32
	Ki_slptime    uint32
	Ki_schedflags int32
	Ki_uticks     uint64
	Ki_sticks     uint64
	Ki_iticks     uint64
	Ki_tracep     uint64
	Ki_traceflag  int32
	Ki_holdcnt    int32
	Ki_siglist    int32
	Ki_sigmask    uint32
	Ki_sigignore  uint32
	Ki_sigcatch   uint32
	Ki_stat       int8
	Ki_priority   uint8
	Ki_usrpri     uint8
	Ki_nice       uint8
	Ki_xstat      uint16
	Ki_acflag     uint16
	//Ki_comm		[24]int8
	Ki_comm         [20]byte
	Ki_wmesg        [8]int8
	Ki_wchan        uint64
	Ki_login        [32]int8
	Ki_vm_rssize    int32
	Ki_vm_tsize     int32
	Ki_vm_dsize     int32
	Ki_vm_ssize     int32
	Ki_uvalid       int64
	Ki_ustart_sec   uint64
	Ki_ustart_usec  uint32
	Ki_uutime_sec   uint32
	Ki_uutime_usec  uint32
	Ki_ustime_sec   uint32
	Ki_ustime_usec  uint32
	Ki_pad_cgo_0    [4]byte
	Ki_uru_maxrss   uint64
	Ki_uru_ixrss    uint64
	Ki_uru_idrss    uint64
	Ki_uru_isrss    uint64
	Ki_uru_minflt   uint64
	Ki_uru_majflt   uint64
	Ki_uru_nswap    uint64
	Ki_uru_inblock  uint64
	Ki_uru_oublock  uint64
	Ki_uru_msgsnd   uint64
	Ki_uru_msgrcv   uint64
	Ki_uru_nsignals uint64
	Ki_uru_nvcsw    uint64
	Ki_uru_nivcsw   uint64
	Ki_uctime_sec   uint32
	Ki_uctime_usec  uint32
	Ki_psflags      int32
	Ki_spare        int32
	Ki_svuid        uint32
	Ki_svgid        uint32
	Ki_emul         [8]int8
	Ki_rlim_rss_cur uint64
	Ki_cpuid        uint64
	Ki_vm_map_size  uint64
	Ki_tid          int32
	Ki_rtableid     uint32
}

var proc_k_size = unsafe.Sizeof(Kinfo_proc{})

// UnixProcess is an implementation of Process that contains Unix-specific
// fields and information.
type UnixProcess struct {
	pid   int
	ppid  int
	state rune
	pgrp  int
	sid   int

	binary string
}

// Pid returns process id
func (p *UnixProcess) Pid() int {
	return p.pid
}

// PPid returns parent process id
func (p *UnixProcess) PPid() int {
	return p.ppid
}

// Executable returns process executable name
func (p *UnixProcess) Executable() string {
	return p.binary
}

// Path returns path to process executable
func (p *UnixProcess) Path() (string, error) {
	// On OpenBSD we don't have the actual path of a binary, the next
	// best thing we can do is walk $PATH to hopefully find the binary.
	// More info here: https://github.com/kardianos/osext/commit/b4814f465fb1f92d46e37f7ef84d732ece7c3e3a
	return "", fmt.Errorf("Unsupported")
}

// Refresh reloads all the data associated with this process.
func (p *UnixProcess) Refresh() error {
	mib := []int32{CTL_KERN, KERN_PROC, KERN_PROC_PID, int32(p.pid), int32(proc_k_size), 1}

	buf, length, err := call_syscall(mib)
	if err != nil {
		return err
	}
	if length != uint64(proc_k_size) {
		return err
	}

	k, err := parse_kinfo_proc(buf)
	if err != nil {
		return err
	}

	p.ppid, p.pgrp, p.sid, p.binary = copy_params(&k)
	return nil
}

func copy_params(k *Kinfo_proc) (int, int, int, string) {
	n := -1
	for i, b := range k.Ki_comm {
		if b == 0 {
			break
		}
		n = i + 1
	}
	comm := string(k.Ki_comm[:n])

	return int(k.Ki_ppid), int(k.Ki_x_pgid), int(k.Ki_sid), comm
}

func findProcess(pid int) (Process, error) {
	mib := []int32{CTL_KERN, KERN_PROC, KERN_PROC_PID, int32(pid), int32(proc_k_size), 1}

	_, _, err := call_syscall(mib)
	if err != nil {
		return nil, err
	}

	return newUnixProcess(pid)
}

func processes() ([]Process, error) {
	results := make([]Process, 0, 50)

	mib := []int32{CTL_KERN, KERN_PROC, KERN_PROC_ALL, 0, int32(proc_k_size), 400}
	buf, length, err := call_syscall(mib)
	if err != nil {
		return results, err
	}

	// get kinfo_proc size
	procinfo_len := int(proc_k_size)
	count := int(length / uint64(proc_k_size))

	// parse buf to procs
	for i := 0; i < count; i++ {
		b := buf[i*procinfo_len : i*procinfo_len+procinfo_len]
		k, err := parse_kinfo_proc(b)
		if err != nil {
			continue
		}
		p, err := newUnixProcess(int(k.Ki_pid))
		if err != nil {
			continue
		}
		p.ppid, p.pgrp, p.sid, p.binary = copy_params(&k)

		results = append(results, p)
	}

	return results, nil
}

func parse_kinfo_proc(buf []byte) (Kinfo_proc, error) {
	var k Kinfo_proc
	br := bytes.NewReader(buf)
	err := binary.Read(br, binary.LittleEndian, &k)
	if err != nil {
		return k, err
	}

	return k, nil
}

func call_syscall(mib []int32) ([]byte, uint64, error) {
	miblen := uint64(len(mib))

	// get required buffer size
	length := uint64(0)
	_, _, err := syscall.RawSyscall6(
		syscall.SYS___SYSCTL,
		uintptr(unsafe.Pointer(&mib[0])),
		uintptr(miblen),
		0,
		uintptr(unsafe.Pointer(&length)),
		0,
		0)
	if err != 0 {
		b := make([]byte, 0)
		return b, length, err
	}
	if length == 0 {
		b := make([]byte, 0)
		return b, length, err
	}
	// get proc info itself
	buf := make([]byte, length)
	_, _, err = syscall.RawSyscall6(
		syscall.SYS___SYSCTL,
		uintptr(unsafe.Pointer(&mib[0])),
		uintptr(miblen),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&length)),
		0,
		0)
	if err != 0 {
		return buf, length, err
	}

	return buf, length, nil
}

func newUnixProcess(pid int) (*UnixProcess, error) {
	p := &UnixProcess{pid: pid}
	return p, p.Refresh()
}
