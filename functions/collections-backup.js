const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");
const { logger } = require("firebase-functions");

// Use existing Firebase Admin SDK instance (no need to initialize again)
const db = getFirestore();
const realtimeDb = getDatabase();

/**
 * Collections Backup & Restore System
 * 
 * Features:
 * - Daily automated backups at 2 AM UTC
 * - Manual backup triggers
 * - Keep up to 5 most recent backups per business
 * - Full collection restoration capabilities
 * - Progress tracking and notifications
 */

// List of collections to backup
const COLLECTIONS_TO_BACKUP = [
  'staff',
  'status', 
  'attendance_events',
  'shifts',
  'businessData'
];

/**
 * Create a backup of all collections for a specific business
 */
async function createBackup(businessId, backupType = 'scheduled') {
  try {
    const timestamp = Date.now();
    const backupId = `backup_${businessId}_${timestamp}`;
    const backupDate = new Date().toISOString();
    
    logger.info(`Starting ${backupType} backup for business: ${businessId}`);
    
    // Initialize backup metadata
    const backupMetadata = {
      id: backupId,
      businessId: businessId,
      timestamp: timestamp,
      date: backupDate,
      type: backupType,
      status: 'in_progress',
      collections: {},
      totalDocuments: 0,
      createdBy: backupType,
      version: '1.0'
    };
    
    let totalDocuments = 0;
    
    // Backup each collection
    for (const collectionName of COLLECTIONS_TO_BACKUP) {
      try {
        logger.info(`Backing up collection: ${collectionName}`);
        
        // Query documents for this business
        const collectionRef = db.collection(collectionName);
        let query = collectionRef.where('businessId', '==', businessId);
        
        const snapshot = await query.get();
        const documents = {};
        
        snapshot.forEach(doc => {
          documents[doc.id] = {
            id: doc.id,
            data: doc.data(),
            backedUpAt: backupDate
          };
        });
        
        const docCount = Object.keys(documents).length;
        totalDocuments += docCount;
        
        backupMetadata.collections[collectionName] = {
          documentCount: docCount,
          backedUpAt: backupDate,
          status: 'completed'
        };
        
        // Store collection backup in Realtime Database
        await realtimeDb.ref(`backups/${businessId}/${backupId}/collections/${collectionName}`).set(documents);
        
        logger.info(`Backup completed for ${collectionName}: ${docCount} documents`);
        
      } catch (collectionError) {
        logger.error(`Error backing up collection ${collectionName}:`, collectionError);
        backupMetadata.collections[collectionName] = {
          documentCount: 0,
          backedUpAt: backupDate,
          status: 'failed',
          error: collectionError.message
        };
      }
    }
    
    // Finalize backup metadata
    backupMetadata.totalDocuments = totalDocuments;
    backupMetadata.status = 'completed';
    backupMetadata.completedAt = new Date().toISOString();
    
    // Store backup metadata
    await realtimeDb.ref(`backups/${businessId}/${backupId}/metadata`).set(backupMetadata);
    
    // Update latest backup reference
    await realtimeDb.ref(`backups/${businessId}/latest`).set({
      backupId: backupId,
      timestamp: timestamp,
      date: backupDate,
      totalDocuments: totalDocuments,
      type: backupType
    });
    
    // Clean up old backups (keep only 5 most recent)
    await cleanupOldBackups(businessId);
    
    logger.info(`Backup completed successfully: ${backupId} (${totalDocuments} total documents)`);
    
    return {
      success: true,
      backupId: backupId,
      totalDocuments: totalDocuments,
      metadata: backupMetadata
    };
    
  } catch (error) {
    logger.error('Backup failed:', error);
    throw error;
  }
}

/**
 * Clean up old backups, keeping only the 5 most recent
 */
async function cleanupOldBackups(businessId) {
  try {
    const backupsRef = realtimeDb.ref(`backups/${businessId}`);
    const snapshot = await backupsRef.once('value');
    const backups = snapshot.val() || {};
    
    // Get all backup IDs (excluding 'latest')
    const backupIds = Object.keys(backups).filter(key => key !== 'latest' && key.startsWith('backup_'));
    
    if (backupIds.length > 5) {
      // Sort by timestamp (newest first)
      backupIds.sort((a, b) => {
        const timestampA = backups[a].metadata?.timestamp || 0;
        const timestampB = backups[b].metadata?.timestamp || 0;
        return timestampB - timestampA;
      });
      
      // Remove oldest backups
      const backupsToDelete = backupIds.slice(5);
      for (const backupId of backupsToDelete) {
        await realtimeDb.ref(`backups/${businessId}/${backupId}`).remove();
        logger.info(`Deleted old backup: ${backupId}`);
      }
    }
    
  } catch (error) {
    logger.error('Error cleaning up old backups:', error);
  }
}

/**
 * Restore collections from a backup
 */
