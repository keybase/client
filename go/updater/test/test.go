// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type flags struct {
	out     string
	outPath string
}

// This is a test executable built and installed prior to test run, which is
// useful for testing some command.go functions.
func main() {
	f := flags{}
	flag.StringVar(&f.out, "out", "", "Output")
	flag.StringVar(&f.outPath, "outPath", "", "Output path")
	flag.Parse()
	var arg = flag.Arg(0)

	switch arg {
	case "noexit":
		noexit()
	case "output":
		output()
	case "echo":
		echo(flag.Arg(1))
	case "writeToFile":
		writeToFile(f.out, f.outPath)
	case "version":
		echo("1.2.3-400+cafebeef")
	case "err":
		log.Fatal("Error")
	case "sleep":
		time.Sleep(10 * time.Second)
	case "/layout":
		if flag.NArg() < 4 {
			log.Fatal("Error in /layout command: requires \"/layout /quiet /log filename\"")
		}
		copyFakeLayout(flag.Arg(3))
	default:
		log.Printf("test")
	}
}

func noexit() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, syscall.SIGTERM)
	go func() {
		<-c
		fmt.Printf("Got SIGTERM, not exiting on purpose")
		// Don't exit on SIGTERM, so we can test timeout with SIGKILL
	}()
	fmt.Printf("Waiting for 10 seconds...")
	time.Sleep(10 * time.Second)
}

func output() {
	fmt.Fprintln(os.Stdout, "stdout output")
	fmt.Fprintln(os.Stderr, "stderr output")
}

func echo(s string) {
	fmt.Fprintln(os.Stdout, s)
}

func writeToFile(s string, path string) {
	err := os.WriteFile(path, []byte(s), 0700)
	if err != nil {
		log.Fatalf("Error writing to file: %s", err)
	}
}

func copyFakeLayout(dst string) {
	// Read all content of src to data
	data, err := os.ReadFile("winlayout.log")
	if err != nil {
		log.Fatalf("Error reading winlayout.log: %s", err)
	}
	// Write data to dst
	err = os.WriteFile(dst, data, 0644)
	if err != nil {
		log.Fatalf("Error writing to %s: %s", dst, err)
	}
}
