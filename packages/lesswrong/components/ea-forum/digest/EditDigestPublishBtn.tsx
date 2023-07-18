import React from 'react';
import { Components, registerComponent } from '../../../lib/vulcan-lib';
import { useUpdate } from '../../../lib/crud/withUpdate';
import Button from '@material-ui/core/Button';
import { useDialog } from '../../common/withDialog';
import classNames from 'classnames';

const styles = (theme: ThemeType): JssStyles => ({
  btn: {
    fontSize: 14,
    textTransform: 'none',
    boxShadow: 'none'
  },
  publishBtn: {
    backgroundColor: theme.palette.buttons.alwaysPrimary,
    color: theme.palette.text.alwaysWhite,
  },
  questionMark: {
    alignSelf: 'center',
    color: theme.palette.grey[600]
  },
  questionMarkIcon: {
    fontSize: 20
  },
  tooltipSection: {
    marginTop: 8
  }
})


const EditDigestPublishBtn = ({digest, classes} : {
  digest: DigestsMinimumInfo,
  classes: ClassesType
}) => {
  const { openDialog } = useDialog()
  const isPublished = !!digest.publishedDate
  
  const { mutate: updateDigest } = useUpdate({
    collectionName: 'Digests',
    fragmentName: 'DigestsMinimumInfo',
  })
  
  /**
   * If the digest has been published before, set or unset the publishedDate.
   * Otherwise, open the publish confirmation dialog.
   */
  const handleBtnClick = () => {
    // if the digest has an endDate set, then we know it's already been published
    if (digest.endDate) {
      void updateDigest({
        selector: {_id: digest._id},
        data: {
          publishedDate: isPublished ? null : new Date()
        }
      })
    } else {
      openDialog({
        componentName: 'ConfirmPublishDialog',
        componentProps: {digest}
      })
    }
  }
  
  const { LWTooltip, ForumIcon } = Components

  return <>
    <Button
      variant={isPublished ? 'outlined' : 'contained'}
      color="primary"
      onClick={handleBtnClick}
      className={classNames(classes.btn, {[classes.publishBtn]: !isPublished})}
    >
      {isPublished ? 'Unpublish' : 'Publish'}
    </Button>

    <LWTooltip
      title={<>
        <div>
          Don't worry, it's totally safe to click the "Publish" button!
        </div>
        <div className={classes.tooltipSection}>
          If the digest has never been published, clicking the button will bring up a confirmation modal.
          Clicking "Publish" in there sets the cut-off date for this digest
          (which determines which posts are eligible to appear in the table),
          and automatically sets up the next digest.
        </div>
        <div className={classes.tooltipSection}>
          Both unpublishing and re-publishing do nothing. You can always change whether or not
          the posts in this table are in the digest, even after publishing.
        </div>
      </>}
      className={classes.questionMark}
    >
      <ForumIcon icon="QuestionMarkCircle" className={classes.questionMarkIcon} />
    </LWTooltip>
  </>
}

const EditDigestPublishBtnComponent = registerComponent('EditDigestPublishBtn', EditDigestPublishBtn, {styles});

declare global {
  interface ComponentTypes {
    EditDigestPublishBtn: typeof EditDigestPublishBtnComponent
  }
}