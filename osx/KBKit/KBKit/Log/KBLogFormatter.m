//
//  KBLogFormatter.m
//  Keybase
//
//  Created by Gabriel on 4/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLogFormatter.h"
#import "KBLog.h"

@interface KBLogFormatter ()
@property NSDateFormatter *dateFormatter;
@end

@implementation KBLogFormatter

- (id)init {
  if ((self = [super init])) {
    _dateFormatter = [[NSDateFormatter alloc] init];
    [_dateFormatter setFormatterBehavior:NSDateFormatterBehavior10_4];
    [_dateFormatter setDateFormat:@"MM.dd.yyyy HH:mm:ss.SSS"];
  }
  return self;
}

- (NSString *)formatLogMessage:(DDLogMessage *)logMessage {
  NSString *dateAndTime = [_dateFormatter stringFromDate:logMessage.timestamp];
  return [NSString stringWithFormat:@"%@ %@:%@%@ %@", dateAndTime, logMessage.fileName, @(logMessage.line), [KBLogFormatter flagsFromLogMessage:logMessage], logMessage.message];
}

+ (NSString *)flagsFromLogMessage:(DDLogMessage *)logMessage {
  NSMutableArray *flags = [NSMutableArray array];
  if (logMessage.flag & KBLogError) [flags addObject:@"ERROR"];
  if (logMessage.flag & KBLogWarn) [flags addObject:@"WARN"];
  if (logMessage.flag & KBLogInfo) [flags addObject:@"INFO"];
  if (logMessage.flag & KBLogDebug) [flags addObject:@"DEBG"];
  if (logMessage.flag & KBLogVerbose) [flags addObject:@"VERB"];
  if (logMessage.flag & KBLogRPC) [flags addObject:@"RPC"];
  return [NSString stringWithFormat:@"[%@]", [flags componentsJoinedByString:@","]];
}

@end

@implementation KBLogPlainFormatter

- (NSString *)formatLogMessage:(DDLogMessage *)logMessage {
  return logMessage.message;
}

@end


@interface KBLogConsoleFormatter ()
@property NSDateFormatter *dateFormatter;
@end

@implementation KBLogConsoleFormatter

- (id)init {
  if ((self = [super init])) {
    _dateFormatter = [[NSDateFormatter alloc] init];
    [_dateFormatter setFormatterBehavior:NSDateFormatterBehavior10_4];
    [_dateFormatter setDateFormat:@"HH:mm:ss.SSS"];
  }
  return self;
}

- (NSString *)formatLogMessage:(DDLogMessage *)logMessage {
  NSString *time = [_dateFormatter stringFromDate:logMessage.timestamp];
  return [NSString stringWithFormat:@"%@ %@ %@", time, [KBLogFormatter flagsFromLogMessage:logMessage], logMessage.message];
}

@end
