// +build windows

package main

import (
	"bufio"
	"flag"
	"fmt"
	"github.com/keybase/npipe"
	"net"
)

// Use Dial to connect to a server and read messages from it.
func DoDial(name string) {
	conn, err := npipe.Dial(name)
	if err != nil {
		fmt.Printf("error %s\n", err.Error())
		return
	}
	if _, err := fmt.Fprintln(conn, "Hi server!"); err != nil {
		fmt.Printf("error %s\n", err.Error())
	}
	r := bufio.NewReader(conn)
	msg, err := r.ReadString('\n')
	if err != nil {
		fmt.Printf("error %s\n", err.Error())
	}
	fmt.Println(msg)
}

// Use Listen to start a server, and accept connections with Accept().
func DoListen(name string) {
	ln, err := npipe.Listen(name)
	if err != nil {
		fmt.Printf("error %s\n", err.Error())
		return
	}

	for {
		conn, err := ln.Accept()
		if err != nil {
			// handle error
			fmt.Printf("error %s\n", err.Error())
			continue
		}

		// handle connection like any other net.Conn
		go func(conn net.Conn) {
			r := bufio.NewReader(conn)
			msg, err := r.ReadString('\n')
			if err != nil {
				fmt.Printf("error %s\n", err.Error())
				return
			}
			fmt.Println(msg)
		}(conn)
	}
}

func main() {
	dial := flag.Bool("d", false, "dial")
	flag.Parse()
	name := "\\\\.\\pipe\\kbservice\\Users\\Steve\\AppData\\Local\\Keybase\\keybased.sock"
	if flag.NArg() > 0 {
		name = flag.Args()[0]
	}

	
	if *dial {
		fmt.Printf("dialing pipe name %s\n", name)
		DoDial(name)
	} else {
		fmt.Printf("listening on pipe name %s\n", name)
		DoListen(name)
	}
}