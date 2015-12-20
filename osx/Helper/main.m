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

#define TEST 0

#if TEST
#import "KBHelperTest.h"
#endif

int main(int argc, const char *argv[]) {

#if TEST
  if (argc == 2) {
    NSString *action = [NSString stringWithCString:argv[1] encoding:NSASCIIStringEncoding];
    if ([action isEqualToString:@"test"]) {
      return [KBHelperTest test];
    }
  }
#endif

  return [KBHelper run];
}

