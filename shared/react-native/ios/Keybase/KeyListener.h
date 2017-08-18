//
//  KeyListener.h
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>

@class RCTBridge;

@interface KeyListener : UIViewController

@property (nonatomic, strong) RCTBridge * bridge;

@end
