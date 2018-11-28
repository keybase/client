//
//  FilesViewController.h
//  KeybaseShare
//
//  Created by John Zila on 10/25/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>

#define DirentColorFolder [UIColor colorWithRed:76.0/255.0 green:142.0/255.0 blue:1 alpha:1]
#define DirentColorOther [UIColor colorWithRed:0 green:0 blue:0 alpha:1]

@protocol FilesViewDelegate<NSObject>
-(void)folderSelected:(NSString*)folderPath;
@end

@interface FilesViewController : UITableViewController
@property (weak) UIViewController<FilesViewDelegate> *delegate;
@end
