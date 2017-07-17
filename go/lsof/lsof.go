// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lsof

import (
	"fmt"
	"os/exec"
	"strings"
)

// Process defines an process using an open file. Properties here are strings
// for compatibility with different platforms.
type Process struct {
	PID             string
	Command         string
	UserID          string
	FileDescriptors []FileDescriptor
}

// FileType defines the type of file in use by a process
type FileType string

const (
	FileTypeUnknown FileType = ""
	FileTypeDir     FileType = "DIR"
	FileTypeFile    FileType = "REG"
)

// FileDescriptor defines a file in use by a process
type FileDescriptor struct {
	FD   string
	Type FileType
	Name string
}

// ExecError is an error running lsof
type ExecError struct {
	command string
	args    []string
	output  string
	err     error
}

func (e ExecError) Error() string {
	return fmt.Sprintf("Error running %s %s: %s (%s)", e.command, e.args, e.err, e.output)
}

// MountPoint returns processes using the mountpoint "lsof /dir"
func MountPoint(dir string) ([]Process, error) {
	// TODO: Fix lsof to not return error on exit status 1 since it isn't
	// really any error, only an indication that there was no use of the
	// mount.
	return run([]string{"-F", "pcuftn", dir})
}

func fileTypeFromString(s string) FileType {
	switch s {
	case "DIR":
		return FileTypeDir
	case "REG":
		return FileTypeFile
	default:
		return FileTypeUnknown
	}
}

func (p *Process) fillField(s string) error {
	if s == "" {
		return fmt.Errorf("Empty field")
	}
	// See Output for Other Programs at http://linux.die.net/man/8/lsof
	key := s[0]
	value := s[1:]
	switch key {
	case 'p':
		p.PID = value
	case 'c':
		p.Command = value
	case 'u':
		p.UserID = value
	default:
		// Skip unhandled field
	}
	return nil
}

func (f *FileDescriptor) fillField(s string) error {
	// See Output for Other Programs at http://linux.die.net/man/8/lsof
	key := s[0]
	value := s[1:]
	switch key {
	case 't':
		f.Type = fileTypeFromString(value)
	case 'f':
		f.FD = value
	case 'n':
		f.Name = value
	default:
		// Skip unhandled field
	}

	return nil
}

func (p *Process) parseFileLines(lines []string) error {
	file := FileDescriptor{}
	for _, line := range lines {
		if strings.HasPrefix(line, "f") && file.FD != "" {
			// New file
			p.FileDescriptors = append(p.FileDescriptors, file)
			file = FileDescriptor{}
		}
		err := file.fillField(line)
		if err != nil {
			return err
		}
	}
	if file.FD != "" {
		p.FileDescriptors = append(p.FileDescriptors, file)
	}
	return nil
}

func parseProcessLines(lines []string) (Process, error) {
	p := Process{}
	for index, line := range lines {
		if strings.HasPrefix(line, "f") {
			err := p.parseFileLines(lines[index:])
			if err != nil {
				return p, err
			}
			break
		} else {
			p.fillField(line)
		}
	}
	return p, nil
}

func parseAppendProcessLines(processes []Process, linesChunk []string) ([]Process, []string, error) {
	if len(linesChunk) == 0 {
		return processes, linesChunk, nil
	}
	process, err := parseProcessLines(linesChunk)
	if err != nil {
		return processes, linesChunk, err
	}
	processesAfter := append(processes, process)
	linesChunkAfter := []string{}
	return processesAfter, linesChunkAfter, nil
}

func parse(s string) ([]Process, error) {
	lines := strings.Split(s, "\n")
	linesChunk := []string{}
	processes := []Process{}
	var err error
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		// End of process, let's parse those lines
		if strings.HasPrefix(line, "p") && len(linesChunk) > 0 {
			processes, linesChunk, err = parseAppendProcessLines(processes, linesChunk)
			if err != nil {
				return nil, err
			}
		}
		linesChunk = append(linesChunk, line)
	}
	processes, _, err = parseAppendProcessLines(processes, linesChunk)
	if err != nil {
		return nil, err
	}
	return processes, nil
}

func run(args []string) ([]Process, error) {
	command := "/usr/sbin/lsof"
	args = append([]string{"-w"}, args...)
	output, err := exec.Command(command, args...).Output()
	if err != nil {
		return nil, ExecError{command: command, args: args, output: string(output), err: err}
	}
	return parse(string(output))
}
