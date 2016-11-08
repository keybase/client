//
//  Utils.m
//  Keybase
//
//  Created by Chris Nojima on 8/29/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "Testing.h"

@implementation Testing

// Returns YES if we are currently in a unit test context
+ (BOOL)areWeBeingUnitTested {
  return !!NSClassFromString(@"XCTestProbe");
}

// Returns YES if we are currently being unittested.
+ (BOOL)areWeBeingUnitTestedRightNow {
  BOOL answer = NO;
  Class testProbeClass = NSClassFromString(@"XCTestProbe");
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
