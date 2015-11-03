//
//  KBTask.m
//  KBKit
//
//  Created by Gabriel on 11/3/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "KBTask.h"

#import "KBDefines.h"

@implementation KBTask

+ (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSData *outData, NSData *errData))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  NSPipe *outPipe = [NSPipe pipe];
  [task setStandardOutput:outPipe];
  NSPipe *errPipe = [NSPipe pipe];
  [task setStandardError:errPipe];
  task.terminationHandler = ^(NSTask *t) {
    //DDLogDebug(@"Task: \"%@ %@\" (%@)", command, [args componentsJoinedByString:@" "], @(t.terminationStatus));
    NSFileHandle *outRead = [outPipe fileHandleForReading];
    NSData *outData = [outRead readDataToEndOfFile];
    NSFileHandle *errRead = [errPipe fileHandleForReading];
    NSData *errData = [errRead readDataToEndOfFile];
    dispatch_async(dispatch_get_main_queue(), ^{
      // TODO Check termination status and complete with error if > 0

      DDLogDebug(@"Task (out): %@", [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
      DDLogDebug(@"Task (err): %@", [[NSString alloc] initWithData:errData encoding:NSUTF8StringEncoding]);

      completion(nil, outData, errData);
    });
  };

  @try {
    DDLogDebug(@"Task: %@ %@", command, [args componentsJoinedByString:@" "]);
    [task launch];
  } @catch (NSException *e) {
    completion(KBMakeError(-1, @"%@ (%@ %@)", e.reason, command, args), nil, nil);
  }
}

@end
