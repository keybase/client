//  Keybase
//
//  Created by Chris Nojima on 8/25/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ObjcTest.h"
#import <UIKit/UIKit.h>
#import "RCTEventDispatcher.h"

//#define FORCE_MAIN_QUEUE

@interface ObjcTest()
@property NSInteger count;
@end

@implementation ObjcTest

// required by reactnative
@synthesize bridge = _bridge;

RCT_EXPORT_MODULE();

-(id) init {
  if(self = [super init]) {
    self.count = 0;

    [NSTimer scheduledTimerWithTimeInterval:1 target:self selector:@selector(onTimer) userInfo:nil repeats:YES];
  }

  return self;
}

#pragma mark - Send event
-(void) onTimer {
    [self.bridge.eventDispatcher sendAppEventWithName:@"EventName"
                                                 body:@{@"payload": [NSString stringWithFormat:@"%@", @(self.count++)]}];
}

#pragma mark - Exposed method

RCT_EXPORT_METHOD(exampleWith:(NSString *)prefix withCallback:(RCTResponseSenderBlock)callback)
{
#ifdef FORCE_MAIN_QUEUE
  UIView * view = [[UIView alloc] initWithFrame:CGRectMake(10, 10, 30, 30)];
  view.layer.backgroundColor = [UIColor redColor].CGColor;

  [[[[UIApplication sharedApplication] delegate] window] addSubview:view];

  callback(@[[prefix stringByAppendingString:@" from ObjC (main thread)"]]);
#else 
  // Note you can trampoline to main queue using dispatch_async if you want
  callback(@[[prefix stringByAppendingString:@" from ObjC (background thread)"]]);
#endif
}

#ifdef FORCE_MAIN_QUEUE
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}
#endif

#pragma mark - Exposed Constants

- (NSDictionary *)constantsToExport
{
  return @{ @"language": @"English" };
}

@end
