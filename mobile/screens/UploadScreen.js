import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export default function UploadScreen() {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedDocuments, setUploadedDocuments] = useState([
    {
      id: '1',
      name: 'Sick Note - Jan 2025.pdf',
      type: 'Sick Note',
      date: '2025-01-15',
      status: 'Approved',
    },
  ]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedFile({
        uri: result.assets[0].uri,
        type: 'image',
        name: `photo_${Date.now()}.jpg`,
      });
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required to select photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedFile({
        uri: result.assets[0].uri,
        type: 'image',
        name: `image_${Date.now()}.jpg`,
      });
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setSelectedFile({
          uri: result.assets[0].uri,
          type: 'document',
          name: result.assets[0].name,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile) {
      Alert.alert('No File Selected', 'Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      // TODO: Upload to Firebase Storage
      // const storageRef = ref(storage, `businesses/${businessId}/staff/${employeeId}/documents/${selectedFile.name}`);
      // await uploadBytes(storageRef, selectedFile);
      
      // TODO: Save metadata to Firestore
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert('Success', 'Document uploaded successfully');
      setSelectedFile(null);
      
      // Refresh documents list
      // await loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Upload Failed', 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Upload Documents</Text>
        <Text style={styles.headerSubtitle}>Submit sick notes and other documents</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Select a file to upload</Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Text style={styles.uploadIcon}>📷</Text>
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButton} onPress={pickFromGallery}>
              <Text style={styles.uploadIcon}>🖼️</Text>
              <Text style={styles.uploadButtonText}>Choose Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
              <Text style={styles.uploadIcon}>📄</Text>
              <Text style={styles.uploadButtonText}>Pick Document</Text>
            </TouchableOpacity>
          </View>

          {selectedFile && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewTitle}>Selected File:</Text>
              {selectedFile.type === 'image' && (
                <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
              )}
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.clearButton]}
                  onPress={clearSelection}
                  disabled={uploading}
                >
                  <Text style={styles.actionButtonText}>Clear</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.uploadActionButton]}
                  onPress={uploadDocument}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Upload Now</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.documentsSection}>
          <Text style={styles.sectionTitle}>Uploaded Documents</Text>

          {uploadedDocuments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No documents uploaded yet</Text>
            </View>
          ) : (
            uploadedDocuments.map((doc) => (
              <View key={doc.id} style={styles.documentCard}>
                <Text style={styles.documentIcon}>📄</Text>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>{doc.name}</Text>
                  <Text style={styles.documentType}>{doc.type}</Text>
                  <Text style={styles.documentDate}>{doc.date}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  doc.status === 'Approved' ? styles.statusApproved : styles.statusPending
                ]}>
                  <Text style={styles.statusText}>{doc.status}</Text>
                </View>
              </View>
            ))
          )}
       </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 30,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  uploadSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  previewContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
    resizeMode: 'cover',
  },
  fileName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  uploadActionButton: {
    backgroundColor: '#28a745',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  documentsSection: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  documentCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  documentIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentType: {
    fontSize: 12,
    color: '#667eea',
    marginBottom: 2,
  },
  documentDate: {
    fontSize: 11,
    color: '#999',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusApproved: {
    backgroundColor: '#28a745',
  },
  statusPending: {
    backgroundColor: '#ffc107',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});
