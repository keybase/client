//
//  KBHelperTest.m
//  Keybase
//
//  Created by Gabriel on 11/5/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "KBHelperTest.h"

#import "KBHelper.h"

@implementation KBHelperTest

- (void)testKextUnload:(void (^)(NSError *error, id value))completion {
  NSString *kextID = @"com.github.kbfuse.filesystems.kbfuse";
  KBHelper *helper = [[KBHelper alloc] init];
  [helper handleRequestWithMethod:@"kext_unload" params:@[@{@"kextID": kextID}] messageId:@(1) completion:completion];
}

- (void)test:(void (^)(NSError *error, id value))completion {
  [self testKextUnload:completion];
}

+ (int)test {
  KBHelperTest *test = [[KBHelperTest alloc] init];
  [test testKextUnload:^(NSError *error, id value) {
    KBLog(@"Result: %@, %@", error, value);
    exit(0);
  }];

  dispatch_main();
  return 0;
}

@end
