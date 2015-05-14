//
//  KBLaunchCtl.h
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <GHKit/GHKit.h>
#import "KBAppDefines.h"
#import "KBLaunchCtl.h"
#import "KBInstallable.h"

@interface KBLaunchService : NSObject <KBInstallable>

@property (readonly) NSString *label;
@property (readonly) NSDictionary *plist;

- (instancetype)initWithName:(NSString *)name label:(NSString *)label bundleVersion:(NSString *)bundleVersion plist:(NSDictionary *)plist;

@end
