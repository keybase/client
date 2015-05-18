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
#import "KBComponent.h"

@interface KBLaunchService : KBComponent <KBComponent>

@property (readonly) NSString *label;
@property (readonly) NSDictionary *plist;
@property (readonly) NSString *versionPath;

- (instancetype)initWithName:(NSString *)name info:(NSString *)info label:(NSString *)label bundleVersion:(NSString *)bundleVersion versionPath:(NSString *)versionPath plist:(NSDictionary *)plist;

@end
