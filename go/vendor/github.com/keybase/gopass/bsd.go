// +build freebsd openbsd netbsd

package gopass

/*
#include <termios.h>
#include <unistd.h>
#include <stdio.h>

int getch(int termDescriptor) {
        char ch;
        struct termios t_old, t_new;

        tcgetattr(termDescriptor, &t_old);
        t_new = t_old;
        t_new.c_lflag &= ~(ICANON | ECHO);
        tcsetattr(termDescriptor, TCSANOW, &t_new);

        ssize_t size = read(termDescriptor, &ch, sizeof(ch));

        tcsetattr(termDescriptor, TCSANOW, &t_old);

        if (size == 0) {
            return -1;
        } else {
            return ch;
        }
}
*/
import "C"

func getch(termDescriptor int) byte {
	return byte(C.getch(C.int(termDescriptor)))
}
