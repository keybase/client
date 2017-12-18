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

@property (nonatomic, strong) UIWindow *window;
@property (nonatomic, strong) Engine *engine;
@property UIImageView *resignImageView;

@end
