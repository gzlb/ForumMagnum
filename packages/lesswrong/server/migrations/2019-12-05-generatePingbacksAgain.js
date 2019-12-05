import { registerMigration, forEachDocumentBatchInCollection } from './migrationUtils';
import { editableCollections, editableCollectionsFields, editableCollectionsFieldOptions } from '../../lib/editor/make_editable.js';
import { getCollection } from 'meteor/vulcan:lib';
import { htmlToPingbacks } from '../pingbacks.js';

registerMigration({
  name: "generatePingbacksAgain",
  idempotent: true,
  action: async () => {
    for (let collectionName of editableCollections) {
      for (let editableField of editableCollectionsFields[collectionName]) {
        if (editableCollectionsFieldOptions[collectionName][editableField].pingbacks) {
          await updatePingbacks(collectionName, editableField);
        }
      }
    }
  }
});

const updatePingbacks = async (collectionName, fieldName) => {
  const collection = getCollection(collectionName);
  // eslint-disable-next-line no-console
  console.log(`Updating pingbacks for ${collectionName}.${fieldName}`);
  let updatedDocuments = 0
  await forEachDocumentBatchInCollection({
    collection: collection,
    batchSize: 1000,
    callback: async (documents) => {
      let updates = [];
      
      for (let document of documents) {
        const html = document[fieldName]?.html;
        if (html) {
          const pingbacks = await htmlToPingbacks(html);
          if (JSON.stringify(document.pingbacks) !== JSON.stringify(pingbacks)) {
            updates.push({
              updateOne: {
                filter: { _id: document._id },
                update: { $set: {
                  pingbacks: pingbacks,
                } },
              }
            });
          }
        }
      }
      
      if (updates.length > 0) {
        await collection.rawCollection().bulkWrite(updates, {ordered: false});
      }
      updatedDocuments = updatedDocuments + documents.length
      // eslint-disable-next-line no-console
      console.log("processed documents: ", updatedDocuments)
      // eslint-disable-next-line no-console
      console.log("updated documents: ", updates.length)
    }
  });
}
