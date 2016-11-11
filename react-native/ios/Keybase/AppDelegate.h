//
//  AppDelegate.h
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>

@class Engine;

@interface AppDelegate : UIResponder <UIApplicationDelegate>

@property (nonatomic) UIWindow *window;
@property (nonatomic) Engine *engine;

@end
