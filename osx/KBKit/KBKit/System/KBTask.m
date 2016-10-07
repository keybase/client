//
//  KBTask.m
//  KBKit
//
//  Created by Gabriel on 11/3/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "KBTask.h"

#import "KBDefines.h"

@interface KBTaskReader : NSObject
@property NSFileHandle *outFh;
@property NSFileHandle *errFh;
@property NSMutableData *outData;
@property NSMutableData *errData;
@property BOOL outEOF;
@property BOOL errEOF;
@property KBCompletion completion;
- (instancetype)initWithTask:(NSTask *)task completion:(KBCompletion)completion;
- (void)start;
@end

@interface KBTask ()
@property NSTimeInterval timeout;
@property BOOL completed;
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
    self.taskReader = [[KBTaskReader alloc] initWithTask:self.task completion:^(NSError *error) {
      DDLogDebug(@"Task EOF");
      // Task is done when out/err EOF
      [self finished];
    }];
  }
  return self;
}

- (void)finished {
  dispatch_async(self.taskQueue, ^{
    if (self.completed) {
      DDLogDebug(@"Already completed, skipping (completion)");
      return;
    }
    self.completed = YES;
    DDLogDebug(@"Completed");
    dispatch_async(dispatch_get_main_queue(), ^{
      DDLogDebug(@"Task (err): %@", ([[NSString alloc] initWithData:self.taskReader.errData encoding:NSUTF8StringEncoding]));
      DDLogDebug(@"Task (out): %@", ([[NSString alloc] initWithData:self.taskReader.outData encoding:NSUTF8StringEncoding]));
      self.completion(nil, self.taskReader.outData, self.taskReader.errData);
    });
  });
}

- (void)errored:(NSError *)error after:(dispatch_block_t)after {
  dispatch_async(self.taskQueue, ^{
    if (self.completed) {
      //DDLogDebug(@"Already completed, skipping (error)");
      return;
    }
    DDLogError(@"Task error: %@", error);
    self.completed = YES;
    dispatch_async(dispatch_get_main_queue(), ^{
      self.completion(error, nil, nil);
    });

    if (after) {
      after();
    }
  });
}

- (void)execute {
  [self.taskReader start];

  if (self.timeout > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, self.timeout * NSEC_PER_SEC), self.taskQueue, ^{
      [self errored:KBMakeError(KBErrorCodeTimeout, @"Task timed out: %@", self.taskDescription) after:^{
        // Terminate/cleanup task after timeout
        @try {
          [self.task terminate];
        } @catch(NSException *e) {
          DDLogDebug(@"Task error in terminate after timeout: %@", e);
        }
      }];
    });
  }

  @try {
    DDLogDebug(@"Task: %@", self.taskDescription);
    [self.task launch];
    [self.task waitUntilExit];
  } @catch (NSException *e) {
    NSString *errorMessage = NSStringWithFormat(@"%@ (%@)", e.reason, self.taskDescription);
    DDLogError(@"Error running task: %@", errorMessage);
    [self errored:KBMakeError(KBErrorCodeGeneric, @"%@", errorMessage) after:nil];
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

- (instancetype)initWithTask:(NSTask *)task completion:(KBCompletion)completion {
  if ((self = [super init])) {
    self.completion = completion;

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

- (void)outData:(NSNotification *)notification {
  NSData *data = [[notification userInfo] objectForKey:NSFileHandleNotificationDataItem];
  if (data.length > 0) {
    [self.outData appendData:data];
  }
  self.outEOF = YES;
  [self checkCompletion];
}

- (void)errData:(NSNotification *)notification {
  NSData *data = [[notification userInfo] objectForKey:NSFileHandleNotificationDataItem];
  if (data.length > 0) {
    [self.errData appendData:data];
  }
  self.errEOF = YES;
  [self checkCompletion];
}

- (void)checkCompletion {
  if (self.outEOF && self.errEOF) self.completion(nil);
}

@end
