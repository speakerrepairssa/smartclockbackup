import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PayslipsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payslips, setPayslips] = useState([]);

  useEffect(() => {
    loadPayslips();
  }, []);

  const loadPayslips = async () => {
    try {
      // TODO: Fetch payslips from Firestore
      // For now, using mock data
      const mockPayslips = [
        {
          id: '1',
          month: 'January 2025',
          period: '01/01/2025 - 31/01/2025',
          hoursWorked: 160,
          regularPay: 3200,
          overtimePay: 0,
          grossPay: 3200,
          deductions: 320,
          netPay: 2880,
          payDate: '31/01/2025',
        },
        {
          id: '2',
          month: 'December 2024',
          period: '01/12/2024 - 31/12/2024',
          hoursWorked: 165,
          regularPay: 3200,
          overtimePay: 150,
          grossPay: 3350,
          deductions: 335,
          netPay: 3015,
          payDate: '31/12/2024',
        },
      ];
      
      setPayslips(mockPayslips);
    } catch (error) {
      console.error('Error loading payslips:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayslips();
    setRefreshing(false);
  };

  const downloadPayslip = (payslip) => {
    // TODO: Implement payslip download/view
    console.log('Download payslip:', payslip.id);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading payslips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Payslips</Text>
        <Text style={styles.headerSubtitle}>View and download your payslips</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {payslips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No payslips available</Text>
          </View>
        ) : (
          payslips.map((payslip) => (
            <View key={payslip.id} style={styles.payslipCard}>
              <View style={styles.payslipHeader}>
                <Text style={styles.payslipMonth}>{payslip.month}</Text>
                <Text style={styles.payslipPeriod}>{payslip.period}</Text>
              </View>

              <View style={styles.payslipDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hours Worked:</Text>
                  <Text style={styles.detailValue}>{payslip.hoursWorked}h</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Regular Pay:</Text>
                  <Text style={styles.detailValue}>${payslip.regularPay.toFixed(2)}</Text>
                </View>
                {payslip.overtimePay > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Overtime Pay:</Text>
                    <Text style={styles.detailValue}>${payslip.overtimePay.toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Gross Pay:</Text>
                  <Text style={styles.detailValue}>${payslip.grossPay.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Deductions:</Text>
                  <Text style={[styles.detailValue, styles.deduction]}>
                    -${payslip.deductions.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.detailRow, styles.netPayRow]}>
                  <Text style={styles.netPayLabel}>Net Pay:</Text>
                  <Text style={styles.netPayValue}>${payslip.netPay.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => downloadPayslip(payslip)}
              >
                <Text style={styles.downloadButtonText}>📥 Download PDF</Text>
              </TouchableOpacity>
            </View>
          ))
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  payslipCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  payslipHeader: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  payslipMonth: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  payslipPeriod: {
    fontSize: 12,
    color: '#999',
  },
  payslipDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  deduction: {
    color: '#dc3545',
  },
  netPayRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#667eea',
  },
  netPayLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  netPayValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
  },
  downloadButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
