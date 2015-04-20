//
//  main.m
//  HelperTool
//
//  Created by Gabriel on 4/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBHelper.h"
#include <syslog.h>

//static void __XPC_Service_Handler(xpc_connection_t service) {
//  KBHelper *helper = [[KBHelper alloc] init];
//  [helper listen:service];
//}

int main(int argc, const char *argv[]) {
  //xpc_main(__XPC_Service_Handler);

  xpc_connection_t service = xpc_connection_create_mach_service("keybase.Helper", dispatch_get_main_queue(), XPC_CONNECTION_MACH_SERVICE_LISTENER);
  if (!service) {
    syslog(LOG_NOTICE, "Failed to create service.");
    return EXIT_FAILURE;
  }

  KBHelper *helper = [[KBHelper alloc] init];
  [helper listen:service];

  dispatch_main();
}

