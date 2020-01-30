import { Components, registerComponent, getFragment } from 'meteor/vulcan:core';
import React from 'react';
import Books from '../../lib/collections/books/collection';

const BooksNewForm = ({successCallback, cancelCallback, prefilledProps}: {
  successCallback?: ()=>void,
  cancelCallback?: ()=>void,
  prefilledProps?: Record<string,any>,
}) => {
  return (
    <div className="chapters-new-form">
      <Components.WrappedSmartForm
        collection={Books}
        successCallback={successCallback}
        cancelCallback={cancelCallback}
        prefilledProps={prefilledProps}
        fragment={getFragment('BookPageFragment')}
        queryFragment={getFragment('BookPageFragment')}
        mutationFragment={getFragment('BookPageFragment')}
      />
    </div>
  )
}

const BooksNewFormComponent = registerComponent('BooksNewForm', BooksNewForm);

declare global {
  interface ComponentTypes {
    BooksNewForm: typeof BooksNewFormComponent
  }
}

