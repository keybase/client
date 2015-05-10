//
//  KBInstallable.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef void (^KBInstallStatus)(NSError *error, BOOL installed);

@protocol KBInstallable <NSObject>
- (NSString *)info;
- (void)installStatus:(KBInstallStatus)completion;
- (void)install:(void (^)(NSError *error, BOOL installed))completion;
@end
