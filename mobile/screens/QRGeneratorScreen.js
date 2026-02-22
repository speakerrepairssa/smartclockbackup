import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');

export default function QRGeneratorScreen({ navigation }) {
  const [selectedQRType, setSelectedQRType] = useState(null);

  // Predefined QR code templates for testing
  const qrTemplates = [
    {
      id: 'employee_login',
      title: 'Employee Login',
      icon: '👤',
      color: '#28a745',
      data: {
        type: 'employee_login',
        employeeId: 'EMP001',
        businessId: 'BUS001',
        timestamp: Date.now(),
      },
    },
    {
      id: 'clock_in',
      title: 'Clock In',
      icon: '⏰',
      color: '#007bff',
      data: {
        type: 'clock_action',
        action: 'in',
        deviceId: 'DEV001',
        timestamp: Date.now(),
      },
    },
    {
      id: 'clock_out',
      title: 'Clock Out',
      icon: '🏃',
      color: '#dc3545',
      data: {
        type: 'clock_action',
        action: 'out',
        deviceId: 'DEV001',
        timestamp: Date.now(),
      },
    },
    {
      id: 'device_test',
      title: 'Device Test',
      icon: '🔧',
      color: '#ffc107',
      data: {
        type: 'device_test',
        deviceId: 'DEV001',
        testType: 'connectivity',
        timestamp: Date.now(),
      },
    },
    {
      id: 'generic_text',
      title: 'Sample Text',
      icon: '📝',
      color: '#6f42c1',
      data: {
        text: 'Hello from AIClock Mobile App!',
        timestamp: Date.now(),
      },
    },
    {
      id: 'business_info',
      title: 'Business Info',
      icon: '🏢',
      color: '#20c997',
      data: {
        type: 'business_info',
        businessId: 'BUS001',
        businessName: 'Test Company',
        deviceCount: 3,
        timestamp: Date.now(),
      },
    },
  ];

  const generateQRData = (template) => {
    const updatedData = {
      ...template.data,
      timestamp: Date.now(),
    };
    return JSON.stringify(updatedData, null, 0);
  };

  const handleQRSelect = (template) => {
    setSelectedQRType(template);
  };

  const handleTestScan = () => {
    Alert.alert(
      'Test QR Code',
      'Navigate to the QR Scanner to test this code!',
      [
        { text: 'Cancel' },
        {
          text: 'Open Scanner',
          onPress: () => navigation.navigate('QRScanner'),
        },
      ]
    );
  };

  const resetSelection = () => {
    setSelectedQRType(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Generator</Text>
        <TouchableOpacity style={styles.scanButton} onPress={() => navigation.navigate('QRScanner')}>
          <Text style={styles.scanButtonText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {!selectedQRType ? (
          <View>
            <Text style={styles.sectionTitle}>Select QR Code Type</Text>
            <Text style={styles.sectionSubtitle}>
              Generate test QR codes for different scenarios
            </Text>

            <View style={styles.templatesGrid}>
              {qrTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[styles.templateCard, { borderLeftColor: template.color }]}
                  onPress={() => handleQRSelect(template)}
                >
                  <Text style={[styles.templateIcon, { color: template.color }]}>
                    {template.icon}
                  </Text>
                  <Text style={styles.templateTitle}>{template.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.qrContainer}>
              <Text style={styles.qrTitle}>{selectedQRType.title} QR Code</Text>
              
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={generateQRData(selectedQRType)}
                  size={width * 0.6}
                  backgroundColor="white"
                  color="black"
                  logo={null}
                />
              </View>

              <View style={styles.qrInfo}>
                <Text style={styles.qrInfoTitle}>QR Code Data:</Text>
                <View style={styles.qrDataContainer}>
                  <Text style={styles.qrDataText}>
                    {generateQRData(selectedQRType)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleTestScan}>
                <Text style={styles.actionButtonText}>📷 Test Scan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={resetSelection}
              >
                <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                  🔄 Generate New
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>How to Use:</Text>
              <Text style={styles.instructionItem}>1. Show this QR code to another device</Text>
              <Text style={styles.instructionItem}>2. Use the QR Scanner to scan it</Text>
              <Text style={styles.instructionItem}>3. Test the functionality</Text>
              <Text style={styles.instructionItem}>4. Generate new codes as needed</Text>
            </View>
          </View>
        )}
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
  scanButton: {
    padding: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  templateCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  qrCodeWrapper: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrInfo: {
    width: '100%',
  },
  qrInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  qrDataContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  qrDataText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  secondaryButtonText: {
    color: '#667eea',
  },
  instructions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  instructionItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 10,
  },
});