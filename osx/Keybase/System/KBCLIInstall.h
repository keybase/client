//
//  KBCLIInstall.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBInstallable.h"

#define LINK_SOURCE (@"/usr/local/bin/keybase")
#define LINK_DESTINATION (@"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase")

@interface KBCLIInstall : NSObject <KBInstallable>

@end
