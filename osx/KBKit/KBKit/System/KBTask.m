//
//  KBTask.m
//  KBKit
//
//  Created by Gabriel on 11/3/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "KBTask.h"

#import "KBDefines.h"
#include <signal.h>

@interface KBTaskReader : NSObject
@property NSFileHandle *outFh;
@property NSFileHandle *errFh;
@property NSMutableData *outData;
@property NSMutableData *errData;
- (instancetype)initWithTask:(NSTask *)task;
- (void)start;
- (void)flush;
@end

@interface KBTask ()
@property NSTimeInterval timeout;
@property BOOL timedOut;
@property BOOL replied;
@property dispatch_queue_t taskQueue;
@property KBTaskReader *taskReader;
@property KBTaskCompletion completion;
@property NSTask *task;
@property NSString *taskDescription;
@end

@implementation KBTask

+ (void)execute:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(KBTaskCompletion)completion {
  KBTask *task = [[KBTask alloc] initWithCommand:command args:args timeout:timeout completion:completion];
  [task execute];
}

- (instancetype)initWithCommand:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(KBTaskCompletion)completion {
  if ((self = [super init])) {
    self.taskQueue = dispatch_queue_create("taskQueue", NULL);
    self.timeout = timeout;
    self.completion = completion;
    self.taskDescription = NSStringWithFormat(@"%@ %@", command, [args join:@" "]);;

    NSTask *task = [[NSTask alloc] init];
    task.launchPath = command;
    task.arguments = args;
    [task setStandardInput:[NSPipe pipe]];
    self.task = task;
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(taskDidTerminate:) name:NSTaskDidTerminateNotification object:self.task];

    self.taskReader = [[KBTaskReader alloc] initWithTask:self.task];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self name:NSTaskDidTerminateNotification object:self.task];
}

- (void)taskDidTerminate:(NSNotification *)notification {
  GHWeakSelf wself = self;
  dispatch_async(self.taskQueue, ^{
    if (wself.timedOut) {
      DDLogDebug(@"Task termination handler, timed out, skipping");
      return;
    }
    wself.replied = YES;
    DDLogDebug(@"Task dispatch completion");
    dispatch_async(dispatch_get_main_queue(), ^{
      // Ensure we've read to EOF
      [wself.taskReader flush];
      DDLogDebug(@"Task (out): %@", ([[NSString alloc] initWithData:wself.taskReader.outData encoding:NSUTF8StringEncoding]));
      DDLogDebug(@"Task (err): %@", ([[NSString alloc] initWithData:wself.taskReader.errData encoding:NSUTF8StringEncoding]));
      self.completion(nil, wself.taskReader.outData, wself.taskReader.errData);
    });
  });
}

- (void)execute {
  [self.taskReader start];

  GHWeakSelf wself = self;
  if (self.timeout > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, self.timeout * NSEC_PER_SEC), self.taskQueue, ^{
      if (!wself.replied) {
        wself.timedOut = YES;
        DDLogError(@"Task timed out: %@", wself.taskDescription);
        dispatch_async(dispatch_get_main_queue(), ^{
          wself.completion(KBMakeError(KBErrorCodeTimeout, @"Task timed out: %@", wself.taskDescription), nil, nil);
        });

        // Terminate/cleanup task after timeout
        @try {
          [wself.task terminate];
        } @catch(NSException *e) {
          DDLogDebug(@"Task error in terminate after timeout: %@", e);
        }
      }
    });
  }

  @try {
    DDLogDebug(@"Task: %@", self.taskDescription);
    [self.task launch];
    [self.task waitUntilExit];
  } @catch (NSException *e) {
    NSString *errorMessage = NSStringWithFormat(@"%@ (%@)", e.reason, self.taskDescription);
    DDLogError(@"Error running task: %@", errorMessage);
    self.replied = YES;
    self.completion(KBMakeError(KBErrorCodeGeneric, @"%@", errorMessage), nil, nil);
  }
}

+ (void)executeForJSONWithCommand:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, id value))completion {
  KBTask *task = [[KBTask alloc] initWithCommand:command args:args timeout:timeout completion:^(NSError *error, NSData *outData, NSData *errData) {
    if (error) {
      completion(error, nil);
      return;
    }
    if (!outData) {
      completion(KBMakeError(KBErrorCodeGeneric, @"No data for launchd status"), nil);
      return;
    }

    id value = [NSJSONSerialization JSONObjectWithData:outData options:NSJSONReadingMutableContainers error:&error];
    if (error) {
      DDLogError(@"Invalid data: %@", [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
      completion(error, nil);
      return;
    }
    if (!value) {
      completion(KBMakeError(KBErrorCodeGeneric, @"Invalid JSON"), nil);
      return;
    }

    completion(nil, value);
  }];
  [task execute];
}

@end

@implementation KBTaskReader

- (instancetype)initWithTask:(NSTask *)task {
  if ((self = [super init])) {
    NSPipe *outPipe = [NSPipe pipe];
    [task setStandardOutput:outPipe];
    NSPipe *errPipe = [NSPipe pipe];
    [task setStandardError:errPipe];

    self.outFh = [outPipe fileHandleForReading];
    self.outData = [NSMutableData data];
    GHWeakSelf wself = self;
    [[NSNotificationCenter defaultCenter] addObserverForName:NSFileHandleReadToEndOfFileCompletionNotification object:self.outFh queue:nil usingBlock:^(NSNotification *notification) {
      [wself outData:notification];
    }];

    self.errFh = [errPipe fileHandleForReading];
    self.errData = [NSMutableData data];
    [[NSNotificationCenter defaultCenter] addObserverForName:NSFileHandleReadToEndOfFileCompletionNotification object:self.errFh queue:nil usingBlock:^(NSNotification *notification) {
      [wself errData:notification];
    }];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self name:NSFileHandleReadToEndOfFileCompletionNotification object:self.outFh];
  [[NSNotificationCenter defaultCenter] removeObserver:self name:NSFileHandleReadToEndOfFileCompletionNotification object:self.errFh];
}

- (void)start {
  [self.outFh readToEndOfFileInBackgroundAndNotify];
  [self.errFh readToEndOfFileInBackgroundAndNotify];
}

- (void)flush {
  [self flush:self.outFh data:self.outData];
  [self flush:self.errFh data:self.errData];
}

- (void)flush:(NSFileHandle *)fh data:(NSMutableData *)data {
  NSData *readData = [fh readDataToEndOfFile];
  if (readData.length > 0) {
    [data appendData:readData];
  }
}

- (void)outData:(NSNotification *)notification {
  NSData *data = [[notification userInfo] objectForKey:NSFileHandleNotificationDataItem];
  if (data.length > 0) {
    [self.outData appendData:data];
  }
}

- (void)errData:(NSNotification *)notification {
  NSData *data = [[notification userInfo] objectForKey:NSFileHandleNotificationDataItem];
  if (data.length > 0) {
    [self.errData appendData:data];
  }
}

@end