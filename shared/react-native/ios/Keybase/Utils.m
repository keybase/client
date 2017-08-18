//
//  Utils.m
//  Keybase
//
//  Created by Chris Nojima on 8/29/16.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import "Utils.h"

@implementation Utils

// Returns YES if we are currently in a unit test context
+ (BOOL)areWeBeingUnitTested {
  BOOL answer = NO;
  Class testProbeClass;
  testProbeClass = NSClassFromString(@"XCTestProbe");
  if (testProbeClass != Nil) {
    answer = YES;
  }
  return answer;
}

// Returns YES if we are currently being unittested.
+ (BOOL)areWeBeingUnitTestedRightNow {
  BOOL answer = NO;
  Class testProbeClass;
  testProbeClass = NSClassFromString(@"XCTestProbe");
  if (testProbeClass != Nil) {
    SEL selector = NSSelectorFromString(@"isTesting");
    NSMethodSignature *sig = [testProbeClass methodSignatureForSelector:selector];
    NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:sig];
    [invocation setSelector:selector];
    [invocation invokeWithTarget:testProbeClass];
    [invocation getReturnValue:&answer];
  }
  return answer;
}


@end
