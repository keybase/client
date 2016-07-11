// +build darwin

#include <errno.h>
#include <stdlib.h>
#include <stdio.h>
#include <strings.h>
#include <libproc.h>
#include <unistd.h>
#include <sys/sysctl.h>

// This is declared in process_darwin.go
extern void goDarwinAppendProc(pid_t, pid_t, char *);
extern void goDarwinSetPath(pid_t, char *);

// darwinProcesses loads the process table and calls the exported Go function to
// insert the data back into the Go space.
//
// This function is implemented in C because while it would technically
// be possible to do this all in Go, I didn't want to go spelunking through
// header files to get all the structures properly. It is much easier to just
// call it in C and be done with it.
int darwinProcesses() {
    int err = 0;
    int i = 0;
    static const int name[] = { CTL_KERN, KERN_PROC, KERN_PROC_ALL, 0 };
    size_t length = 0;
    struct kinfo_proc *result = NULL;
    size_t resultCount = 0;

    // Get the length first
    err = sysctl((int*)name, (sizeof(name) / sizeof(*name)) - 1,
            NULL, &length, NULL, 0);
    if (err != 0) {
        goto ERREXIT;
    }

    // Allocate the appropriate sized buffer to read the process list
    result = malloc(length);

    // Call sysctl again with our buffer to fill it with the process list
    err = sysctl((int*)name, (sizeof(name) / sizeof(*name)) - 1,
            result, &length,
            NULL, 0);
    if (err != 0) {
        goto ERREXIT;
    }

    resultCount = length / sizeof(struct kinfo_proc);
    for (i = 0; i < resultCount; i++) {
        struct kinfo_proc *single = &result[i];
        goDarwinAppendProc(
                single->kp_proc.p_pid,
                single->kp_eproc.e_ppid,
                single->kp_proc.p_comm);
    }

ERREXIT:
    if (result != NULL) {
        free(result);
    }

    if (err != 0) {
        return errno;
    }
    return 0;
}

// darwinProcessPaths looks up paths for process pids
void darwinProcessPaths() {
  int pid_buf_size = proc_listpids(PROC_ALL_PIDS, 0, NULL, 0);
  int pid_count = pid_buf_size / sizeof(pid_t);

  pid_t* pids = malloc(pid_buf_size);
  bzero(pids, pid_buf_size);

  proc_listpids(PROC_ALL_PIDS, 0, pids, pid_buf_size);
  char path_buffer[PROC_PIDPATHINFO_MAXSIZE];

  for (int i=0; i < pid_count; i++) {
    if (pids[i] == 0) break;
    bzero(path_buffer, PROC_PIDPATHINFO_MAXSIZE);
    if (proc_pidpath(pids[i], path_buffer, sizeof(path_buffer)) > 0) {
      goDarwinSetPath(pids[i], path_buffer);
    }
  }
  free(pids);
}
