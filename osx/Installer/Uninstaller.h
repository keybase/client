//
//  Uninstaller.h
//  Keybase
//
//  Created by Gabriel on 1/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBKit.h>
#import "Options.h"

@interface Uninstaller : NSObject

+ (void)uninstallWithOptions:(Options *)options completion:(KBCompletion)completion;

@end
