//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBContentView.h"

@interface KBInstallerView : KBContentView

@property (nonatomic) NSArray *installActions;
@property (copy) KBCompletion completion;

@end
