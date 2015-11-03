//
//  main.m
//  HelperTool
//
//  Created by Gabriel on 4/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBHelper.h"
#import "KBHelperDefines.h"

int main(int argc, const char *argv[]) {

  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSString *bundleVersion = NSBundle.mainBundle.infoDictionary[@"CFBundleVersion"];
  
  KBLog(@"Starting keybase.Helper: %@-%@", version, bundleVersion);

  xpc_connection_t service = xpc_connection_create_mach_service("keybase.Helper", dispatch_get_main_queue(), XPC_CONNECTION_MACH_SERVICE_LISTENER);
  if (!service) {
    KBLog(@"Failed to create service.");
    return EXIT_FAILURE;
  }

  @try {
    KBHelper *helper = [[KBHelper alloc] init];
    KBLog(@"Listen");
    [helper listen:service];

    KBLog(@"dispatch_main()");
    dispatch_main();
  } @catch(NSException *e) {
    KBLog(@"Exception: %@", e);
  }

  KBLog(@"keybase.Helper exit");
  return 0;
}

