package main

import (
	"flag"
	"log"
	"os"
)

var server bool
var port int

func init() {
	flag.BoolVar(&server, "s", false, "server (client by default)")
	flag.IntVar(&port, "p", 8022, "specify a port (8022 by default)")
}

type Command interface {
	Run() error
}

func main() {
	flag.Parse()
	var cmd Command
	if server {
		cmd = &Server{}
	} else {
		cmd = &Client{}
	}
	err := cmd.Run()
	if err != nil {
		log.Printf("Error: %s", err.Error())
		os.Exit(-2)
	} else {
		os.Exit(0)
	}
}
