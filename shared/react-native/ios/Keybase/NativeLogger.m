#import "NativeLogger.h"
#import <UIKit/UIKit.h>
#import "AppDelegate.h"

@import CocoaLumberjack;
@implementation NativeLogger

static const DDLogLevel ddLogLevel = DDLogLevelDebug;
static const NSString* tagName = @"KBNativeLogger";

RCT_EXPORT_MODULE(KBNativeLogger);

RCT_REMAP_METHOD(log,
                 tagPrefix:(NSString*)tagPrefix
                 toLog:(NSString*)toLog)
{
  DDLogInfo(@"%@%@: %@", tagPrefix, tagName, toLog);
}

RCT_REMAP_METHOD(dump,
                 tagPrefix:(NSString*)tagPrefix
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSMutableArray<NSString *> *lines = [[NSMutableArray alloc] init];
  AppDelegate *appDel = (AppDelegate *)[[UIApplication sharedApplication] delegate];
  DDFileLogger *fileLogger = (DDFileLogger *)appDel.fileLogger;
  NSArray<NSString *> *paths = [[fileLogger logFileManager] sortedLogFilePaths];
  for (NSString *path in paths) {
    NSString *fileContents = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:NULL];
    for (NSString *line in [fileContents componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]]) {
      NSRange range = [line rangeOfString:[NSString stringWithFormat:@"%@%@: ", tagPrefix, tagName]];
      if (range.location != NSNotFound) {
        [lines addObject:[line substringFromIndex:range.location + range.length]];
      }
    }
  }
  resolve(lines);
}

@end
