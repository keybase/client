//
//  KBHelperTest.m
//  Keybase
//
//  Created by Gabriel on 11/5/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "KBHelperTest.h"

#import "KBHelper.h"
#import "KBKext.h"
#import "KBLogger.h"

@implementation KBHelperTest

- (void)testKextUnload:(void (^)(NSError *error, id value))completion {
  NSString *kextID = @"com.github.kbfuse.filesystems.kbfuse";
  KBHelper *helper = [[KBHelper alloc] init];
  [helper handleRequestWithMethod:@"kextUnload" params:@[@{@"kextID": kextID}] messageId:@(1) completion:completion];
}

- (void)testUpdateLoaderFileAttributes:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;
  BOOL ok = [KBKext updateLoaderFileAttributes:@"/Library/Filesystems/kbfuse.fs" error:&error];
  completion(error, @(ok));
}

- (void)test:(void (^)(NSError *error, id value))completion {
  //[self testKextUnload:completion];
  [self testUpdateLoaderFileAttributes:completion];
}

+ (int)test {
  KBHelperTest *test = [[KBHelperTest alloc] init];
  [test test:^(NSError *error, id value) {
    KBLog(@"Result: %@, %@", error, value);
    exit(0);
  }];

  dispatch_main();
  return 0;
}

@end
