//
//  FilesViewController.h
//  KeybaseShare
//
//  Created by John Zila on 10/25/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>

@protocol FilesViewDelegate<NSObject>
-(void)folderSelected:(NSDictionary*)folder;
@end

@interface FilesViewController : UITableViewController
@property (weak) UIViewController<FilesViewDelegate> *delegate;
@end
