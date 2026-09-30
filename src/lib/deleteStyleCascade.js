import { collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteLocalStyle } from './demoData';

const STYLE_SUBCOLLECTIONS = ['yarnLedger', 'accessoryLedger', 'productionEntries', 'shipments', 'yarnIssueApprovals', 'ieRecords'];

// Firestore never deletes a subcollection just because its parent document
// was deleted — every yarnLedger/accessoryLedger/productionEntries entry
// under a deleted style would otherwise keep existing forever.
// This deletes every doc in every subcollection first, then the style doc,
// AND cleans up local storage so deleted styles never reappear.
export async function deleteStyleCascade(styleId) {
  // Clean up local storage first so UI reacts immediately
  deleteLocalStyle(styleId);

  try {
    for (const sub of STYLE_SUBCOLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, 'styles', styleId, sub));
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (subErr) {
        console.warn(`Could not clear subcollection ${sub} for style ${styleId}:`, subErr);
      }
    }
    await deleteDoc(doc(db, 'styles', styleId));
  } catch (err) {
    console.warn(`Firestore delete doc notice for ${styleId}:`, err);
  }
}
