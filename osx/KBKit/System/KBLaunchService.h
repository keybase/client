//
//  KBLaunchService.h
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBInstallable.h"
#import "KBComponent.h"

@interface KBLaunchService : KBInstallableComponent <KBComponent, KBInstallable>

@property (readonly) NSString *label;
@property (readonly) NSDictionary *plist;
@property (readonly) NSString *versionPath;
@property (readonly) NSString *bundleVersion;

- (void)setName:(NSString *)name info:(NSString *)info label:(NSString *)label bundleVersion:(NSString *)bundleVersion versionPath:(NSString *)versionPath plist:(NSDictionary *)plist;

- (NSString *)plistDestination;

@end
