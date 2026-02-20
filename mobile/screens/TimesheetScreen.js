import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

export default function TimesheetScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    loadAttendance();
  }, []);

  const loadAttendance = async () => {
    try {
      // TODO: Fetch attendance from Firestore
      // For now, using mock data
      const mockAttendance = [
        {
          id: '1',
          date: '2025-02-18',
          day: 'Tuesday',
          clockIn: '09:00 AM',
          clockOut: '05:30 PM',
          totalHours: 8.5,
          status: 'Present',
        },
        {
          id: '2',
          date: '2025-02-17',
          day: 'Monday',
          clockIn: '08:55 AM',
          clockOut: '05:15 PM',
          totalHours: 8.3,
          status: 'Present',
        },
        {
          id: '3',
          date: '2025-02-16',
          day: 'Sunday',
          clockIn: '-',
          clockOut: '-',
          totalHours: 0,
          status: 'Weekend',
        },
        {
          id: '4',
          date: '2025-02-15',
          day: 'Saturday',
          clockIn: '-',
          clockOut: '-',
          totalHours: 0,
          status: 'Weekend',
        },
        {
          id: '5',
          date: '2025-02-14',
          day: 'Friday',
          clockIn: '09:10 AM',
          clockOut: '05:40 PM',
          totalHours: 8.5,
          status: 'Present',
        },
      ];
      
      setAttendance(mockAttendance);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAttendance();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return '#28a745';
      case 'Weekend':
        return '#999';
      case 'Absent':
        return '#dc3545';
      case 'Leave':
        return '#ffc107';
      default:
        return '#666';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading timesheet...</Text>
      </View>
    );
  }

  const totalHours = attendance.reduce((sum, day) => sum + day.totalHours, 0);
  const presentDays = attendance.filter(day => day.status === 'Present').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Timesheet</Text>
        <Text style={styles.headerSubtitle}>Your attendance history</Text>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalHours.toFixed(1)}h</Text>
          <Text style={styles.summaryLabel}>Total Hours</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{presentDays}</Text>
          <Text style={styles.summaryLabel}>Days Present</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.sectionTitle}>Recent Attendance</Text>

        {attendance.map((day) => (
          <View key={day.id} style={styles.attendanceCard}>
            <View style={styles.dateSection}>
              <Text style={styles.dateText}>{day.date}</Text>
              <Text style={styles.dayText}>{day.day}</Text>
            </View>

            <View style={styles.detailsSection}>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>In:</Text>
                <Text style={styles.timeValue}>{day.clockIn}</Text>
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Out:</Text>
                <Text style={styles.timeValue}>{day.clockOut}</Text>
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Total:</Text>
                <Text style={[styles.timeValue, styles.totalHours]}>
                  {day.totalHours}h
                </Text>
              </View>
            </View>

            <View style={styles.statusSection}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(day.status) }]}>
                <Text style={styles.statusText}>{day.status}</Text>
              </View>
            </View>
          </View>
        ))}
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
  summary: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateSection: {
    width: 80,
    justifyContent: 'center',
    paddingRight: 15,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailsSection: {
    flex: 1,
    paddingLeft: 15,
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timeLabel: {
    width: 40,
    fontSize: 13,
    color: '#666',
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  totalHours: {
    color: '#667eea',
  },
  statusSection: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});