async function restoreFromBackup(businessId, backupId, collectionsToRestore = COLLECTIONS_TO_BACKUP) {
  try {
    logger.info(`Starting restore for business: ${businessId}, backup: ${backupId}`);
    
    // Verify backup exists
    const backupRef = realtimeDb.ref(`backups/${businessId}/${backupId}`);
    const backupSnapshot = await backupRef.once('value');
    const backup = backupSnapshot.val();
    
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    const restoreId = `restore_${businessId}_${Date.now()}`;
    const restoreMetadata = {
      id: restoreId,
      businessId: businessId,
      backupId: backupId,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      status: 'in_progress',
      collectionsToRestore: collectionsToRestore,
      results: {}
    };
    
    // Store restore metadata
    await realtimeDb.ref(`restores/${businessId}/${restoreId}`).set(restoreMetadata);
    
    let totalRestored = 0;
    
    for (const collectionName of collectionsToRestore) {
      try {
        logger.info(`Restoring collection: ${collectionName}`);
        
        const collectionBackup = backup.collections?.[collectionName];
        if (!collectionBackup) {
          logger.warn(`No backup data found for collection: ${collectionName}`);
          continue;
        }
        
        // Delete existing documents in collection for this business
        const existingQuery = db.collection(collectionName).where('businessId', '==', businessId);
        const existingSnapshot = await existingQuery.get();
        
        const batch = db.batch();
        existingSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        // Restore documents from backup
        const documentsToRestore = Object.values(collectionBackup);
        const restoreBatch = db.batch();
        
        for (const docData of documentsToRestore) {
          const docRef = db.collection(collectionName).doc(docData.id);
          restoreBatch.set(docRef, docData.data);
        }
        
        await restoreBatch.commit();
        
        const restoredCount = documentsToRestore.length;
        totalRestored += restoredCount;
        
        restoreMetadata.results[collectionName] = {
          status: 'completed',
          documentsRestored: restoredCount,
          restoredAt: new Date().toISOString()
        };
        
        logger.info(`Restored collection ${collectionName}: ${restoredCount} documents`);
        
      } catch (collectionError) {
        logger.error(`Error restoring collection ${collectionName}:`, collectionError);
        restoreMetadata.results[collectionName] = {
          status: 'failed',
          error: collectionError.message,
          documentsRestored: 0
        };
      }
    }
    
    // Update restore metadata
    restoreMetadata.status = 'completed';
    restoreMetadata.completedAt = new Date().toISOString();
    restoreMetadata.totalDocumentsRestored = totalRestored;
    
    await realtimeDb.ref(`restores/${businessId}/${restoreId}`).set(restoreMetadata);
    
    logger.info(`Restore completed: ${restoreId} (${totalRestored} documents)`);
    
    return {
      success: true,
      restoreId: restoreId,
      totalDocumentsRestored: totalRestored,
      results: restoreMetadata.results
    };
    
  } catch (error) {
    logger.error('Restore failed:', error);
    throw error;
  }
}

// Scheduled daily backup at 2 AM UTC
exports.dailyBackup = onSchedule({
  schedule: "0 2 * * *", // Every day at 2 AM UTC
  timeZone: "UTC",
  memory: "1GiB",
  timeoutSeconds: 540
}, async (event) => {
  try {
    logger.info("Starting scheduled daily backup");
    
    // Get list of all businesses that have active data
    const staffSnapshot = await db.collection('staff').get();
    const businessIds = new Set();
    
    staffSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.businessId) {
        businessIds.add(data.businessId);
      }
    });
    
    logger.info(`Found ${businessIds.size} businesses to backup`);
    
    for (const businessId of businessIds) {
      try {
        await createBackup(businessId, 'scheduled');
        logger.info(`Daily backup completed for business: ${businessId}`);
      } catch (businessError) {
        logger.error(`Daily backup failed for business ${businessId}:`, businessError);
      }
    }
    
    logger.info("Daily backup process completed");
    
  } catch (error) {
    logger.error("Daily backup process failed:", error);
  }
});

// Manual backup creation endpoint
exports.createManualBackup = onRequest({
  cors: true,
  memory: "1GiB",
  timeoutSeconds: 540
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { businessId } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }
    
    const result = await createBackup(businessId, 'manual');
    
    res.status(200).json(result);
    
  } catch (error) {
    logger.error('Manual backup failed:', error);
    res.status(500).json({ 
      error: 'Backup failed', 
      details: error.message 
    });
  }
});

// Restore from backup endpoint
exports.restoreFromBackup = onRequest({
  cors: true,
  memory: "1GiB", 
  timeoutSeconds: 540
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { businessId, backupId, collections } = req.body;
    
    if (!businessId || !backupId) {
      return res.status(400).json({ error: 'businessId and backupId are required' });
    }
    
    const collectionsToRestore = collections || COLLECTIONS_TO_BACKUP;
    const result = await restoreFromBackup(businessId, backupId, collectionsToRestore);
    
    res.status(200).json(result);
    
  } catch (error) {
    logger.error('Restore failed:', error);
    res.status(500).json({ 
      error: 'Restore failed', 
      details: error.message 
    });
  }
});

// Get backup history endpoint
exports.getBackupHistory = onRequest({
  cors: true
}, async (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }
    
    const backupsRef = realtimeDb.ref(`backups/${businessId}`);
    const snapshot = await backupsRef.once('value');
    const backups = snapshot.val() || {};
    
    // Get backup list (excluding 'latest')
    const backupList = Object.keys(backups)
      .filter(key => key !== 'latest' && key.startsWith('backup_'))
      .map(backupId => ({
        id: backupId,
        ...backups[backupId].metadata
      }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Newest first
    
    res.status(200).json({
      success: true,
      backups: backupList,
      latest: backups.latest || null
    });
    
  } catch (error) {
    logger.error('Get backup history failed:', error);
    res.status(500).json({ 
      error: 'Failed to get backup history', 
      details: error.message 
    });
  }
});