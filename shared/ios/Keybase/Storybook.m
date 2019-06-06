//
//  Storybook.m
//  Keybase
//
//  Created by Daniel Ayoub on 1/3/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "Storybook.h"
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@implementation Storybook

#pragma mark - RCTBridgeModule

RCT_EXPORT_MODULE(Storybook);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  // Set this to true to enable storybook mode
  return @{@"isStorybook": @false};
}

@end
