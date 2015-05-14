//
//  KBInstallable.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBInstallStatus.h"
#import "KBDefines.h"

typedef void (^KBInstallableStatus)(KBInstallStatus *installStatus);

@protocol KBInstallable <NSObject>

- (NSString *)name;

- (void)installStatus:(KBInstallableStatus)completion;

- (void)install:(KBCompletion)completion;

@end
