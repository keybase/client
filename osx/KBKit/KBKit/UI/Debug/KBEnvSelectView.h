//
//  KBEnvSelectView.h
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBRPC.h"
#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBEnvironment.h"

typedef void (^KBEnvSelect)(KBEnvConfig *envConfig);

@interface KBEnvSelectView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) KBEnvSelect onSelect;

@end
