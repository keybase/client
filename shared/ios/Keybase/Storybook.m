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

// change me to turn on storybook mode
const BOOL IS_STORYBOOK = false;

@implementation Storybook

#pragma mark - RCTBridgeModule

RCT_EXPORT_MODULE(Storybook);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  return @{@"isStorybook": @(IS_STORYBOOK)};
}

@end
