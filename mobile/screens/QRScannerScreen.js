import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Camera } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';

const { width } = Dimensions.get('window');

export default function QRScannerScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getCameraPermissions();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || processing) return;
    
    setScanned(true);
    setProcessing(true);
    
    try {
      console.log('QR Code scanned:', { type, data });
      
      // Parse QR code data
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch (e) {
        // If not JSON, treat as plain text
        qrData = { text: data };
      }
      
      // Handle different QR code types
      if (qrData.type === 'employee_login') {
        await handleEmployeeLogin(qrData);
      } else if (qrData.type === 'clock_action') {
        await handleClockAction(qrData);
      } else if (qrData.type === 'device_test') {
        await handleDeviceTest(qrData);
      } else {
        // Generic QR code handling
        await handleGenericQR(qrData);
      }
      
    } catch (error) {
      console.error('QR processing error:', error);
      Alert.alert('Error', 'Failed to process QR code: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEmployeeLogin = async (qrData) => {
    Alert.alert(
      'Employee Login QR',
      `Employee ID: ${qrData.employeeId}\nBusiness: ${qrData.businessId}`,
      [
        { text: 'Cancel', onPress: resetScanner },
        {
          text: 'Login',
          onPress: async () => {
            // TODO: Implement auto-login functionality
            Alert.alert('Success', 'Employee login QR processed!');
            resetScanner();
          },
        },
      ]
    );
  };

  const handleClockAction = async (qrData) => {
    Alert.alert(
      'Clock Action QR',
      `Action: ${qrData.action}\nDevice: ${qrData.deviceId}`,
      [
        { text: 'Cancel', onPress: resetScanner },
        {
          text: 'Execute',
          onPress: async () => {
            // TODO: Implement clock in/out functionality
            Alert.alert('Success', `Clock ${qrData.action} processed!`);
            resetScanner();
          },
        },
      ]
    );
  };

  const handleDeviceTest = async (qrData) => {
    Alert.alert(
      'Device Test QR',
      `Device ID: ${qrData.deviceId}\nTest: ${qrData.testType}`,
      [
        { text: 'Cancel', onPress: resetScanner },
        {
          text: 'Run Test',
          onPress: async () => {
            // TODO: Implement device test functionality
            Alert.alert('Success', 'Device test initiated!');
            resetScanner();
          },
        },
      ]
    );
  };

  const handleGenericQR = async (qrData) => {
    const displayText = qrData.text || JSON.stringify(qrData, null, 2);
    
    Alert.alert(
      'QR Code Scanned',
      displayText,
      [
        { text: 'Scan Again', onPress: resetScanner },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]
    );
  };

  const resetScanner = () => {
    setScanned(false);
    setProcessing(false);
  };

  const toggleFlash = () => {
    setFlashOn(!flashOn);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          Please grant camera permission to scan QR codes
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => navigation.goBack()}>
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Scanner</Text>
        <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
          <Text style={styles.flashButtonText}>{flashOn ? '🔦' : '💡'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <Camera
          style={styles.camera}
          type={Camera.Constants.Type.back}
          flashMode={flashOn ? Camera.Constants.FlashMode.torch : Camera.Constants.FlashMode.off}
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
          </View>
        </Camera>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Scan QR Code</Text>
        <Text style={styles.instructionsText}>
          Position the QR code within the frame to scan
        </Text>
        
        <View style={styles.supportedTypes}>
          <Text style={styles.supportedTitle}>Supported QR Types:</Text>
          <Text style={styles.supportedItem}>• Employee Login</Text>
          <Text style={styles.supportedItem}>• Clock In/Out</Text>
          <Text style={styles.supportedItem}>• Device Testing</Text>
          <Text style={styles.supportedItem}>• Generic Text/JSON</Text>
        </View>

        {scanned && (
          <TouchableOpacity style={styles.scanAgainButton} onPress={resetScanner}>
            <Text style={styles.scanAgainButtonText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Processing Modal */}
      <Modal visible={processing} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.processingText}>Processing QR Code...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#667eea',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  flashButton: {
    padding: 8,
  },
  flashButtonText: {
    fontSize: 20,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#667eea',
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#667eea',
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#667eea',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#667eea',
  },
  instructions: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  supportedTypes: {
    marginBottom: 20,
  },
  supportedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  supportedItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  scanAgainButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  scanAgainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    minWidth: 120,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    minWidth: 200,
  },
  processingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
});