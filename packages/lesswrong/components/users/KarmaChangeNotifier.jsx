import React, { PureComponent } from 'react';
import { Components, registerComponent, withEdit } from 'meteor/vulcan:core';
import { withStyles } from '@material-ui/core/styles';
import withUser from '../common/withUser';
import withErrorBoundary from '../common/withErrorBoundary'
import Popper from '@material-ui/core/Popper';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import { Link } from 'react-router';
import Users from 'meteor/vulcan:users';

const styles = theme => ({
  karmaNotifierButton: {
    paddingLeft: 3,
    minWidth: 0,
    verticalAlign: "text-bottom",
    top: 5,
  },
  karmaNotifierButtonLabel: {
    textTransform: "none",
    fontSize: 16,
    fontWeight: 400,
  },
  karmaNotifierPaper: {
    padding: 10,
  },
  karmaNotifierPopper: {
    zIndex: 10000,
  },
  
  votedItems: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  votedItemRow: {
  },
  votedItemScoreChange: {
    display: "inline-block",
    width: 30,
    textAlign: "right",
  },
  votedItemDescription: {
    display: "inline-block",
    marginLeft: 5,
  },
  
  singleLinePreview: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    display: "inline-block",
    maxWidth: 400,
    
    verticalAlign: "middle",
    position: "relative",
    top: -1,
  },
  
  gainedPoints: {
    color: theme.palette.primary.main,
  },
  zeroPoints: {
  },
  lostPoints: {
    color: theme.palette.error.main,
  },
});

// Given a number, return a span of it as a string, with a plus sign if it's
// positive, and green, red, or black coloring for positive, negative, and
// zero, respectively.
const ColoredNumber = ({n, classes}) => {
  if (n>0) {
    return <span className={classes.gainedPoints}>{`+${n}`}</span>
  } else if (n==0) {
    return <span className={classes.zeroPoints}>{n}</span>
  } else {
    return <span className={classes.lostPoints}>{n}</span>
  }
}

const KarmaChangesDisplay = ({karmaChanges, classes}) => {
  const {FormatDate} = Components;
  return (
    <div>
      Karma changes between <FormatDate date={karmaChanges.startDate}/> and <FormatDate date={karmaChanges.endDate}/>
      
      <div className={classes.votedItems}>
        {karmaChanges.posts && karmaChanges.posts.map((postChange,i) => (
          <div className={classes.votedItemRow} key={"post"+i}>
            <div className={classes.votedItemScoreChange}>
              <ColoredNumber n={postChange.scoreChange} classes={classes}/>
            </div>
            <div className={classes.votedItemDescription}>
              <Link to={postChange.post.pageUrlRelative} className={classes.singleLinePreview}>
                {postChange.post.title}
              </Link>
            </div>
          </div>
        ))}
        {karmaChanges.comments && karmaChanges.comments.map((commentChange,i) => (
          <div className={classes.votedItemRow} key={"comment"+i}>
            <div className={classes.votedItemScoreChange}>
              <ColoredNumber n={commentChange.scoreChange} classes={classes}/>
            </div>
            <div className={classes.votedItemDescription}>
              <Link to={commentChange.comment.pageUrlRelative} className={classes.singleLinePreview}>
                {commentChange.comment.plaintextExcerpt}>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

class KarmaChangeNotifier extends PureComponent {
  state = {
    cleared: false,
    open: false,
    anchorEl: null,
  };
  
  handleOpen = (event) => {
    this.setState({
      open: true,
      anchorEl: event.currentTarget
    });
    if (this.props.currentUser && this.props.currentUser.karmaChanges) {
      this.props.editMutation({
        documentId: this.props.currentUser._id,
        set: {
          karmaChangeLastOpened: this.props.currentUser.karmaChanges.endDate
        }
      });
      
      if (this.props.currentUser.karmaChanges.updateFrequency === "realtime") {
        this.setState({cleared: true});
      }
    }
  }
  
  handleClose = () => {
    this.setState({
      open: false,
      anchorEl: null,
    });
  }
  
  render() {
    const {classes, currentUser} = this.props;
    const {open, anchorEl} = this.state;
    if (!currentUser) return null;
    const karmaChanges = currentUser.karmaChanges;
    
    const settings = currentUser.karmaChangeNotifierSettings;
    if (settings && settings.updateFrequency === "disabled")
      return null;
    
    if (this.state.cleared && !open)
      return null;
    
    if (karmaChanges.comments.length===0 && karmaChanges.posts.length===0)
      return null;
    
    return (<div onMouseOver={this.handleOpen} onMouseLeave={this.handleClose}>}
      <Button onClick={this.handleOpen} className={classes.karmaNotifierButton}>
        <span className={classes.karmaNotifierButtonLabel}>
          <ColoredNumber n={karmaChanges.totalChange} classes={classes}/>
        </span>
      </Button>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-end"
        className={classes.karmaNotifierPopper}
        popperOptions={{
          // Don't use CSS transform3d to position the popper, because that
          // causes blurry text under some circumstances
          modifiers: {
            computeStyle: {
              gpuAcceleration: false,
            }
          }
        }}
      >
        <Paper className={classes.karmaNotifierPaper}>
          <KarmaChangesDisplay karmaChanges={karmaChanges} classes={classes} />
        </Paper>
      </Popper>
    </div>);
  }
}

const withEditOptions = {
  collection: Users,
  fragmentName: 'UsersCurrent',
};

registerComponent('KarmaChangeNotifier', KarmaChangeNotifier,
  withUser, withErrorBoundary,
  [withEdit, withEditOptions],
  withStyles(styles, {name: 'KarmaChangeNotifier'})
);