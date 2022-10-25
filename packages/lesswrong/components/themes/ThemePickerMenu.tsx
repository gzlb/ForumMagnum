import React from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { useUpdate } from '../../lib/crud/withUpdate';
import { ThemeMetadata, themeMetadata, getForumType } from '../../themes/themeNames';
import { ForumTypeString, allForumTypes, forumTypeSetting } from '../../lib/instanceSettings';
import { useThemeOptions, useSetTheme } from './useTheme';
import { useCurrentUser } from '../common/withUser';
import Divider from '@material-ui/core/Divider';
import Check from '@material-ui/icons/Check';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Info from '@material-ui/icons/Info';

const styles = (theme: ThemeType): JssStyles => ({
  check: {
    width: 20,
    marginRight: 8,
  },
  notChecked: {
    width: 20,
    marginRight: 8,
  },
  siteThemeOverrideLabel: {
    padding: 8,
  },
  infoIcon: {
    fontSize: 14,
  },
})

const ThemePickerMenu = ({children, classes}: {
  children: React.ReactNode,
  classes: ClassesType,
}) => {
  const { LWTooltip, Typography } = Components;
  const currentThemeOptions = useThemeOptions();
  const setTheme = useSetTheme();
  const currentUser = useCurrentUser();

  const {mutate: updateUser} = useUpdate({
    collectionName: "Users",
    fragmentName: "UsersCurrent",
  });

  const selectedForumTheme = getForumType(currentThemeOptions);

  const setThemeName = (name: UserThemeSetting) => {
    setTheme({...currentThemeOptions, name});
  }

  const setThemeForum = (forumType: ForumTypeString) => {
    const themeOptions = {
      ...currentThemeOptions,
      siteThemeOverride: {
        ...currentThemeOptions.siteThemeOverride,
        [forumTypeSetting.get()]: forumType,
      },
    };
    setTheme(themeOptions);
    console.log("Setting", themeOptions, forumTypeSetting.get(), !!currentUser);
    if (forumTypeSetting.get() === "EAForum" && currentUser) {
      updateUser({
        selector: {_id: currentUser._id},
        data: {theme: themeOptions},
      });
    }
  }

  const submenu = <Paper>
    {forumTypeSetting.get() !== "EAForum" &&
      <>
        {themeMetadata.map((themeMetadata: ThemeMetadata) =>
          <MenuItem key={themeMetadata.name} onClick={() => setThemeName(themeMetadata.name)}>
            {currentThemeOptions?.name === themeMetadata.name
              ? <Check className={classes.check}/>
              : <div className={classes.notChecked}/>
            }
            {themeMetadata.label}
          </MenuItem>
        )}
        <Divider/>
      </>
    }

    {currentUser?.isAdmin && <div>
      <div>
        <Typography variant="body2" className={classes.siteThemeOverrideLabel}>
          Site Theme Override
          <LWTooltip title={<p>
            Admin only. Makes the site look (for you) like another Forum Magnum
            site. Useful for testing themes and component-style changes. Note that
            this only overrides the theme; site-specific differences in
            functionality will not be affected.
          </p>}>
            <Info className={classes.infoIcon}/>
          </LWTooltip>
        </Typography>
      </div>
      {allForumTypes.map((forumType: ForumTypeString) =>
        <MenuItem key={forumType} onClick={() => setThemeForum(forumType)}>
          {(selectedForumTheme === forumType)
            ? <Check className={classes.check}/>
            : <div className={classes.notChecked}/>
          }
          {forumType}
        </MenuItem>
      )}
    </div>}
  </Paper>

  return <LWTooltip
    title={submenu}
    tooltip={false} clickable={true}
    inlineBlock={false}
    placement="left-start"
  >
    {children}
  </LWTooltip>
}


const ThemePickerMenuComponent = registerComponent('ThemePickerMenu', ThemePickerMenu, {styles});

declare global {
  interface ComponentTypes {
    ThemePickerMenu: typeof ThemePickerMenuComponent
  }
}
