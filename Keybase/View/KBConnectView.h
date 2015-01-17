//
//  KBConnectView.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

@interface KBConnectView : KBView
- (void)setLoginEnabled:(BOOL)loginEnabled animated:(BOOL)animated;
@end

@interface KBLoginView : KBView
@end

@interface KBSignupView : KBView
@end