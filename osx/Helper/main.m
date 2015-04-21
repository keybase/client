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

void KBLog(NSString *msg) {
  NSLog(@"%@", msg);
  syslog(LOG_NOTICE, "%s", [msg UTF8String]);
}

int main(int argc, const char *argv[]) {

  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  KBLog([NSString stringWithFormat:@"Starting keybase.Helper: %@", version]);

  xpc_connection_t service = xpc_connection_create_mach_service("keybase.Helper", dispatch_get_main_queue(), XPC_CONNECTION_MACH_SERVICE_LISTENER);
  if (!service) {
    KBLog(@"Failed to create service.");
    return EXIT_FAILURE;
  }

  KBHelper *helper = [[KBHelper alloc] init];
  [helper listen:service];

  KBLog(@"dispatch_main");
  dispatch_main();
}

