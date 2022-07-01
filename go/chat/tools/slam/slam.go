package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func getUsernames(allNames string) []string {
	return strings.Split(allNames, ",")
}

func getConvs(usernames []string) (res []string) {
	if len(usernames) == 0 {
		return []string{""}
	}
	subRes := getConvs(usernames[1:])
	for _, r := range subRes {
		if len(r) > 0 {
			res = append(res, r)
			res = append(res, usernames[0]+","+r)
		} else {
			res = append(res, usernames[0])
		}
	}
	return res
}

func main() {
	flag.Parse()
	args := flag.Args()
	if len(args) != 2 {
		fmt.Printf("must supply a set of users\n")
		os.Exit(3)
	}
	kbcommand := args[0]
	usernames := getUsernames(args[1])
	fmt.Printf("forming convs from: %v\n", usernames)
	convs := getConvs(usernames)
	for _, c := range convs {
		fmt.Printf("executing: %s chat send %s hi\n", kbcommand, c)
		cmd := exec.Command(kbcommand, "chat", "send", c, "hi")
		if err := cmd.Run(); err != nil {
			fmt.Printf("error: %s\n", err)
		}
	}
}
