//
//  KBHelperDefines.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelperDefines.h"

#import <syslog.h>

void KBLog(NSString *msg, ...) {
  va_list args;
  va_start(args, msg);

  NSString *string = [[NSString alloc] initWithFormat:msg arguments:args];

  va_end(args);

  NSLog(@"%@", string);
  syslog(LOG_NOTICE, "%s", [string UTF8String]);
}
