#import "NativeLogger.h"
#import <UIKit/UIKit.h>
#import "AppDelegate.h"
#import "CocoaLumberjack.h"

@implementation NativeLogger

static const DDLogLevel ddLogLevel = DDLogLevelDebug;
static const NSString* tagName = @"KBNativeLogger";

RCT_EXPORT_MODULE(KBNativeLogger);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(log,tagsAndLogs:(NSArray*)tagsAndLogs)
{
  for (NSArray * tagAndLog in tagsAndLogs) {
    DDLogInfo(@"%@%@: %@", tagAndLog[0], tagName, tagAndLog[1]);
  }
}

RCT_REMAP_METHOD(dump,
                 tagPrefix:(NSString*)tagPrefix
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    AppDelegate *appDel = (AppDelegate *)[[UIApplication sharedApplication] delegate];
    DDFileLogger *fileLogger = (DDFileLogger *)appDel.fileLogger;
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_LOW, 0), ^{
      NSMutableArray<NSString *> *lines = [[NSMutableArray alloc] init];
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
    });
  });
}

@end
