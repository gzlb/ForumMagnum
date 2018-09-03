import React from 'react';
import PropTypes from 'prop-types';
import { Components, replaceComponent, withCurrentUser } from 'meteor/vulcan:core';
import Users from 'meteor/vulcan:users';
import Button from '@material-ui/core/Button';
import { withTheme, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';

const commentFonts = '"freight-sans-pro", Frutiger, "Frutiger Linotype", Univers, Calibri, "Gill Sans", "Gill Sans MT", "Myriad Pro", Myriad, "DejaVu Sans Condensed", "Liberation Sans", "Nimbus Sans L", Tahoma, Geneva, "Helvetica Neue", Helvetica, Arial, sans-serif';

const styles = theme => ({
  formButton: {
    paddingBottom: "2px",
    fontFamily: commentFonts,
    fontSize: "16px",
    marginLeft: "5px",
    
    "&:hover": {
      background: "rgba(0,0,0, 0.05)",
    }
  },
  
  secondaryButton: {
    color: "rgba(0,0,0,0.4)",
  },
  
  submitButton: {
    color: theme.palette.secondary.main,
  },
});

const FormSubmit = ({
                      submitLabel,
                      cancelLabel,
                      cancelCallback,
                      document,
                      deleteDocument,
                      collectionName,
                      classes,
                      currentUser,
                      theme
                    },
                    {
                      updateCurrentValues,
                      addToDeletedValues
                    }) => (
  <div className="form-submit">

    {collectionName === "posts" && <span className="post-submit-buttons">
      { !document.isEvent &&
        !document.meta &&
        Users.canDo(currentUser, 'posts.curate.all') &&
          <Button
            type="submit"
            className={classNames(classes.formButton, classes.secondaryButton)}
            onClick={() => {
              updateCurrentValues({frontpageDate: document.frontpageDate ? null : new Date(), draft: false});
              if (document.frontpageDate) {
                addToDeletedValues('frontpageDate')
              }
            }}
          >
            {document.frontpageDate
              ? "Move to personal blog"
              : "Submit to frontpage" }
          </Button>}

      <Button
        type="submit"
        className={classNames(classes.formButton, classes.secondaryButton)}
        onClick={() => updateCurrentValues({draft: true})}
      >
        Save as draft
      </Button>

      {Users.canDo(currentUser, 'posts.curate.all') && !document.meta &&
        <Button
          type="submit"
          className={classNames(classes.formButton, classes.secondaryButton)}
          onClick={() => {
            updateCurrentValues({curatedDate: document.curatedDate ? null : new Date()})
            if (document.curatedDate) {
              addToDeletedValues('curatedDate')
            }
          }}
        >
          {document.curatedDate
            ? "Remove from curated"
            : "Promote to curated"}
        </Button>
      }
    </span>}

    {!!cancelCallback &&
      <Button
        className={classNames("form-cancel", classes.formButton, classes.secondaryButton)}
        onClick={(e) => {
          e.preventDefault();
          cancelCallback(document)
        }}
      >
        Cancel
      </Button>
    }

    <Button
      type="submit"
      onClick={() => collectionName === "posts" && updateCurrentValues({draft: false})}
      className={classNames("primary-form-submit-button", classes.formButton, classes.submitButton)}
      variant={collectionName=="users" ? "contained" : undefined}
    >
      Submit
    </Button>

    {collectionName === "comments" && document && document.postId && <span className="comment-submit-buttons">
      <Components.ModerationGuidelinesLink showModeratorAssistance documentId={document.postId}/>
    </span>}
  </div>
);


FormSubmit.propTypes = {
  submitLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  cancelCallback: PropTypes.func,
  document: PropTypes.object,
  deleteDocument: PropTypes.func,
  collectionName: PropTypes.string,
  classes: PropTypes.object,
  theme: PropTypes.object,
};

FormSubmit.contextTypes = {
  updateCurrentValues: PropTypes.func,
  addToDeletedValues: PropTypes.func,
  addToSuccessForm: PropTypes.func,
  addToSubmitForm: PropTypes.func,
}


replaceComponent('FormSubmit', FormSubmit,
  withCurrentUser, withTheme(),
  withStyles(styles, { name: "FormSubmit" })
);
