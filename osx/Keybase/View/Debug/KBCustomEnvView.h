//
//  KBCustomEnvView.h
//  Keybase
//
//  Created by Gabriel on 5/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBEnvironment.h"

@interface KBCustomEnvView : YOView

@property KBTextField *homeDirField;
@property KBTextField *socketFileField;
@property KBTextField *mountDirField;

@property (nonatomic) KBEnvironment *environment;

- (void)save;

@end
