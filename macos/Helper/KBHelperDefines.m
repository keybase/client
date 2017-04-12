//
//  KBHelperDefines.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelperDefines.h"

NSString *KBNSStringWithFormat(NSString *formatString, ...) {
  va_list args;
  va_start(args, formatString);
  NSString *string = [[NSString alloc] initWithFormat:formatString arguments:args];
  va_end(args);
  return string;
}
