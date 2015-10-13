// +build windows

package miniline

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// ReadLine returns a line of user input (terminated by a newline or or ^D)
// read from stdin.
// Note that on Windows, Ctrl-C will end the process from another thread.
func ReadLine(prompt string) (line string, err error) {

	fmt.Print(prompt)

	in := bufio.NewReader(os.Stdin)

	line, err = in.ReadString('\n')
	if err != nil {
		err = ErrInterrupted
	} else if len(line) > 0 {
		// need to take the end of line back off
		// using scanner didn't register ctrl-c properly
		line = strings.TrimRight(line, "\n\r")
	}
	return

}
