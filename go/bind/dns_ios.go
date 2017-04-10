// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build ios

package keybase

/*
#cgo LDFLAGS: -lresolv
#include <stdlib.h>
#include <resolv.h>
#include <dns.h>
#include <arpa/inet.h>
#include <ifaddrs.h>
#include <string.h>

typedef struct _dnsRes {
  char** srvs;
  int length;
} dnsRes;

dnsRes ios_getDNSServers() {
  // free()'d in Go below
  res_state res = malloc(sizeof(struct __res_state));
  int result = res_ninit(res);
  dnsRes dnsSrvs;
  dnsSrvs.length = 0;
  if (result == 0 && res->nscount < 1024) {
    union res_9_sockaddr_union *addr_union = malloc(res->nscount * sizeof(union res_9_sockaddr_union));
    res_getservers(res, addr_union, res->nscount);

    dnsSrvs.length = res->nscount;
    dnsSrvs.srvs = (char**) malloc(sizeof(char*)*res->nscount);
    for (int i = 0; i < res->nscount; i++) {
      if (addr_union[i].sin.sin_family == AF_INET) {
        // free()'d in Go below
        char* ip = (char*) malloc(INET_ADDRSTRLEN);
        inet_ntop(AF_INET, &(addr_union[i].sin.sin_addr), ip, INET_ADDRSTRLEN);
        dnsSrvs.srvs[i] = ip;
      } else if (addr_union[i].sin6.sin6_family == AF_INET6) {
        // free()'d in Go below
        char* ip = (char*) malloc(INET6_ADDRSTRLEN);
        inet_ntop(AF_INET6, &(addr_union[i].sin6.sin6_addr), ip, INET6_ADDRSTRLEN);
        dnsSrvs.srvs[i] = ip;
      } else {
        // free()'d in Go below
        dnsSrvs.srvs[i] = strdup("0.0.0.0");
      }
    }
    free(addr_union);
  }
  res_nclose(res);
  free(res);
  return dnsSrvs;
}
*/
import "C"
import "unsafe"

func getDNSServers() (res []string) {
	dnsRes := C.ios_getDNSServers()
	length := dnsRes.length
	if length == 0 {
		return res
	}

	csrvs := dnsRes.srvs
	srvSlice := (*[1024]*C.char)(unsafe.Pointer(csrvs))[:length:length]
	for _, csrv := range srvSlice {
		res = append(res, C.GoString(csrv))
		C.free(unsafe.Pointer(csrv))
	}
	C.free(unsafe.Pointer(csrvs))
	return res
}
