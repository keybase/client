//
//  KBCatalogView.h
//  Keybase
//
//  Created by Gabriel on 1/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

#import "KBConnectView.h"

@interface KBCatalogView : KBView <NSTableViewDelegate, NSTableViewDataSource, KBSignupViewDelegate, KBLoginViewDelegate>

@end
